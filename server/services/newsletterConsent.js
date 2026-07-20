'use strict';

// First-party audit record of newsletter (marketing) consent (BR-03). This is the
// authoritative evidence store for the single-opt-in model (BR-02): the footer
// shows a visible consent notice, and every campaign contact must have a traceable
// consent record written here before being added to the Brevo list.

const { getPostgresPool } = require('./postgres');
const { normalizeEmail } = require('./emailAddress');

// Sources a caller may attribute consent to. Whitelisted so a client cannot write
// arbitrary provenance values.
const ALLOWED_SOURCES = new Set(['footer_newsletter']);
const DEFAULT_SOURCE = 'footer_newsletter';

// Coerce a client-supplied source to a known value; unknown/missing falls back to
// the default footer source rather than storing untrusted text.
function normalizeSource(source) {
  return ALLOWED_SOURCES.has(source) ? source : DEFAULT_SOURCE;
}

class NewsletterConsentStore {
  constructor(pool) {
    this.pool = pool;
  }

  // Append one immutable consent record. Returns { id, consentAt }.
  async record({ email, source, locale, policyVersion, sharetribeUserId, ip, consentAt }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new Error('newsletterConsent.record requires an email');
    }
    if (!policyVersion) {
      throw new Error('newsletterConsent.record requires a policyVersion');
    }
    const result = await this.pool.query(
      `INSERT INTO av_newsletter_consent
         (email, consent_at, source, locale, policy_version, sharetribe_user_id, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, consent_at`,
      [
        normalizedEmail,
        consentAt || new Date().toISOString(),
        normalizeSource(source),
        locale || null,
        String(policyVersion),
        sharetribeUserId || null,
        ip || null,
      ]
    );
    const row = result.rows[0] || null;
    return row ? { id: row.id, consentAt: row.consent_at } : null;
  }
}

function createNewsletterConsentStore(pool = getPostgresPool()) {
  return new NewsletterConsentStore(pool);
}

module.exports = {
  ALLOWED_SOURCES,
  DEFAULT_SOURCE,
  NewsletterConsentStore,
  createNewsletterConsentStore,
  normalizeEmail,
  normalizeSource,
};
