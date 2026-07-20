'use strict';

const { EventPollerCursorStore, POLLER_NAME } = require('./eventPollerCursor');

function createSharedStatePool() {
  const state = {
    lastSequenceId: null,
    ownerId: null,
    recentEventIds: [],
  };

  return {
    state,
    query: jest.fn(async (sql, params) => {
      if (sql.includes('INSERT INTO av_notification_event_poller_state')) {
        state.ownerId = params[1];
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('SELECT last_sequence_id')) {
        return {
          rowCount: 1,
          rows: [
            {
              last_sequence_id: state.lastSequenceId == null ? null : String(state.lastSequenceId),
              recent_event_ids: [...state.recentEventIds],
            },
          ],
        };
      }
      if (sql.includes('SET last_sequence_id')) {
        if (state.ownerId !== params[3]) return { rowCount: 0, rows: [] };
        state.lastSequenceId = params[1];
        state.recentEventIds = JSON.parse(params[2]);
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('SET owner_id = NULL')) {
        if (state.ownerId === params[1]) state.ownerId = null;
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
  };
}

describe('EventPollerCursorStore', () => {
  test('persists the cursor across a process replacement', async () => {
    const pool = createSharedStatePool();
    const firstProcess = new EventPollerCursorStore(pool);

    await firstProcess.claimOwnership('web.1:101');
    await firstProcess.saveCursor(
      {
        lastSequenceId: 42,
        recentEventIds: ['event-41', 'event-42'],
      },
      'web.1:101'
    );
    await firstProcess.releaseOwnership('web.1:101');

    const replacementProcess = new EventPollerCursorStore(pool);
    await replacementProcess.claimOwnership('web.2:202');
    await expect(replacementProcess.loadCursor()).resolves.toEqual({
      lastSequenceId: 42,
      recentEventIds: ['event-41', 'event-42'],
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE poller_name = $1'), [
      POLLER_NAME,
    ]);
  });

  test('rejects a cursor write from a process that no longer owns it', async () => {
    const pool = createSharedStatePool();
    const firstProcess = new EventPollerCursorStore(pool);
    const replacementProcess = new EventPollerCursorStore(pool);

    await firstProcess.claimOwnership('web.1:101');
    await replacementProcess.claimOwnership('web.2:202');

    await expect(
      firstProcess.saveCursor(
        {
          lastSequenceId: 42,
          recentEventIds: ['event-42'],
        },
        'web.1:101'
      )
    ).rejects.toThrow('no longer owns the shared cursor');
  });
});
