const express = require('express');
const fetch = require('node-fetch');
const { createSharedRateLimit } = require('../services/rateLimitStore');
const { getNotificationConfigReadiness } = require('../services/notificationConfig');
const { createNewsletterConsentStore } = require('../services/newsletterConsent');
const { getSdk } = require('../api-util/sdk');

const router = express.Router();
// Shared PostgreSQL-backed limiter (BR-07): consistent across web processes and
// durable across restarts. Keyed on the derived client IP; fails open if the store
// is unavailable.
const subscribeRateLimit = createSharedRateLimit({
  bucket: 'brevo_subscribe',
  windowMs: 60 * 1000,
  max: 20,
  message: { ok: false, error: 'rate_limited' },
});

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = process.env.BREVO_LIST_ID;

// Version of the marketing-consent copy the footer shows (NewsletterForm.disclaimerText).
// The client sends the version it rendered; this is the server-side fallback. Bump
// both when the consent notice changes so evidence stays traceable to the wording
// the user actually agreed to (BR-03).
const DEFAULT_CONSENT_POLICY_VERSION = '2026-07-17';

// Mirror consent evidence into typed Brevo contact attributes. Off by default: the
// attributes (CONSENT_AT, CONSENT_SOURCE, CONSENT_LOCALE, CONSENT_POLICY_VERSION,
// SHARETRIBE_USER_ID) must first be created in Brevo, or the contact upsert would
// fail. The authoritative record always lives in PostgreSQL regardless. See
// docs/brevo-integration-guide.md.
const BREVO_CONSENT_ATTRIBUTES_ENABLED = process.env.BREVO_CONSENT_ATTRIBUTES_ENABLED === 'true';

if (!BREVO_API_KEY || !BREVO_LIST_ID) {
  // Fail fast on boot if misconfigured.
  // eslint-disable-next-line no-console
  console.warn('Brevo env missing: BREVO_API_KEY and/or BREVO_LIST_ID');
}

// Basic email sanity check.
const isEmail = str => typeof str === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

// Best-effort resolution of the signed-in Sharetribe user from the session cookie.
// Most footer signups are anonymous; a lookup failure means "no user id", never a
// subscription failure.
const resolveSharetribeUserId = async (req, res) => {
  try {
    const sdk = getSdk(req, res);
    const response = await sdk.currentUser.show();
    return response?.data?.data?.id?.uuid || null;
  } catch (e) {
    return null;
  }
};

// Consent-evidence attributes for Brevo (only sent when the account has them defined).
const consentBrevoAttributes = evidence => ({
  CONSENT_AT: evidence.consentAt,
  CONSENT_SOURCE: evidence.source,
  CONSENT_LOCALE: evidence.locale || '',
  CONSENT_POLICY_VERSION: evidence.policyVersion,
  ...(evidence.sharetribeUserId ? { SHARETRIBE_USER_ID: evidence.sharetribeUserId } : {}),
});

router.post('/subscribe', subscribeRateLimit, async (req, res) => {
  try {
    const { email, hp, source, locale, policyVersion } = req.body || {};

    // Honeypot: if hp has a value, it’s a bot.
    if (hp) return res.status(200).json({ ok: true });

    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }

    // Capture single-opt-in consent evidence (BR-03). userId and IP are derived
    // server-side (never trusted from the client); the client supplies the source,
    // locale, and the version of the consent copy it displayed.
    const evidence = {
      email: email.trim(),
      consentAt: new Date().toISOString(),
      source,
      locale: typeof locale === 'string' ? locale.slice(0, 16) : null,
      policyVersion:
        typeof policyVersion === 'string' && policyVersion.trim()
          ? policyVersion.trim().slice(0, 64)
          : DEFAULT_CONSENT_POLICY_VERSION,
      sharetribeUserId: await resolveSharetribeUserId(req, res),
      ip: req.ip || null,
    };

    // Record the authoritative first-party consent evidence BEFORE the contact is
    // added to the campaign list. If this fails we do not subscribe — a campaign
    // contact must always have traceable consent (fail closed).
    try {
      await createNewsletterConsentStore().record(evidence);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[brevo] consent record failed', { email: evidence.email, error: e.message });
      return res.status(503).json({ ok: false, error: 'consent_record_failed' });
    }

    // Create/update the contact AND add it to the list in one atomic call
    // (BR-05/BR-06). `listIds` with `updateEnabled: true` makes membership
    // idempotent via a supported API pattern: a new contact is created and listed,
    // an existing contact is updated and listed, and an already-listed contact is a
    // no-op. There is no separate add-to-list step to leave a partial-success window
    // (BR-06) or to mask an unrelated error as "already subscribed" (BR-05).
    const r = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
        accept: 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        updateEnabled: true,
        listIds: [Number(BREVO_LIST_ID)],
        ...(BREVO_CONSENT_ATTRIBUTES_ENABLED
          ? { attributes: consentBrevoAttributes(evidence) }
          : {}),
      }),
    });

    // 201 created / 204 updated are success. Any 4xx/5xx is a real failure — surface
    // it (never mask), keeping the raw provider detail server-side only.
    if (r.status >= 400) {
      const j = await r.json().catch(() => ({}));
      // eslint-disable-next-line no-console
      console.error('[brevo] subscribe failed', { status: r.status, email: email.trim(), body: j });
      return res.status(502).json({ ok: false, error: 'brevo_subscribe_failed' });
    }

    return res.json({ ok: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[brevo] unexpected error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.get('/health', (_req, res) => {
  const { brevo, poller } = getNotificationConfigReadiness();
  return res.status(brevo.ready ? 200 : 503).json({
    ready: brevo.ready,
    enabled: brevo.enabled,
    intentionallyDisabled: poller.configured && !poller.enabled,
    missing: brevo.missing,
  });
});

module.exports = router;
