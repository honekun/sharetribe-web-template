'use strict';

const { getPostgresPool } = require('./postgres');

const POLLER_NAME = 'notifications';
const EMPTY = { lastSequenceId: null, recentEventIds: [] };

function parseSequenceId(value) {
  if (value == null) return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid persisted event sequence ID: ${value}`);
  }
  return parsed;
}

function normalizeEventIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(id => typeof id === 'string');
}

class EventPollerCursorStore {
  constructor(pool) {
    this.pool = pool;
  }

  async loadCursor() {
    const result = await this.pool.query(
      `SELECT last_sequence_id, recent_event_ids
       FROM av_notification_event_poller_state
       WHERE poller_name = $1`,
      [POLLER_NAME]
    );
    const row = result.rows[0];
    if (!row) return { ...EMPTY };

    return {
      lastSequenceId: parseSequenceId(row.last_sequence_id),
      recentEventIds: normalizeEventIds(row.recent_event_ids),
    };
  }

  async claimOwnership(ownerId) {
    if (!ownerId) throw new Error('Poller owner ID is required');

    await this.pool.query(
      `INSERT INTO av_notification_event_poller_state (
         poller_name,
         owner_id,
         owner_acquired_at,
         heartbeat_at
       )
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (poller_name) DO UPDATE
       SET owner_id = EXCLUDED.owner_id,
           owner_acquired_at = EXCLUDED.owner_acquired_at,
           heartbeat_at = EXCLUDED.heartbeat_at,
           updated_at = NOW()`,
      [POLLER_NAME, ownerId]
    );
  }

  async saveCursor(state, ownerId) {
    if (!ownerId) throw new Error('Poller owner ID is required');

    const result = await this.pool.query(
      `UPDATE av_notification_event_poller_state
       SET last_sequence_id = $2,
           recent_event_ids = $3::jsonb,
           heartbeat_at = NOW(),
           updated_at = NOW()
       WHERE poller_name = $1
         AND owner_id = $4`,
      [
        POLLER_NAME,
        state.lastSequenceId ?? null,
        JSON.stringify(normalizeEventIds(state.recentEventIds)),
        ownerId,
      ]
    );

    if (result.rowCount !== 1) {
      throw new Error(`Poller "${ownerId}" no longer owns the shared cursor`);
    }
  }

  async releaseOwnership(ownerId) {
    if (!ownerId) return;

    await this.pool.query(
      `UPDATE av_notification_event_poller_state
       SET owner_id = NULL,
           owner_acquired_at = NULL,
           heartbeat_at = NOW(),
           updated_at = NOW()
       WHERE poller_name = $1
         AND owner_id = $2`,
      [POLLER_NAME, ownerId]
    );
  }
}

function createCursorStore(pool = getPostgresPool()) {
  return new EventPollerCursorStore(pool);
}

async function loadCursor() {
  return createCursorStore().loadCursor();
}

async function claimOwnership(ownerId) {
  return createCursorStore().claimOwnership(ownerId);
}

async function saveCursor(state, ownerId) {
  return createCursorStore().saveCursor(state, ownerId);
}

async function releaseOwnership(ownerId) {
  return createCursorStore().releaseOwnership(ownerId);
}

module.exports = {
  EMPTY,
  EventPollerCursorStore,
  POLLER_NAME,
  claimOwnership,
  createCursorStore,
  loadCursor,
  releaseOwnership,
  saveCursor,
};
