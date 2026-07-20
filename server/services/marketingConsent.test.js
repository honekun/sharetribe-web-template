'use strict';

const { MarketingConsentStore, normalizeSource } = require('./marketingConsent');

function mockTransactionalPool(preference = { email: 'person@example.com', enabled: true }) {
  const client = {
    query: jest.fn(query => {
      if (query.includes('RETURNING email')) return Promise.resolve({ rows: [preference] });
      return Promise.resolve({ rows: [], rowCount: 1 });
    }),
    release: jest.fn(),
  };
  return { pool: { connect: jest.fn().mockResolvedValue(client) }, client };
}

describe('marketing consent store', () => {
  test('whitelists evidence sources', () => {
    expect(normalizeSource('signup_email')).toBe('signup_email');
    expect(normalizeSource('signup_idp')).toBe('signup_idp');
    expect(normalizeSource('brevo_webhook')).toBe('brevo_webhook');
    expect(normalizeSource('untrusted')).toBe('account_details');
  });

  test('records immutable evidence and current opt-in state in one transaction', async () => {
    const { pool, client } = mockTransactionalPool();
    const store = new MarketingConsentStore(pool);
    const result = await store.setPreference({
      email: ' Person@Example.com ',
      enabled: true,
      source: 'signup_email',
      policyVersion: '2026-07-19',
      sharetribeUserId: 'user-1',
      occurredAt: '2026-07-19T12:00:00.000Z',
    });

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    const evidenceCall = client.query.mock.calls.find(([query]) =>
      query.includes('INSERT INTO av_newsletter_consent')
    );
    expect(evidenceCall[1]).toEqual(
      expect.arrayContaining(['person@example.com', '2026-07-19T12:00:00.000Z', 'signup_email'])
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(result).toEqual({ email: 'person@example.com', enabled: true });
  });

  test('withdrawal cancels pending promotional jobs in the same transaction', async () => {
    const { pool, client } = mockTransactionalPool({
      email: 'person@example.com',
      enabled: false,
    });
    const store = new MarketingConsentStore(pool);
    await store.setPreference({
      email: 'person@example.com',
      enabled: false,
      source: 'account_details',
      sharetribeUserId: 'user-1',
    });

    expect(
      client.query.mock.calls.some(([query]) => query.includes("SET status = 'cancelled'"))
    ).toBe(true);
  });

  // A previously suppressed contact (unsubscribed / hard bounce via webhook) must
  // not be silently re-enabled by an anonymous footer subscribe.
  function mockSuppressedPool(returning = { email: 'p@e.com', enabled: false, suppressed: true }) {
    const client = {
      query: jest.fn(query => {
        if (query.includes('FOR UPDATE')) return Promise.resolve({ rows: [{ suppressed: true }] });
        if (query.includes('RETURNING email')) return Promise.resolve({ rows: [returning] });
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      release: jest.fn(),
    };
    return { pool: { connect: jest.fn().mockResolvedValue(client) }, client };
  }
  const upsertParams = client =>
    client.query.mock.calls.find(([q]) => q.includes('INSERT INTO av_marketing_preferences'))[1];

  test('keeps a suppressed contact suppressed on an unauthenticated re-subscribe', async () => {
    const { pool, client } = mockSuppressedPool();
    const store = new MarketingConsentStore(pool);
    await store.setPreference({ email: 'p@e.com', enabled: true, source: 'footer_newsletter' });
    const params = upsertParams(client);
    expect(params[2]).toBe(false); // effective enabled
    expect(params[3]).toBe(true); // effective suppressed
  });

  test('lets an authorized opt-in (allowUnsuppress) lift suppression', async () => {
    const { pool, client } = mockSuppressedPool({
      email: 'p@e.com',
      enabled: true,
      suppressed: false,
    });
    const store = new MarketingConsentStore(pool);
    await store.setPreference({
      email: 'p@e.com',
      enabled: true,
      source: 'account_details',
      allowUnsuppress: true,
    });
    const params = upsertParams(client);
    expect(params[2]).toBe(true); // effective enabled
    expect(params[3]).toBe(false); // effective suppressed
  });

  test('rolls back when persistence fails', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce(),
      release: jest.fn(),
    };
    const store = new MarketingConsentStore({
      connect: jest.fn().mockResolvedValue(client),
    });

    await expect(
      store.setPreference({
        email: 'person@example.com',
        enabled: true,
        source: 'signup_email',
      })
    ).rejects.toThrow('write failed');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
