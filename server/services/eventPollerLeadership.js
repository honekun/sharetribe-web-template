'use strict';

const { randomUUID } = require('crypto');
const os = require('os');

const { getPostgresPool } = require('./postgres');

// Stable, application-specific 64-bit advisory-lock key ("AV notification poller").
const ADVISORY_LOCK_ID = 731747821;

function createOwnerId() {
  const platformInstance =
    process.env.DYNO || process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || os.hostname();
  return `${platformInstance}:${process.pid}`;
}

class EventPollerLeadership {
  constructor({ pool, ownerId = createOwnerId(), logger = console }) {
    this.pool = pool;
    this.ownerId = ownerId;
    this.leaseId = null;
    this.logger = logger;
    this.client = null;
    this.clientErrorHandler = null;
    this.lossHandlers = new Set();
    this.hasLoggedStandby = false;
  }

  isLeader() {
    return Boolean(this.client);
  }

  onLeadershipLost(handler) {
    this.lossHandlers.add(handler);
    return () => this.lossHandlers.delete(handler);
  }

  async tryAcquire() {
    if (this.client) return true;

    const candidate = await this.pool.connect();
    try {
      const result = await candidate.query('SELECT pg_try_advisory_lock($1::bigint) AS acquired', [
        ADVISORY_LOCK_ID,
      ]);
      if (!result.rows[0]?.acquired) {
        candidate.release();
        if (!this.hasLoggedStandby) {
          this.logger.log(
            `[eventPoller] Standby owner=${this.ownerId}; PostgreSQL leader lock is held elsewhere`
          );
          this.hasLoggedStandby = true;
        }
        return false;
      }

      this.client = candidate;
      this.leaseId = `${this.ownerId}:${randomUUID()}`;
      this.clientErrorHandler = err => this.handleConnectionError(candidate, err);
      this.hasLoggedStandby = false;
      candidate.on('error', this.clientErrorHandler);
      this.logger.log(
        `[eventPoller] Leadership acquired owner=${this.leaseId} lock=${ADVISORY_LOCK_ID}`
      );
      return true;
    } catch (err) {
      candidate.release(err);
      throw err;
    }
  }

  handleConnectionError(candidate, err) {
    if (this.client !== candidate) return;

    const lostLeaseId = this.leaseId;
    this.client = null;
    this.leaseId = null;
    this.clientErrorHandler = null;
    candidate.release(err);
    this.logger.error(
      `[eventPoller] Leadership lost owner=${lostLeaseId}; PostgreSQL connection failed:`,
      err
    );
    for (const handler of this.lossHandlers) {
      try {
        handler(err);
      } catch (handlerError) {
        this.logger.error('[eventPoller] Leadership-loss handler failed:', handlerError);
      }
    }
  }

  async release() {
    const client = this.client;
    if (!client) return;

    const releasedLeaseId = this.leaseId;
    this.client = null;
    this.leaseId = null;
    if (this.clientErrorHandler) client.removeListener('error', this.clientErrorHandler);
    this.clientErrorHandler = null;
    let releaseError = null;
    try {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_ID]);
      this.logger.log(`[eventPoller] Leadership released owner=${releasedLeaseId}`);
    } catch (err) {
      releaseError = err;
      throw err;
    } finally {
      // Destroy the session if unlock failed; returning it to the pool could
      // strand a session-level lock with no coordinator holding the client.
      client.release(releaseError);
    }
  }
}

let leadership = null;

function getLeadership() {
  if (!leadership) {
    leadership = new EventPollerLeadership({
      pool: getPostgresPool(),
    });
  }
  return leadership;
}

module.exports = {
  ADVISORY_LOCK_ID,
  EventPollerLeadership,
  createOwnerId,
  getLeadership,
};
