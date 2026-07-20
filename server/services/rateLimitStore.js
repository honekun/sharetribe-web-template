'use strict';

// Shared, durable rate limiter backed by PostgreSQL (BR-07). Unlike the in-memory
// limiter, its counters are consistent across web processes and survive restarts,
// so the effective limit holds when scaling past one dyno.
//
// Fixed-window algorithm: each (bucket, identifier) gets one counter row per time
// window. A request increments the current window's counter atomically and is
// limited once the count exceeds `max`. Expired windows are cleaned opportunistically
// so the table stays bounded without a scheduled job.

const { getPostgresPool } = require('./postgres');

// Probability of running the global expired-window cleanup on any given request.
const CLEANUP_PROBABILITY = 0.02;

function windowStartMs(nowMs, windowMs) {
  return Math.floor(nowMs / windowMs) * windowMs;
}

class PostgresRateLimiter {
  constructor(pool, { bucket, windowMs, max }) {
    this.pool = pool;
    this.bucket = bucket;
    this.windowMs = windowMs;
    this.max = max;
  }

  // Atomically count this hit in the current window. Returns
  // { limited, count, resetAt }.
  async hit(identifier, nowMs = Date.now()) {
    const start = new Date(windowStartMs(nowMs, this.windowMs));
    const result = await this.pool.query(
      `INSERT INTO av_rate_limit (bucket, identifier, window_start, count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (bucket, identifier, window_start)
       DO UPDATE SET count = av_rate_limit.count + 1
       RETURNING count`,
      [this.bucket, identifier, start]
    );
    const count = result.rows[0].count;

    // Opportunistically drop windows that can no longer be current, keeping the
    // table bounded regardless of how many distinct identifiers appear. Best-effort
    // and never blocks or fails the request.
    if (Math.random() < CLEANUP_PROBABILITY) {
      const expiry = new Date(nowMs - this.windowMs * 2);
      this.pool
        .query(`DELETE FROM av_rate_limit WHERE window_start < $1`, [expiry])
        .catch(() => {});
    }

    return {
      limited: count > this.max,
      count,
      resetAt: new Date(start.getTime() + this.windowMs),
    };
  }
}

// Express middleware factory. Signature mirrors the in-memory createRateLimiter so
// callers can swap it in. `bucket` namespaces the counters (e.g. 'brevo_subscribe').
// The identifier is the derived client IP. Fails OPEN: if the store errors (e.g.
// PostgreSQL unavailable) the request proceeds, since rate limiting is best-effort
// abuse control rather than a security gate. The limiter is built lazily so the
// module can load without a database connection.
function createSharedRateLimit({ bucket, windowMs, max, message }, makeLimiter) {
  let limiter = null;
  const build =
    makeLimiter || (() => new PostgresRateLimiter(getPostgresPool(), { bucket, windowMs, max }));
  return async (req, res, next) => {
    try {
      if (!limiter) limiter = build();
      const { limited } = await limiter.hit(req.ip || 'unknown');
      if (limited) return res.status(429).json(message);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[rateLimit] shared store error, failing open:', e.message);
    }
    return next();
  };
}

module.exports = { PostgresRateLimiter, createSharedRateLimit, windowStartMs };
