'use strict';

const { getPostgresPool } = require('./postgres');
const { normalizeEmail } = require('./emailAddress');

const DEFAULT_POLICY_VERSION = '2026-07-19';
const ALLOWED_SOURCES = new Set([
  'footer_newsletter',
  'signup_email',
  'signup_idp',
  'account_details',
  'brevo_webhook',
]);

function normalizeSource(source) {
  return ALLOWED_SOURCES.has(source) ? source : 'account_details';
}

class MarketingConsentStore {
  constructor(pool) {
    this.pool = pool;
  }

  async setPreference({
    email,
    enabled,
    source,
    locale = 'es',
    policyVersion = DEFAULT_POLICY_VERSION,
    sharetribeUserId = null,
    ip = null,
    suppressed = false,
    allowUnsuppress = false,
    occurredAt = new Date().toISOString(),
  }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error('marketingConsent.setPreference requires an email');
    const normalizedSource = normalizeSource(source);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      if (sharetribeUserId) {
        await client.query(
          `UPDATE av_marketing_preferences
           SET sharetribe_user_id = NULL, updated_at = NOW()
           WHERE sharetribe_user_id = $1 AND email <> $2`,
          [sharetribeUserId, normalizedEmail]
        );
      }

      // A contact suppressed by Brevo (unsubscribe / hard bounce / spam) must not be
      // silently re-enabled by an anonymous footer subscribe — that would re-mail
      // hard bounces and re-subscribe people who never proved ownership. Only a
      // webhook suppression event or an authorized opt-in (`allowUnsuppress`, e.g.
      // the account owner's toggle) may change the suppressed flag. Locked with
      // FOR UPDATE so a concurrent re-subscribe can't race past the check.
      const existing = await client.query(
        `SELECT suppressed FROM av_marketing_preferences WHERE email = $1 FOR UPDATE`,
        [normalizedEmail]
      );
      const currentlySuppressed = existing.rows[0]?.suppressed === true;
      const effectiveSuppressed = Boolean(suppressed) || (currentlySuppressed && !allowUnsuppress);
      const effectiveEnabled = Boolean(enabled) && !effectiveSuppressed;
      const action = effectiveSuppressed
        ? 'suppressed'
        : effectiveEnabled
        ? 'granted'
        : 'withdrawn';
      await client.query(
        `INSERT INTO av_newsletter_consent
           (email, consent_at, source, locale, policy_version, sharetribe_user_id, ip, action)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          normalizedEmail,
          occurredAt,
          normalizedSource,
          locale || null,
          String(policyVersion),
          sharetribeUserId,
          ip,
          action,
        ]
      );
      const result = await client.query(
        `INSERT INTO av_marketing_preferences (
           email, sharetribe_user_id, enabled, suppressed, source, locale, policy_version,
           consent_at, withdrawn_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7,
                 CASE WHEN $3 THEN $8::timestamptz ELSE NULL END,
                 CASE WHEN $3 THEN NULL ELSE $8::timestamptz END,
                 NOW())
         ON CONFLICT (email) DO UPDATE
         SET sharetribe_user_id = COALESCE(EXCLUDED.sharetribe_user_id,
                                           av_marketing_preferences.sharetribe_user_id),
             enabled = EXCLUDED.enabled,
             suppressed = EXCLUDED.suppressed,
             source = EXCLUDED.source,
             locale = EXCLUDED.locale,
             policy_version = EXCLUDED.policy_version,
             consent_at = CASE WHEN EXCLUDED.enabled THEN $8::timestamptz
                               ELSE av_marketing_preferences.consent_at END,
             withdrawn_at = CASE WHEN EXCLUDED.enabled THEN NULL ELSE $8::timestamptz END,
             updated_at = NOW()
         RETURNING email, sharetribe_user_id, enabled, suppressed, source, locale,
                   policy_version, consent_at, withdrawn_at`,
        [
          normalizedEmail,
          sharetribeUserId,
          effectiveEnabled,
          effectiveSuppressed,
          normalizedSource,
          locale || null,
          String(policyVersion),
          occurredAt,
        ]
      );

      if (!effectiveEnabled) {
        await client.query(
          `UPDATE av_notification_jobs
           SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
           WHERE status = 'pending'
             AND (
               recipient_email = $1
               OR ($2::text IS NOT NULL AND sharetribe_user_id = $2)
             )`,
          [normalizedEmail, sharetribeUserId]
        );
      }
      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getPreference({ email = null, sharetribeUserId = null }) {
    const result = await this.pool.query(
      `SELECT email, sharetribe_user_id, enabled, suppressed, source, locale,
              policy_version, consent_at, withdrawn_at
       FROM av_marketing_preferences
       WHERE ($1::text IS NOT NULL AND email = $1)
          OR ($2::text IS NOT NULL AND sharetribe_user_id = $2)
       ORDER BY (sharetribe_user_id = $2) DESC, updated_at DESC
       LIMIT 1`,
      [email ? normalizeEmail(email) : null, sharetribeUserId]
    );
    return result.rows[0] || null;
  }

  async isEligible({ email, sharetribeUserId = null }) {
    const preference = await this.getPreference({ email, sharetribeUserId });
    return Boolean(preference?.enabled) && !preference?.suppressed;
  }
}

function createMarketingConsentStore(pool = getPostgresPool()) {
  return new MarketingConsentStore(pool);
}

module.exports = {
  ALLOWED_SOURCES,
  DEFAULT_POLICY_VERSION,
  MarketingConsentStore,
  createMarketingConsentStore,
  normalizeSource,
};
