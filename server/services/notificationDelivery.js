'use strict';

const { createHash, randomUUID } = require('crypto');

const { sendBrevoEmail } = require('./brevoEmailService');
const { sendWelcomeEmail } = require('./welcomeEmailService');
const { sendUserWhatsApp } = require('./whatsappService');
const { isWhatsAppEnabled } = require('./notificationConfig');
const { getPostgresPool } = require('./postgres');
const { recordDelivery } = require('./notificationMetrics');
const { localDeliveryFailure } = require('./notificationProviderError');
const { withRetry } = require('./retry');

const TERMINAL_STATUSES = new Set(['sent', 'failed', 'unknown']);
const DEFAULT_STALE_CLAIM_MINUTES = 15;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRecipient(recipient) {
  const value = String(recipient || '').trim();
  if (value.includes('@')) return value.toLowerCase();
  const digits = value.replace(/\D/g, '');
  return digits ? `+${digits}` : value.toLowerCase();
}

function notificationKey({ eventId, channel, templateName, recipient }) {
  return createHash('sha256')
    .update([eventId, channel, templateName, normalizeRecipient(recipient)].join('\0'))
    .digest('hex');
}

function recipientHint(recipient) {
  const value = String(recipient || '');
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  return digits ? `***${digits.slice(-4)}` : 'unknown';
}

class NotificationDeliveryStore {
  constructor(pool) {
    this.pool = pool;
  }

  async claim(delivery, claimedBy) {
    const key = notificationKey(delivery);
    const claimToken = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO av_notification_deliveries (
         notification_key,
         event_id,
         channel,
         template_name,
         recipient_hash,
         recipient_hint,
         delivery_payload,
         status,
         attempt_count,
         claim_token,
         claimed_by,
         claimed_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'processing', 1, $8, $9, NOW(), NOW())
       ON CONFLICT (notification_key) DO UPDATE
       SET status = 'processing',
           attempt_count = av_notification_deliveries.attempt_count + 1,
           claim_token = EXCLUDED.claim_token,
           claimed_by = EXCLUDED.claimed_by,
           claimed_at = NOW(),
           last_error = NULL,
           updated_at = NOW()
       WHERE av_notification_deliveries.status = 'pending'
       RETURNING notification_key, claim_token, status`,
      [
        key,
        delivery.eventId,
        delivery.channel,
        delivery.templateName,
        createHash('sha256')
          .update(normalizeRecipient(delivery.recipient))
          .digest('hex'),
        recipientHint(delivery.recipient),
        JSON.stringify(delivery.payload),
        claimToken,
        claimedBy,
      ]
    );

    return result.rows[0] || null;
  }

  async finish(key, claimToken, { status, providerMessageId = null, error = null }) {
    if (!TERMINAL_STATUSES.has(status)) {
      throw new Error(`Invalid terminal notification status: ${status}`);
    }
    const result = await this.pool.query(
      `UPDATE av_notification_deliveries
       SET status = $3,
           provider_message_id = $4,
           last_error = $5,
           finished_at = NOW(),
           updated_at = NOW()
       WHERE notification_key = $1
         AND claim_token = $2
         AND status = 'processing'`,
      [key, claimToken, status, providerMessageId, error]
    );
    if (result.rowCount !== 1) {
      throw new Error(`Notification claim ${key} is no longer active`);
    }
  }

  async list({ status = null, limit = 50 } = {}) {
    const result = await this.pool.query(
      `SELECT notification_key, event_id, channel, template_name, recipient_hint, status,
              attempt_count, claimed_by, claimed_at, finished_at, provider_message_id,
              provider_status, provider_status_at, last_error, created_at, updated_at
       FROM av_notification_deliveries
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [status, limit]
    );
    return result.rows;
  }

  async prepareRetry(key, { confirmUnknown = false } = {}) {
    const staleClaimMinutes = positiveInteger(
      process.env.AV_NOTIFICATION_STALE_CLAIM_MINUTES,
      DEFAULT_STALE_CLAIM_MINUTES
    );
    const result = await this.pool.query(
      `UPDATE av_notification_deliveries
       SET status = 'pending',
           claim_token = NULL,
           claimed_by = NULL,
           claimed_at = NULL,
           finished_at = NULL,
           updated_at = NOW()
       WHERE notification_key = $1
         AND (
           status IN ('failed', 'pending')
           OR (
             $2::boolean
             AND (
               status = 'unknown'
               OR (
                 status = 'processing'
                 AND claimed_at < NOW() - MAKE_INTERVAL(mins => $3::integer)
               )
             )
           )
         )
       RETURNING notification_key, event_id, channel, template_name, recipient_hint,
                 delivery_payload, status`,
      [key, confirmUnknown, staleClaimMinutes]
    );
    return result.rows[0] || null;
  }

  async get(key) {
    const result = await this.pool.query(
      `SELECT notification_key, event_id, channel, template_name, recipient_hint,
              delivery_payload, status
       FROM av_notification_deliveries
       WHERE notification_key = $1`,
      [key]
    );
    return result.rows[0] || null;
  }
}

