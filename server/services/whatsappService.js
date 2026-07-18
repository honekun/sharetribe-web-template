'use strict';

const fetch = require('node-fetch');
const { createTTLCache } = require('../api-util/cache');
const {
  localDeliveryFailure,
  rejectedProviderRequest,
  unknownProviderOutcome,
} = require('./notificationProviderError');

// User phones change rarely; 3 minutes hides repeat lookups during an event
// burst without leaking stale data for long.
const PHONE_CACHE_TTL_SECONDS = 180;
const userPhoneCache = createTTLCache(PHONE_CACHE_TTL_SECONDS);

// Normalize a phone number to strict E.164: leading "+" then digits only.
// Strips any whitespace, hyphens, parentheses, dots, etc. Preserves a leading "+".
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ADMIN_PHONE = process.env.WHATSAPP_ADMIN_PHONE;

const API_URL = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

/**
 * Core WhatsApp sender — all public functions call this.
 *
 * @param {{ phone: string, templateName: string, params: string[] }} opts
 *   phone        — E.164 format, e.g. "+521XXXXXXXXXX"
 *   templateName — pre-approved Meta template name
 *   params       — ordered list of {{1}}, {{2}}, … replacements
 *   languageCode — BCP-47, default "es_MX"
 */
async function sendWhatsApp({ phone, templateName, params = [], languageCode = 'es_MX' }) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    throw localDeliveryFailure(
      'WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be configured'
    );
  }

  if (!phone) {
    throw localDeliveryFailure(`No phone supplied for template ${templateName}`);
  }

  const components =
    params.length > 0
      ? [
          {
            type: 'body',
            parameters: params.map(text => ({ type: 'text', text: String(text) })),
          },
        ]
      : [];

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizePhone(phone),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw unknownProviderOutcome('WhatsApp request ended without a provider response', err);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    console.error(
      `[whatsappService] Meta API error for template "${templateName}":`,
      response.status,
      body
    );
    throw rejectedProviderRequest(`WhatsApp API failed: ${response.status}`, response.status);
  }

  const body = await response.json().catch(() => ({}));
  console.log(`[whatsappService] Sent template "${templateName}" to ${phone}`);
  return { providerMessageId: body.messages?.[0]?.id || null };
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/**
 * Alert the marketplace admin about a new user.
 */
async function sendAdminAlert({ firstName, lastName, email }) {
  if (!ADMIN_PHONE) {
    throw localDeliveryFailure('WHATSAPP_ADMIN_PHONE is not configured');
  }
  return sendWhatsApp({
    phone: ADMIN_PHONE,
    templateName: 'av_admin_new_user',
    params: [firstName, lastName, email],
  });
}

function getAdminPhone() {
  return ADMIN_PHONE || null;
}

/**
 * Send a WhatsApp to a user.
 */
async function sendUserWhatsApp({ phone, templateName, params = [] }) {
  if (!phone) {
    throw localDeliveryFailure(`No phone supplied for template ${templateName}`);
  }
  return sendWhatsApp({ phone, templateName, params });
}

/**
 * Fetch a user's phone from their protectedData via the Integration SDK.
 * Returns null if unavailable or on error.
 *
 * @param {object} integrationSdk — instantiated sharetribe-flex-integration-sdk
 * @param {string} userId
 */
async function lookupUserPhone(integrationSdk, userId) {
  if (!userId) return null;

  // Cache hit — including cached `null` for phoneless users to avoid retrying
  // the SDK on every event for the same user.
  const { data: cached } = userPhoneCache[userId] || {};
  if (cached !== undefined && cached !== null) {
    // Sentinel to distinguish "cached null" from "cache miss" since the proxy
    // returns null on miss. We store the value in a wrapper below.
    if (cached.phone !== undefined) return cached.phone;
  }

  try {
    const res = await integrationSdk.users.show({ id: userId });
    const phone = res?.data?.data?.attributes?.profile?.protectedData?.phoneNumber || null;
    userPhoneCache[userId] = { phone };
    return phone;
  } catch (err) {
    // Don't cache transient errors — a retry on the next event might succeed.
    console.warn(`[whatsappService] Could not fetch phone for user ${userId}:`, err.message);
    return null;
  }
}

module.exports = {
  sendWhatsApp,
  sendAdminAlert,
  sendUserWhatsApp,
  lookupUserPhone,
  getAdminPhone,
};
