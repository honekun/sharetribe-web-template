'use strict';

const { randomUUID } = require('crypto');
const { getPostgresPool } = require('./postgres');

const TERMINAL_STATUSES = new Set(['purchased', 'failed', 'unknown']);
const DEFAULT_STALE_CLAIM_MINUTES = 15;

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

class ShippingLabelStore {
  constructor(pool) {
    this.pool = pool;
  }

  async claim({ transactionId, rateId, claimedBy, force = false, confirmUnknown = false }) {
    const staleClaimMinutes = positiveInteger(
      process.env.AV_SHIPPING_LABEL_STALE_CLAIM_MINUTES,
      DEFAULT_STALE_CLAIM_MINUTES
    );

    // A process can die after eShip accepts a purchase but before the response
    // is recorded. Such stale claims become unknown and require an operator to
    // reconcile the eShip dashboard before confirming a retry.
    await this.pool.query(
      `UPDATE av_shipping_label_attempts
       SET status = 'unknown',
           last_error = COALESCE(last_error, 'Purchase interrupted; verify in eShip before retry'),
           finished_at = NOW(),
           updated_at = NOW()
       WHERE transaction_id = $1
         AND status = 'processing'
         AND claimed_at < NOW() - MAKE_INTERVAL(mins => $2::integer)`,
      [transactionId, staleClaimMinutes]
    );

    const claimToken = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO av_shipping_label_attempts (
         transaction_id,
         rate_id,
         status,
         attempt_count,
         claim_token,
         claimed_by,
         claimed_at,
         updated_at
       )
       VALUES ($1, $2, 'processing', 1, $3, $4, NOW(), NOW())
       ON CONFLICT (transaction_id) DO UPDATE
       SET rate_id = EXCLUDED.rate_id,
           status = 'processing',
           attempt_count = av_shipping_label_attempts.attempt_count + 1,
           claim_token = EXCLUDED.claim_token,
           claimed_by = EXCLUDED.claimed_by,
           claimed_at = NOW(),
           finished_at = NULL,
           shipment_data = NULL,
           last_error = NULL,
           updated_at = NOW()
       WHERE av_shipping_label_attempts.rate_id = EXCLUDED.rate_id
         AND (
           (av_shipping_label_attempts.status = 'failed' AND $5::boolean)
           OR (av_shipping_label_attempts.status = 'unknown' AND $6::boolean)
         )
       RETURNING transaction_id, rate_id, status, claim_token, attempt_count`,
      [transactionId, rateId, claimToken, claimedBy, force, confirmUnknown]
    );
    return result.rows[0] || null;
  }

  async finish(transactionId, claimToken, { status, shipmentData = null, error = null }) {
    if (!TERMINAL_STATUSES.has(status)) {
      throw new Error(`Invalid terminal shipping label status: ${status}`);
    }
    const result = await this.pool.query(
      `UPDATE av_shipping_label_attempts
       SET status = $3,
           shipment_data = $4::jsonb,
           last_error = $5,
           finished_at = NOW(),
           updated_at = NOW()
       WHERE transaction_id = $1
         AND claim_token = $2
         AND status = 'processing'`,
      [transactionId, claimToken, status, shipmentData ? JSON.stringify(shipmentData) : null, error]
    );
    if (result.rowCount !== 1) {
      throw new Error(`Shipping label claim ${transactionId} is no longer active`);
    }
  }

  async get(transactionId) {
    const result = await this.pool.query(
      `SELECT transaction_id, rate_id, status, attempt_count, claimed_by, claimed_at,
              finished_at, shipment_data, last_error, created_at, updated_at
       FROM av_shipping_label_attempts
       WHERE transaction_id = $1`,
      [transactionId]
    );
    return result.rows[0] || null;
  }
}

function createShippingLabelStore(pool = getPostgresPool()) {
  return new ShippingLabelStore(pool);
}

module.exports = {
  DEFAULT_STALE_CLAIM_MINUTES,
  ShippingLabelStore,
  createShippingLabelStore,
};
