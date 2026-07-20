-- Current marketing preference plus an append-only consent/suppression history.
-- The existing av_newsletter_consent rows are backfilled as granted preferences
-- so footer subscribers retain their consent after this migration.
ALTER TABLE av_newsletter_consent
  ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'granted';

ALTER TABLE av_notification_deliveries
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_status_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS av_marketing_preferences (
  email TEXT PRIMARY KEY,
  sharetribe_user_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL,
  locale TEXT,
  policy_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS av_marketing_preferences_user_idx
  ON av_marketing_preferences (sharetribe_user_id)
  WHERE sharetribe_user_id IS NOT NULL;

INSERT INTO av_marketing_preferences (
  email,
  sharetribe_user_id,
  enabled,
  suppressed,
  source,
  locale,
  policy_version,
  consent_at,
  updated_at
)
SELECT DISTINCT ON (LOWER(email))
  LOWER(email),
  sharetribe_user_id,
  TRUE,
  FALSE,
  source,
  locale,
  policy_version,
  consent_at,
  consent_at
FROM av_newsletter_consent
WHERE action = 'granted'
ORDER BY LOWER(email), consent_at DESC
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS av_marketing_engagement (
  id BIGSERIAL PRIMARY KEY,
  sharetribe_user_id TEXT,
  email TEXT,
  first_name TEXT,
  action TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  listing_author_id TEXT,
  listing_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Qualified anonymous views are useful for seller inactivity checks, but they
-- must not create buyer follow-up jobs or retain identifying information.
ALTER TABLE av_marketing_engagement
  ALTER COLUMN sharetribe_user_id DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS av_marketing_engagement_user_time_idx
  ON av_marketing_engagement (sharetribe_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS av_marketing_engagement_listing_time_idx
  ON av_marketing_engagement (listing_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS av_marketing_engagement_category_time_idx
  ON av_marketing_engagement ((listing_data->>'category'), occurred_at DESC);

CREATE TABLE IF NOT EXISTS av_notification_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_key TEXT NOT NULL UNIQUE,
  campaign TEXT NOT NULL,
  sharetribe_user_id TEXT,
  recipient_email TEXT NOT NULL,
  resource_id TEXT,
  trigger_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS av_notification_jobs_due_idx
  ON av_notification_jobs (due_at, id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS av_notification_jobs_user_sent_idx
  ON av_notification_jobs (sharetribe_user_id, sent_at DESC)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS av_notification_jobs_resource_idx
  ON av_notification_jobs (resource_id, campaign, status);

CREATE TABLE IF NOT EXISTS av_listing_publications (
  listing_id TEXT PRIMARY KEY,
  author_id TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS av_brevo_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider_message_id TEXT,
  event TEXT NOT NULL,
  email_hash TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS av_brevo_webhook_events_message_idx
  ON av_brevo_webhook_events (provider_message_id, occurred_at DESC);

COMMENT ON TABLE av_marketing_preferences IS
  'Current first-party marketing consent and suppression state. Send-time eligibility must fail closed against this table.';

COMMENT ON TABLE av_marketing_engagement IS
  'First-party qualified listing views, favorites, inquiries, and purchases used for AV campaign eligibility and matching.';

COMMENT ON TABLE av_notification_jobs IS
  'Durable delayed and digest notification jobs claimed by the notification poller leader.';

COMMENT ON TABLE av_listing_publications IS
  'First observed publication per listing, used to make publish-triggered campaigns idempotent.';

COMMENT ON TABLE av_brevo_webhook_events IS
  'Minimal Brevo delivery/suppression webhook audit without storing raw recipient addresses.';
