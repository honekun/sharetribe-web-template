-- Audit A09: a publication claim used to record only the first observation of a
-- published listing, so a failure after the claim (author/listing lookup,
-- inactivity scheduling, matching fanout) was never retried. Completion is now
-- tracked separately; a row without completed_at is finished on replay or on the
-- listing's next event, for a bounded number of attempts.
--
-- Every migration runs on every deploy (scripts/migrate-notification-db.js), so
-- this file must be idempotent. Rows that already existed were handled under the
-- old claim-only model; they are marked complete exactly once, when the column is
-- first added, and never again.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'av_listing_publications'
      AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE av_listing_publications ADD COLUMN completed_at TIMESTAMPTZ;
    UPDATE av_listing_publications SET completed_at = created_at;
  END IF;
END
$$;

ALTER TABLE av_listing_publications
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE av_listing_publications
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE av_listing_publications
  ADD COLUMN IF NOT EXISTS last_error TEXT;

COMMENT ON TABLE av_listing_publications IS
  'Publish-triggered campaign work per listing: first observation (created_at, event_id, published_at) and completion (completed_at). Incomplete rows are retried on replay or the next listing event, up to a bounded attempt count.';
