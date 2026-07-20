'use strict';

const {
  DEFAULT_STALE_CLAIM_MINUTES,
  MarketingEngagementStore,
  NotificationJobStore,
} = require('./notificationJobs');

describe('notification job persistence', () => {
  test('reclaims stale processing jobs so a worker restart cannot strand them', async () => {
    const client = {
      query: jest.fn().mockImplementation(sql => {
        if (sql.includes('WITH due AS')) return Promise.resolve({ rows: [{ id: 1 }] });
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    const store = new NotificationJobStore({
      connect: jest.fn().mockResolvedValue(client),
    });

    await expect(store.claimDue('worker-1')).resolves.toEqual([{ id: 1 }]);

    const claimCall = client.query.mock.calls.find(([sql]) => sql.includes('WITH due AS'));
    expect(claimCall[0]).toContain("status = 'processing'");
    expect(claimCall[0]).toContain('MAKE_INTERVAL');
    expect(claimCall[1]).toEqual([20, 'worker-1', DEFAULT_STALE_CLAIM_MINUTES]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('stores anonymous qualified views without identity fields', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 7 }] }),
    };
    const store = new MarketingEngagementStore(pool);

    await store.record({
      sharetribeUserId: null,
      email: null,
      action: 'view',
      listingId: 'listing-1',
    });

    expect(pool.query.mock.calls[0][1]).toEqual(
      expect.arrayContaining([null, null, 'view', 'listing-1'])
    );
  });
});
