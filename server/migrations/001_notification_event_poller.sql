CREATE TABLE IF NOT EXISTS av_notification_event_poller_state (
  poller_name TEXT PRIMARY KEY,
  last_sequence_id BIGINT,
  recent_event_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  owner_id TEXT,
  owner_acquired_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT av_notification_event_poller_recent_ids_array
    CHECK (JSONB_TYPEOF(recent_event_ids) = 'array')
);

COMMENT ON TABLE av_notification_event_poller_state IS
  'Shared cursor and observable ownership for the Sharetribe notification event poller';

INSERT INTO av_notification_event_poller_state (poller_name)
VALUES ('notifications')
ON CONFLICT (poller_name) DO NOTHING;
