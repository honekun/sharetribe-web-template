CREATE TABLE IF NOT EXISTS av_notification_deliveries (
  notification_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('brevo', 'whatsapp')),
  template_name TEXT NOT NULL,
  recipient_hash TEXT NOT NULL,
  recipient_hint TEXT NOT NULL,
  delivery_payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'unknown')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_token UUID,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS av_notification_deliveries_status_created_idx
  ON av_notification_deliveries (status, created_at DESC);

COMMENT ON TABLE av_notification_deliveries IS
  'Atomic delivery claims and provider outcomes for Sharetribe event notifications';