function createDeliveryStore(pool = getPostgresPool()) {
  return new NotificationDeliveryStore(pool);
}

async function sendPayload(channel, payload) {
  if (channel === 'brevo') {
    // Rows created before generic template support contain the legacy welcome
    // shape. Keep them operator-retryable while routing all new sends through
    // the generic Brevo template client.
    return payload.templateId ? sendBrevoEmail(payload) : sendWelcomeEmail(payload);
  }
  if (channel === 'whatsapp') {
    if (!isWhatsAppEnabled()) {
      throw localDeliveryFailure('WhatsApp notifications are disabled for the first release');
    }
    return sendUserWhatsApp(payload);
  }
  throw localDeliveryFailure(`Unsupported notification channel: ${channel}`);
}

async function deliverNotification(delivery, claimedBy, store = createDeliveryStore()) {
  const claim = await store.claim(delivery, claimedBy);
  if (!claim) {
    recordDelivery(delivery.channel, 'deduplicated');
    console.log(
      `[notificationDelivery] Deduplicated event=${delivery.eventId} channel=${delivery.channel} template=${delivery.templateName}`
    );
    return { status: 'deduplicated' };
  }

  try {
    const result = await withRetry(() => sendPayload(delivery.channel, delivery.payload), {
      label: `${delivery.channel}:${delivery.templateName}`,
      shouldRetry: err => err.notificationOutcome === 'failed' && err.retryable === true,
    });
    await store.finish(claim.notification_key, claim.claim_token, {
      status: 'sent',
      providerMessageId: result?.providerMessageId || null,
    });
    recordDelivery(delivery.channel, 'sent');
    return { status: 'sent' };
  } catch (err) {
    const deliveryError = err instanceof Error ? err : new Error(String(err));
    const status = deliveryError.notificationOutcome === 'failed' ? 'failed' : 'unknown';
    await store.finish(claim.notification_key, claim.claim_token, {
      status,
      error: deliveryError.message.slice(0, 2000),
    });
    recordDelivery(delivery.channel, status);
    deliveryError.notificationOutcomeRecorded = true;
    throw deliveryError;
  }
}

async function retryNotification(
  key,
  { confirmUnknown = false, claimedBy = 'operator' } = {},
  store = createDeliveryStore()
) {
  const prepared = await store.prepareRetry(key, { confirmUnknown });
  if (!prepared) return null;

  const payload = prepared.delivery_payload;
  const recipient =
    prepared.channel === 'brevo' ? payload.email : payload.phone || prepared.recipient_hint;
  return deliverNotification(
    {
      eventId: prepared.event_id,
      channel: prepared.channel,
      templateName: prepared.template_name,
      recipient,
      payload,
    },
    claimedBy,
    store
  );
}

module.exports = {
  DEFAULT_STALE_CLAIM_MINUTES,
  NotificationDeliveryStore,
  createDeliveryStore,
  deliverNotification,
  normalizeRecipient,
  notificationKey,
  recipientHint,
  retryNotification,
};
