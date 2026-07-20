'use strict';

const { timingSafeEqual } = require('crypto');
const express = require('express');

const { getSdk } = require('../api-util/sdk');
const { createSharedRateLimit } = require('../services/rateLimitStore');
const {
  removeMarketingContact,
  upsertMarketingContact,
} = require('../services/brevoContactService');
const { createBrevoWebhookStore } = require('../services/brevoWebhookStore');
const {
  DEFAULT_POLICY_VERSION,
  createMarketingConsentStore,
} = require('../services/marketingConsent');
const {
  recordListingEngagement,
  userSnapshot,
} = require('../services/notificationCampaignService');
const { getNotificationConfigReadiness } = require('../services/notificationConfig');
const { normalizeEmail } = require('../services/emailAddress');

const router = express.Router();
const BREVO_CONSENT_ATTRIBUTES_ENABLED = process.env.BREVO_CONSENT_ATTRIBUTES_ENABLED === 'true';

const subscribeRateLimit = createSharedRateLimit({
  bucket: 'brevo_subscribe',
  windowMs: 60 * 1000,
  max: 20,
  message: { ok: false, error: 'rate_limited' },
});
const preferenceRateLimit = createSharedRateLimit({
  bucket: 'brevo_preference',
  windowMs: 60 * 1000,
  max: 20,
  message: { ok: false, error: 'rate_limited' },
});
const engagementRateLimit = createSharedRateLimit({
  bucket: 'marketing_engagement',
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: 'rate_limited' },
});

const isEmail = value =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const consentBrevoAttributes = evidence => ({
  CONSENT_AT: evidence.occurredAt,
  CONSENT_SOURCE: evidence.source,
  CONSENT_LOCALE: evidence.locale || '',
  CONSENT_POLICY_VERSION: evidence.policyVersion,
  ...(evidence.sharetribeUserId ? { SHARETRIBE_USER_ID: evidence.sharetribeUserId } : {}),
});

async function currentUser(req, res) {
  const sdk = getSdk(req, res);
  const response = await sdk.currentUser.show();
  return { sdk, user: userSnapshot(response?.data?.data) };
}

async function syncBrevoPreference(evidence) {
  if (evidence.enabled) {
    await upsertMarketingContact({
      email: evidence.email,
      attributes: BREVO_CONSENT_ATTRIBUTES_ENABLED ? consentBrevoAttributes(evidence) : {},
    });
  } else {
    await removeMarketingContact(evidence.email);
  }
}

router.post('/subscribe', subscribeRateLimit, async (req, res) => {
  try {
    const { email, hp, source, locale, policyVersion } = req.body || {};
    if (hp) return res.status(200).json({ ok: true });
    if (!isEmail(email)) return res.status(400).json({ ok: false, error: 'invalid_email' });

    let sharetribeUserId = null;
    try {
      ({
        user: { id: sharetribeUserId },
      } = await currentUser(req, res));
    } catch (err) {
      // Footer subscriptions may be anonymous.
    }
    const evidence = {
      email: normalizeEmail(email),
      enabled: true,
      source: source === 'footer_newsletter' ? source : 'footer_newsletter',
      locale: typeof locale === 'string' ? locale.slice(0, 16) : 'es',
      policyVersion:
        typeof policyVersion === 'string' && policyVersion.trim()
          ? policyVersion.trim().slice(0, 64)
          : DEFAULT_POLICY_VERSION,
      sharetribeUserId,
      ip: req.ip || null,
      occurredAt: new Date().toISOString(),
    };

    try {
      await createMarketingConsentStore().setPreference(evidence);
    } catch (err) {
      console.error('[brevo] consent record failed:', err);
      return res.status(503).json({ ok: false, error: 'consent_record_failed' });
    }
    try {
      await syncBrevoPreference(evidence);
    } catch (err) {
      console.error('[brevo] contact subscription failed:', err);
      return res.status(502).json({ ok: false, error: 'brevo_subscribe_failed' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[brevo] unexpected subscription error:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.get('/preference', async (req, res) => {
  try {
    const { user } = await currentUser(req, res);
    if (!user.id) return res.status(401).json({ ok: false, error: 'authentication_required' });
    const preference = await createMarketingConsentStore().getPreference({
      email: user.email,
      sharetribeUserId: user.id,
    });
    return res.json({
      ok: true,
      enabled: Boolean(preference?.enabled) && !preference?.suppressed,
      suppressed: Boolean(preference?.suppressed),
      email: user.email,
    });
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'authentication_required' });
  }
});

router.put('/preference', preferenceRateLimit, async (req, res) => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'enabled_must_be_boolean' });
    }
    const { sdk, user } = await currentUser(req, res);
    if (!user.id || !user.email) {
      return res.status(401).json({ ok: false, error: 'authentication_required' });
    }

    const occurredAt = new Date().toISOString();
    const evidence = {
      email: user.email,
      enabled,
      source:
        req.body?.source === 'signup_idp'
          ? 'signup_idp'
          : req.body?.source === 'signup_email'
          ? 'signup_email'
          : 'account_details',
      locale: 'es',
      policyVersion: DEFAULT_POLICY_VERSION,
      sharetribeUserId: user.id,
      ip: req.ip || null,
      occurredAt,
    };
    await createMarketingConsentStore().setPreference(evidence);
    await syncBrevoPreference(evidence);
    await sdk.currentUser.updateProfile({
      protectedData: {
        marketingConsent: enabled,
        marketingConsentAt: enabled ? occurredAt : null,
        marketingConsentWithdrawnAt: enabled ? null : occurredAt,
        marketingConsentSource: evidence.source,
        marketingConsentLocale: 'es',
        marketingConsentPolicyVersion: DEFAULT_POLICY_VERSION,
      },
    });

    return res.json({ ok: true, enabled });
  } catch (err) {
    console.error('[brevo] preference update failed:', err);
    return res.status(502).json({ ok: false, error: 'preference_update_failed' });
  }
});

