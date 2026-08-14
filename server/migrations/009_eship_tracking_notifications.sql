CREATE TABLE IF NOT EXISTS av_eship_tracking_notifications (
  id BIGSERIAL PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_at TIMESTAMPTZ,
  webhook_tracking_number TEXT,
  transaction_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'ignored', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_token UUID,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  ignored_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shipment_id, event_type)
);

CREATE INDEX IF NOT EXISTS av_eship_tracking_notifications_due_idx
  ON av_eship_tracking_notifications (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed', 'processing');

CREATE INDEX IF NOT EXISTS av_shipping_label_attempts_shipment_id_idx
  ON av_shipping_label_attempts ((shipment_data->>'shipmentId'))
  WHERE status = 'purchased';

COMMENT ON TABLE av_eship_tracking_notifications IS
  'Durable, idempotent eShip tracking events that trigger native Sharetribe transaction emails';
