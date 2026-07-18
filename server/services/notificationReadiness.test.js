'use strict';

jest.mock('./notificationMetrics', () => ({
  getNotificationMetrics: jest.fn(() => ({ poller: { lastSequenceId: 321 } })),
}));

const { getNotificationReadiness } = require('./notificationReadiness');

const ORIGINAL_ENV = process.env;

describe('notification readiness', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      AV_NOTIFICATIONS_ENABLED: 'true',
      AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'false',
      AV_WHATSAPP_NOTIFICATIONS_ENABLED: 'false',
      SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
      DATABASE_URL: 'postgresql://localhost/database',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('reports database migration, ownership, cursor, and ledger status counts', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              last_sequence_id: '987',
              owner_id: 'worker-1',
              heartbeat_at: '2026-07-17T12:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { status: 'sent', count: 12 },
            { status: 'unknown', count: 1 },
          ],
        }),
    };

    const readiness = await getNotificationReadiness({ pool });

    expect(readiness.ready).toBe(true);
    expect(readiness.database).toEqual(
      expect.objectContaining({
        ready: true,
        migrated: true,
        ownerActive: true,
        lastSequenceId: '987',
        deliveriesByStatus: { sent: 12, unknown: 1 },
      })
    );
    expect(readiness.metrics).toEqual({ poller: { lastSequenceId: 321 } });
  });

  test('marks the service unready when the enabled database is unavailable', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('connection refused')),
    };

    const readiness = await getNotificationReadiness({ pool });

    expect(readiness.ready).toBe(false);
    expect(readiness.database).toEqual(
      expect.objectContaining({
        ready: false,
        error: 'notification_database_unavailable_or_unmigrated',
      })
    );
  });
});
