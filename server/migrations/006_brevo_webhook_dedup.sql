-- Idempotency for Brevo delivery webhooks: Brevo can send the same event more
-- than once. A partial unique index on (provider_message_id, event) lets the
-- webhook store INSERT ... ON CONFLICT DO NOTHING so duplicates don't append.
-- Rows without a provider_message_id (rare) are not covered and stay append-only.

CREATE UNIQUE INDEX IF NOT EXISTS av_brevo_webhook_events_dedup_idx
  ON av_brevo_webhook_events (provider_message_id, event)
  WHERE provider_message_id IS NOT NULL;
