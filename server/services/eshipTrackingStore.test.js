'use strict';

const { EshipTrackingStore } = require('./eshipTrackingStore');

describe('EshipTrackingStore', () => {
  test('enqueues a unique shipment event and reports duplicates without rewriting it', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1, shipment_id: 'ship-1', status: 'pending', attempt_count: 0 }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, shipment_id: 'ship-1', status: 'sent', attempt_count: 1 }],
        }),
    };
    const store = new EshipTrackingStore(pool);

    const inserted = await store.enqueue({
      shipmentId: 'ship-1',
      eventType: 'transit-picked-up',
      eventAt: '2026-08-14T18:00:00.000Z',
      trackingNumber: 'TRACK-1',
    });
    const duplicate = await store.enqueue({
      shipmentId: 'ship-1',
      eventType: 'transit-picked-up',
    });

    expect(inserted.duplicate).toBe(false);
    expect(duplicate).toMatchObject({ duplicate: true, status: 'sent' });
    expect(pool.query.mock.calls[0][0]).toContain('ON CONFLICT (shipment_id, event_type)');
    expect(pool.query.mock.calls[0][1]).toEqual([
      'ship-1',
      'transit-picked-up',
      '2026-08-14T18:00:00.000Z',
      'TRACK-1',
    ]);
  });

  test('claims one due event with a database lock and bounded attempt count', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 4, claim_token: 'claim-4', status: 'processing', attempt_count: 2 }],
      }),
    };
    const store = new EshipTrackingStore(pool);

    const claim = await store.claimNext({ claimedBy: 'worker-1', maxAttempts: 8 });

    expect(claim).toMatchObject({ id: 4, status: 'processing' });
    expect(pool.query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(pool.query.mock.calls[0][1]).toEqual([expect.any(String), 'worker-1', 8, 20]);
  });

  test('maps an eShip shipment back to the durable Sharetribe transaction', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [{ transaction_id: 'tx-1' }] }),
    };
    const store = new EshipTrackingStore(pool);

    await expect(store.findTransactionByShipmentId('ship-1')).resolves.toBe('tx-1');
    expect(pool.query.mock.calls[0][0]).toContain("shipment_data->>'shipmentId' = $1");
  });

  test('finalizes only the active processing claim', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const store = new EshipTrackingStore(pool);

    await store.markSent(7, 'claim-7', 'tx-7');
    expect(pool.query.mock.calls[0][0]).toContain("status = 'processing'");
    expect(pool.query.mock.calls[0][1]).toEqual([7, 'claim-7', 'sent', 'tx-7', null]);
  });
});
