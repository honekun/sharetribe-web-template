CREATE TABLE IF NOT EXISTS av_shipping_label_attempts (
  transaction_id UUID PRIMARY KEY,
  rate_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'purchased', 'failed', 'unknown')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_token UUID,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  shipment_data JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS av_shipping_label_attempts_status_created_idx
  ON av_shipping_label_attempts (status, created_at DESC);

COMMENT ON TABLE av_shipping_label_attempts IS
  'Atomic eShip purchase claims and outcomes; processing/unknown rows prevent duplicate label charges';