router.post('/engagement', engagementRateLimit, async (req, res) => {
  try {
    const { listingId, action } = req.body || {};
    if (!listingId || !['view', 'favorite'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'invalid_engagement' });
    }
    let sdk;
    let user = {};
    try {
      ({ sdk, user } = await currentUser(req, res));
    } catch (err) {
      sdk = getSdk(req, res);
    }
    if (action === 'favorite' && !user.id) {
      return res.status(401).json({ ok: false, error: 'authentication_required' });
    }
    const listingResponse = await sdk.listings.show({
      id: listingId,
      include: ['images', 'author'],
      'fields.image': ['variants.scaled-small', 'variants.landscape-crop'],
    });
    const result = await recordListingEngagement({
      user,
      listingResource: listingResponse?.data?.data,
      included: listingResponse?.data?.included || [],
      action,
    });
    return res.json({ ok: true, recorded: Boolean(result?.recorded) });
  } catch (err) {
    console.error('[brevo] engagement tracking failed:', err);
    return res.status(502).json({ ok: false, error: 'engagement_tracking_failed' });
  }
});

function validWebhookSecret(req) {
  const configured = process.env.BREVO_WEBHOOK_SECRET || '';
  const provided = req.get('x-av-brevo-webhook-secret') || req.query.secret || '';
  const configuredBuffer = Buffer.from(configured);
  const providedBuffer = Buffer.from(String(provided));
  return (
    configuredBuffer.length > 0 &&
    configuredBuffer.length === providedBuffer.length &&
    timingSafeEqual(configuredBuffer, providedBuffer)
  );
}

router.post('/webhook', async (req, res) => {
  if (!validWebhookSecret(req)) {
    return res.status(401).json({ ok: false, error: 'invalid_webhook_secret' });
  }
  const event = req.body?.event;
  const email = req.body?.email;
  const providerMessageId = req.body?.['message-id'] || req.body?.messageId || null;
  const eventTimestamp = Number(req.body?.ts_event);
  const occurredAt = Number.isFinite(eventTimestamp)
    ? new Date(eventTimestamp * 1000).toISOString()
    : req.body?.date || new Date().toISOString();
  if (typeof event !== 'string') return res.status(204).end();

  try {
    await createBrevoWebhookStore().record({
      event,
      email,
      providerMessageId,
      occurredAt,
    });
  } catch (err) {
    console.error('[brevo] webhook delivery event failed:', err);
    return res.status(503).json({ ok: false, error: 'webhook_event_failed' });
  }

  if (!isEmail(email)) return res.status(204).end();
  const suppressionEvents = new Set([
    'unsubscribed',
    'spam',
    'hard_bounce',
    'hardBounce',
    'blocked',
  ]);
  if (!suppressionEvents.has(event)) return res.status(204).end();

  try {
    await createMarketingConsentStore().setPreference({
      email,
      enabled: false,
      suppressed: true,
      source: 'brevo_webhook',
      locale: 'es',
      policyVersion: DEFAULT_POLICY_VERSION,
    });
    return res.status(204).end();
  } catch (err) {
    console.error('[brevo] webhook suppression failed:', err);
    return res.status(503).json({ ok: false, error: 'suppression_failed' });
  }
});

router.get('/health', (_req, res) => {
  const { brevo, campaigns, poller } = getNotificationConfigReadiness();
  const ready = brevo.ready && campaigns.ready;
  return res.status(ready ? 200 : 503).json({
    ready,
    enabled: brevo.enabled || campaigns.enabled,
    intentionallyDisabled: poller.configured && !poller.enabled,
    missing: [...brevo.missing, ...campaigns.missing],
  });
});

module.exports = router;
