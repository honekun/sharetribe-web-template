'use strict';

const { createHash } = require('crypto');

const { getPostgresPool } = require('./postgres');
const { normalizeEmail } = require('./emailAddress');

class BrevoWebhookStore {
  constructor(pool) {
    this.pool = pool;
  }

  async record({ event, email = null, providerMessageId = null, occurredAt }) {
    const normalizedEmail = normalizeEmail(email);
    const emailHash = normalizedEmail
      ? createHash('sha256')
          .update(normalizedEmail)
          .digest('hex')
      : null;
    const timestamp = occurredAt || new Date().toISOString();

    // One transaction so the event log and the delivery-status update can't
    // diverge. The event insert is idempotent (Brevo may deliver a webhook more
    // than once) via a partial unique index on (provider_message_id, event) — see
    // migration 006. Rows without a provider message id aren't deduped (append).
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO av_brevo_webhook_events (
           provider_message_id, event, email_hash, occurred_at
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (provider_message_id, event)
           WHERE provider_message_id IS NOT NULL DO NOTHING`,
        [providerMessageId, event, emailHash, timestamp]
      );
      if (providerMessageId) {
        await client.query(
          `UPDATE av_notification_deliveries
           SET provider_status = $2, provider_status_at = $3, updated_at = NOW()
           WHERE provider_message_id = $1`,
          [providerMessageId, event, timestamp]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

function createBrevoWebhookStore(pool = getPostgresPool()) {
  return new BrevoWebhookStore(pool);
}

module.exports = { BrevoWebhookStore, createBrevoWebhookStore };
