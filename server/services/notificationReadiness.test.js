'use strict';

jest.mock('./notificationMetrics', () => ({
  getNotificationMetrics: jest.fn(() => ({ poller: { lastSequenceId: 321 } })),
}));

const {
  REQUIRED_TABLES,
  getNotificationReadiness,
  getPublicNotificationReadiness,
  _test: readinessTest,
} = require('./notificationReadiness');

const ORIGINAL_ENV = process.env;

describe('notification readiness', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      AV_NOTIFICATIONS_ENABLED: 'true',
      AV_SHIPPING_LABELS_ENABLED: 'false',
      AV_ESHIP_TRACKING_EMAILS_ENABLED: 'false',
      AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'false',
      AV_BREVO_CAMPAIGNS_ENABLED: 'false',
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
          rows: [{ status: 'sent', count: 12 }, { status: 'unknown', count: 1 }],
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'pending', count: 3 }, { status: 'sent', count: 4 }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: 9 }],
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'purchased', count: 7 }, { status: 'unknown', count: 1 }],
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'sent', count: 5 }, { status: 'failed', count: 2 }],
        })
        .mockResolvedValueOnce({
          rows: [{ poller_rows: 1, missing_tables: 0, publications_migrated: true }],
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
        jobsByStatus: { pending: 3, sent: 4 },
        marketingPreferences: 9,
        shippingLabelsByStatus: { purchased: 7, unknown: 1 },
        eshipTrackingByStatus: { sent: 5, failed: 2 },
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

  describe('public probe (audit A10)', () => {
    const migratedPool = () => ({
      query: jest.fn().mockResolvedValue({
        rows: [{ poller_rows: 1, missing_tables: 0, publications_migrated: true }],
      }),
    });

    beforeEach(() => readinessTest.reset());

    test('answers from one catalog query, without aggregating any table', async () => {
      const pool = migratedPool();
      await expect(getPublicNotificationReadiness({ pool })).resolves.toEqual({ ready: true });

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).not.toMatch(/GROUP BY/i);
      expect(sql).not.toMatch(/FROM av_notification_deliveries|FROM av_notification_jobs/);
      expect(sql).not.toMatch(/FROM av_marketing_preferences|FROM av_shipping_label_attempts/);
      expect(params).toEqual([REQUIRED_TABLES]);
    });

    test('shares one query between concurrent probes and caches the answer briefly', async () => {
      const pool = migratedPool();
      const answers = await Promise.all(
        Array.from({ length: 20 }, () => getPublicNotificationReadiness({ pool }))
      );
      expect(answers.every(answer => answer.ready)).toBe(true);
      await getPublicNotificationReadiness({ pool });
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test.each([
      ['a missing table', { poller_rows: 1, missing_tables: 1, publications_migrated: true }],
      [
        'migration 010 not applied',
        { poller_rows: 1, missing_tables: 0, publications_migrated: false },
      ],
      ['no poller state', { poller_rows: 0, missing_tables: 0, publications_migrated: true }],
    ])('is unready with %s', async (_label, row) => {
      const pool = { query: jest.fn().mockResolvedValue({ rows: [row] }) };
      await expect(getPublicNotificationReadiness({ pool })).resolves.toEqual({ ready: false });
    });

    test('is unready when the database is unreachable', async () => {
      const pool = { query: jest.fn().mockRejectedValue(new Error('connection refused')) };
      await expect(getPublicNotificationReadiness({ pool })).resolves.toEqual({ ready: false });
    });

    test('is unready when the enabled poller has no database configured', async () => {
      delete process.env.DATABASE_URL;
      const pool = migratedPool();
      await expect(getPublicNotificationReadiness({ pool })).resolves.toEqual({ ready: false });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('is ready without touching the database when notifications are off', async () => {
      process.env.AV_NOTIFICATIONS_ENABLED = 'false';
      const pool = migratedPool();
      const readiness = await getPublicNotificationReadiness({ pool });
      expect(pool.query).not.toHaveBeenCalled();
      expect(readiness).toEqual({ ready: expect.any(Boolean) });
    });
  });
});
