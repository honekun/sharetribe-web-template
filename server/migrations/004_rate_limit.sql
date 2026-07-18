CREATE TABLE IF NOT EXISTS av_rate_limit (
  bucket TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, identifier, window_start)
);

-- Supports the opportunistic cleanup of expired fixed windows.
CREATE INDEX IF NOT EXISTS av_rate_limit_window_idx ON av_rate_limit (window_start);

COMMENT ON TABLE av_rate_limit IS
  'Shared fixed-window rate-limit counters across web processes (BR-07). One row per (bucket, identifier, window); expired windows are cleaned opportunistically.';
