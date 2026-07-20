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
    await this.pool.query(
      `INSERT INTO av_brevo_webhook_events (
         provider_message_id, event, email_hash, occurred_at
       )
       VALUES ($1, $2, $3, $4)`,
      [providerMessageId, event, emailHash, timestamp]
    );
    if (providerMessageId) {
      await this.pool.query(
        `UPDATE av_notification_deliveries
         SET provider_status = $2, provider_status_at = $3, updated_at = NOW()
         WHERE provider_message_id = $1`,
        [providerMessageId, event, timestamp]
      );
    }
  }
}

function createBrevoWebhookStore(pool = getPostgresPool()) {
  return new BrevoWebhookStore(pool);
}

module.exports = { BrevoWebhookStore, createBrevoWebhookStore };
