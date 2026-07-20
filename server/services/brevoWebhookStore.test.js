'use strict';

const { BrevoWebhookStore } = require('./brevoWebhookStore');

function mockPool() {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
    release: jest.fn(),
  };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, client };
}

const queries = client => client.query.mock.calls.map(([q]) => q);

describe('BrevoWebhookStore.record', () => {
  it('writes the event and delivery update inside one transaction', async () => {
    const { pool, client } = mockPool();
    await new BrevoWebhookStore(pool).record({
      event: 'delivered',
      email: 'Person@Example.com',
      providerMessageId: 'msg-1',
      occurredAt: '2026-07-19T12:00:00.000Z',
    });

    const qs = queries(client);
    expect(qs[0]).toBe('BEGIN');
    expect(qs[qs.length - 1]).toBe('COMMIT');
    // Event insert is idempotent against duplicate webhooks.
    expect(
      qs.some(q => q.includes('INSERT INTO av_brevo_webhook_events') && /ON CONFLICT/i.test(q))
    ).toBe(true);
    // Delivery status update runs when a provider message id is present.
    expect(qs.some(q => q.includes('UPDATE av_notification_deliveries'))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  it('skips the delivery update when there is no provider message id', async () => {
    const { pool, client } = mockPool();
    await new BrevoWebhookStore(pool).record({ event: 'unsubscribed', email: 'p@e.com' });
    expect(queries(client).some(q => q.includes('UPDATE av_notification_deliveries'))).toBe(false);
  });

  it('rolls back and releases the client on failure', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce() // BEGIN
        .mockRejectedValueOnce(new Error('insert failed')),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client) };
    await expect(
      new BrevoWebhookStore(pool).record({ event: 'delivered', email: 'p@e.com' })
    ).rejects.toThrow('insert failed');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
