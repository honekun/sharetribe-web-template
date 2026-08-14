CREATE TABLE IF NOT EXISTS av_instagram_token (
  token_name TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE av_instagram_token IS
  'Long-lived Instagram access token, refreshed before its 60-day expiry. Env INSTAGRAM_ACCESS_TOKEN is only the seed: a token that is never refreshed expires permanently (this happened 2026-06-26).';
