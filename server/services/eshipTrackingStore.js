'use strict';

const { randomUUID } = require('crypto');
const { getPostgresPool } = require('./postgres');

const DEFAULT_STALE_CLAIM_MINUTES = 20;
const DEFAULT_MAX_ATTEMPTS = 8;

class EshipTrackingStore {
  constructor(pool) {
    this.pool = pool;
  }

  async enqueue({ shipmentId, eventType, eventAt = null, trackingNumber = null }) {
    const inserted = await this.pool.query(
      `INSERT INTO av_eship_tracking_notifications (
         shipment_id, event_type, event_at, webhook_tracking_number
       )
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (shipment_id, event_type) DO NOTHING
       RETURNING id, shipment_id, event_type, status, attempt_count`,
      [shipmentId, eventType, eventAt, trackingNumber]
    );
    if (inserted.rows[0]) return { ...inserted.rows[0], duplicate: false };

    const existing = await this.pool.query(
      `SELECT id, shipment_id, event_type, status, attempt_count
       FROM av_eship_tracking_notifications
       WHERE shipment_id = $1 AND event_type = $2`,
      [shipmentId, eventType]
    );
    return existing.rows[0] ? { ...existing.rows[0], duplicate: true } : null;
  }

  async claimNext({ claimedBy, maxAttempts = DEFAULT_MAX_ATTEMPTS }) {
    const claimToken = randomUUID();
    const result = await this.pool.query(
      `WITH candidate AS (
         SELECT id
         FROM av_eship_tracking_notifications
         WHERE attempt_count < $3
           AND (
             (status IN ('pending', 'failed') AND next_attempt_at <= NOW())
             OR (
               status = 'processing'
               AND claimed_at < NOW() - ($4 * INTERVAL '1 minute')
             )
           )
         ORDER BY next_attempt_at ASC, created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE av_eship_tracking_notifications AS notification
       SET status = 'processing',
           attempt_count = notification.attempt_count + 1,
           claim_token = $1,
           claimed_by = $2,
           claimed_at = NOW(),
           last_error = NULL,
           updated_at = NOW()
       FROM candidate
       WHERE notification.id = candidate.id
       RETURNING notification.*`,
      [claimToken, claimedBy, maxAttempts, DEFAULT_STALE_CLAIM_MINUTES]
    );
    return result.rows[0] || null;
  }

  async findTransactionByShipmentId(shipmentId) {
    const result = await this.pool.query(
      `SELECT transaction_id
       FROM av_shipping_label_attempts
       WHERE status = 'purchased'
         AND shipment_data->>'shipmentId' = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [shipmentId]
    );
    return result.rows[0]?.transaction_id || null;
  }

  async markSent(id, claimToken, transactionId) {
    return this.finish(id, claimToken, {
      status: 'sent',
      transactionId,
      terminalColumn: 'sent_at',
    });
  }

  async markIgnored(id, claimToken, { transactionId = null, reason }) {
    return this.finish(id, claimToken, {
      status: 'ignored',
      transactionId,
      error: reason,
      terminalColumn: 'ignored_at',
    });
  }

  async markFailed(id, claimToken, { transactionId = null, error, retryDelaySeconds }) {
    const result = await this.pool.query(
      `UPDATE av_eship_tracking_notifications
       SET status = 'failed',
           transaction_id = COALESCE($3, transaction_id),
           last_error = $4,
           next_attempt_at = NOW() + ($5 * INTERVAL '1 second'),
           claim_token = NULL,
           claimed_by = NULL,
           claimed_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND claim_token = $2 AND status = 'processing'`,
      [id, claimToken, transactionId, error, retryDelaySeconds]
    );
    if (result.rowCount !== 1) throw new Error(`eShip tracking claim ${id} is no longer active`);
  }

  async finish(id, claimToken, { status, transactionId, error = null, terminalColumn }) {
    if (!['sent_at', 'ignored_at'].includes(terminalColumn)) {
      throw new Error('Invalid eShip tracking terminal timestamp column');
    }
    const result = await this.pool.query(
      `UPDATE av_eship_tracking_notifications
       SET status = $3,
           transaction_id = COALESCE($4, transaction_id),
           last_error = $5,
           ${terminalColumn} = NOW(),
           claim_token = NULL,
           claimed_by = NULL,
           claimed_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND claim_token = $2 AND status = 'processing'`,
      [id, claimToken, status, transactionId, error]
    );
    if (result.rowCount !== 1) throw new Error(`eShip tracking claim ${id} is no longer active`);
  }
}

function createEshipTrackingStore(pool = getPostgresPool()) {
  return new EshipTrackingStore(pool);
}

module.exports = {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_STALE_CLAIM_MINUTES,
  EshipTrackingStore,
  createEshipTrackingStore,
};
