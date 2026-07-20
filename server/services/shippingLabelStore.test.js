'use strict';

const { ShippingLabelStore } = require('./shippingLabelStore');

describe('ShippingLabelStore', () => {
  test('marks stale claims unknown before atomically claiming a transaction', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ transaction_id: 'tx-1', claim_token: 'claim-1', status: 'processing' }],
        }),
    };
    const store = new ShippingLabelStore(pool);

    const claim = await store.claim({
      transactionId: 'tx-1',
      rateId: 'rate-1',
      claimedBy: 'worker-1',
      force: true,
      confirmUnknown: false,
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[0][0]).toContain("SET status = 'unknown'");
    expect(pool.query.mock.calls[1][0]).toContain('ON CONFLICT (transaction_id)');
    expect(pool.query.mock.calls[1][1]).toEqual([
      'tx-1',
      'rate-1',
      expect.any(String),
      'worker-1',
      true,
      false,
    ]);
    expect(claim).toEqual(expect.objectContaining({ status: 'processing' }));
  });

  test('returns null when an active, purchased, or unconfirmed unknown claim blocks buying', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }),
    };
    const store = new ShippingLabelStore(pool);

    await expect(
      store.claim({
        transactionId: 'tx-1',
        rateId: 'rate-1',
        claimedBy: 'worker-2',
      })
    ).resolves.toBeNull();
  });

  test('finishes only the active claim', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }) };
    const store = new ShippingLabelStore(pool);
    const shipmentData = { status: 'purchased', shipmentId: 'ship-1' };

    await store.finish('tx-1', 'claim-1', {
      status: 'purchased',
      shipmentData,
    });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("AND status = 'processing'"), [
      'tx-1',
      'claim-1',
      'purchased',
      JSON.stringify(shipmentData),
      null,
    ]);
  });

  test('rejects a finish when ownership has changed', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
    const store = new ShippingLabelStore(pool);

    await expect(
      store.finish('tx-1', 'old-claim', { status: 'failed', error: 'expired' })
    ).rejects.toThrow('no longer active');
  });
});
