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

describe('promotional retry lookups (audit A08)', () => {
  const pool = () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) });

  test('finds the job behind a delivery in any status but cancelled', async () => {
    const db = pool();
    await new NotificationJobStore(db).findForDelivery({
      campaign: 'viewed_listing',
      recipientEmail: 'buyer@example.com',
      eventId: 'viewed-listing:buyer-1:listing-1',
    });
    const [sql, params] = db.query.mock.calls[0];
    // A crashed send leaves its job `processing` or recovered as `sent`.
    expect(sql).toContain("status <> 'cancelled'");
    expect(sql).not.toContain("status IN ('failed', 'unknown')");
    expect(params).toEqual([
      'viewed_listing',
      'buyer@example.com',
      'viewed-listing:buyer-1:listing-1',
    ]);
  });

  test('records a retry outcome on any job that was not cancelled', async () => {
    const db = pool();
    await new NotificationJobStore(db).recordRetryOutcome(7, 'sent', null, 'operator:test');
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("WHERE id = $1 AND status <> 'cancelled'");
    expect(params).toEqual([7, 'sent', null, 'operator:test']);
  });

  test('can leave the evaluated job out of the frequency cap', async () => {
    const db = pool();
    const store = new NotificationJobStore(db);
    await store.promotionalNextAvailableAt('buyer-1', { excludeJobId: 7 });
    await store.promotionalNextAvailableAt('buyer-1');
    expect(db.query.mock.calls[0][0]).toContain('id <> $2::bigint');
    expect(db.query.mock.calls[0][1]).toEqual(['buyer-1', 7]);
    expect(db.query.mock.calls[1][1]).toEqual(['buyer-1', null]);
  });
});

describe('matching-listing audience (audit A07)', () => {
  test('joins consent by the engaged address, constrained by the account', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await new MarketingEngagementStore(pool).matchingUsers({ category: 'dresses' });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/ON pref\.email = eng\.email/);
    expect(sql).toMatch(
      /pref\.sharetribe_user_id IS NULL OR pref\.sharetribe_user_id = eng\.sharetribe_user_id/
    );
    expect(sql).not.toMatch(/OR pref\.email = eng\.email/);
  });
});
