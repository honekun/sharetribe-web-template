'use strict';

const fetch = require('node-fetch');

const { getPostgresPool } = require('./postgres');

const GRAPH_BASE = 'https://graph.instagram.com';
const TOKEN_NAME = 'default';

// Instagram long-lived tokens last 60 days and can only be refreshed while still
// valid, so refresh with plenty of runway: a Render free-tier service can sleep
// for days, and every missed window is unrecoverable — the token then has to be
// re-minted by hand in the Meta dashboard (as it did on 2026-06-26).
const REFRESH_WHEN_DAYS_LEFT = 20;

// Instagram refuses to refresh a token less than 24 hours old.
const MIN_TOKEN_AGE_HOURS = 24;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIFETIME_DAYS = 60;

const isExpiredTokenError = body => {
  const error = body && body.error;
  return !!error && (error.code === 190 || error.type === 'OAuthException');
};

/**
 * Keeps the Instagram access token alive.
 *
 * The env var `INSTAGRAM_ACCESS_TOKEN` is only a seed: the working token lives in
 * Postgres (`av_instagram_token`) so a refreshed value survives restarts, which
 * an env var cannot do. Every failure path degrades to the seed rather than
 * throwing — the Instagram feed is decorative and must never take a page down.
 */
class InstagramTokenService {
  constructor({ pool, envToken, fetchImpl = fetch, now = () => new Date() } = {}) {
    this.pool = pool || getPostgresPool();
    this.envToken = (envToken == null ? process.env.INSTAGRAM_ACCESS_TOKEN : envToken) || '';
    this.fetchImpl = fetchImpl;
    this.now = now;
    // Survives a Postgres write failure for the life of the process.
    this.memoryToken = null;
  }

  async readStored() {
    try {
      const { rows } = await this.pool.query(
        `SELECT access_token, expires_at, refreshed_at
           FROM av_instagram_token
          WHERE token_name = $1`,
        [TOKEN_NAME]
      );
      return rows[0] || null;
    } catch (err) {
      console.error(
        '[instagram] Could not read the stored token, using the env seed:',
        err.message
      );
      return null;
    }
  }

  /**
   * The token the API route should use: stored first, then anything refreshed in
   * memory, then the env seed. Null when nothing is configured.
   */
  async getAccessToken() {
    const stored = await this.readStored();
    return stored?.access_token || this.memoryToken || this.envToken || null;
  }

  async persist(accessToken, expiresAt) {
    try {
      await this.pool.query(
        `INSERT INTO av_instagram_token (token_name, access_token, expires_at, refreshed_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (token_name) DO UPDATE
           SET access_token = EXCLUDED.access_token,
               expires_at = EXCLUDED.expires_at,
               refreshed_at = NOW(),
               updated_at = NOW()`,
        [TOKEN_NAME, accessToken, expiresAt.toISOString()]
      );
      return true;
    } catch (err) {
      console.error('[instagram] Refreshed the token but could not store it:', err.message);
      return false;
    }
  }

  /**
   * Refresh the token when it is approaching expiry. Safe to call on every boot
   * and on a timer; it no-ops until the token is actually due.
   *
   * @returns {Promise<{refreshed: boolean, reason?: string, persisted?: boolean, expiresAt?: string}>}
   */
  async refreshIfNeeded() {
    const stored = await this.readStored();
    const token = stored?.access_token || this.memoryToken || this.envToken;

    if (!token) {
      return { refreshed: false, reason: 'not_configured' };
    }

    const now = this.now();

    if (stored) {
      const expiresAt = new Date(stored.expires_at);
      const daysLeft = (expiresAt.getTime() - now.getTime()) / DAY_MS;
      if (daysLeft > REFRESH_WHEN_DAYS_LEFT) {
        return { refreshed: false, reason: 'not_due', expiresAt: stored.expires_at };
      }

      const refreshedAt = stored.refreshed_at ? new Date(stored.refreshed_at) : null;
      const ageHours = refreshedAt ? (now.getTime() - refreshedAt.getTime()) / 3600000 : Infinity;
      if (ageHours < MIN_TOKEN_AGE_HOURS) {
        return { refreshed: false, reason: 'too_young', expiresAt: stored.expires_at };
      }
    }
    // No stored row: this is the first run against the env seed. Refresh straight
    // away so the token's clock starts under our control instead of expiring
    // silently 60 days after somebody pasted it into Render.

    let body;
    try {
      const response = await this.fetchImpl(
        `${GRAPH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(
          token
        )}`
      );
      body = await response.json();

      if (!response.ok || !body?.access_token) {
        if (isExpiredTokenError(body)) {
          console.error(
            '[instagram] TOKEN EXPIRED — the feed is down until a new long-lived token is minted ' +
              'in the Meta dashboard and set as INSTAGRAM_ACCESS_TOKEN. Instagram said:',
            body?.error?.message
          );
          return { refreshed: false, reason: 'token_expired' };
        }
        console.error('[instagram] Token refresh failed:', JSON.stringify(body));
        return { refreshed: false, reason: 'refresh_failed' };
      }
    } catch (err) {
      console.error('[instagram] Token refresh request failed:', err.message);
      return { refreshed: false, reason: 'refresh_failed' };
    }

    const lifetimeMs = body.expires_in ? body.expires_in * 1000 : DEFAULT_LIFETIME_DAYS * DAY_MS;
    const expiresAt = new Date(now.getTime() + lifetimeMs);

    this.memoryToken = body.access_token;
    const persisted = await this.persist(body.access_token, expiresAt);

    console.log(
      `[instagram] Access token refreshed; valid until ${expiresAt.toISOString()}` +
        (persisted ? '' : ' (in memory only — the store write failed)')
    );

    return { refreshed: true, persisted, expiresAt: expiresAt.toISOString() };
  }
}

let singleton = null;

const getInstagramTokenService = () => {
  if (!singleton) singleton = new InstagramTokenService({});
  return singleton;
};

module.exports = {
  InstagramTokenService,
  getInstagramTokenService,
  REFRESH_WHEN_DAYS_LEFT,
  MIN_TOKEN_AGE_HOURS,
  TOKEN_NAME,
};
