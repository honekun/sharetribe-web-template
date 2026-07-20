CREATE TABLE IF NOT EXISTS av_newsletter_consent (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  locale TEXT,
  policy_version TEXT NOT NULL,
  sharetribe_user_id TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only: one row per signup preserves resubscription history. Query the
-- latest row per email for current consent evidence.
CREATE INDEX IF NOT EXISTS av_newsletter_consent_email_idx
  ON av_newsletter_consent (email, consent_at DESC);

COMMENT ON TABLE av_newsletter_consent IS
  'Append-only first-party evidence of newsletter (marketing) consent captured at footer signup (BR-03). Access-controlled personal data; apply the same retention policy as other notification data.';
