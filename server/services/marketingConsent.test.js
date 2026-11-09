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

describe('getPreference / isEligible (audit A07)', () => {
  // A tiny in-memory stand-in for av_marketing_preferences that evaluates the
  // lookup the way the SQL does, so the tests pin the semantics, not the text.
  const storeWith = rows => {
    const pool = {
      query: jest.fn(async (sql, [email, userId]) => ({
        rows: rows.filter(
          row =>
            row.email === email &&
            (userId == null || row.sharetribe_user_id == null || row.sharetribe_user_id === userId)
        ),
      })),
    };
    return { pool, store: new MarketingConsentStore(pool) };
  };
  const row = overrides => ({
    email: 'a@example.com',
    sharetribe_user_id: 'user-a',
    enabled: true,
    suppressed: false,
    ...overrides,
  });

  it("never authorizes A with a grant that belongs to B, even with A's user id", async () => {
    const { store } = storeWith([row({ email: 'b@example.com' })]);
    await expect(
      store.isEligible({ email: 'a@example.com', sharetribeUserId: 'user-a' })
    ).resolves.toBe(false);
  });

  it('ignores a row whose returned email is not the destination', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [row({ email: 'b@example.com' })] }),
    };
    const store = new MarketingConsentStore(pool);
    await expect(store.getPreference({ email: 'a@example.com' })).resolves.toBeNull();
  });

  it('accepts anonymous consent for the same address', async () => {
    const { store } = storeWith([row({ sharetribe_user_id: null })]);
    await expect(
      store.isEligible({ email: ' A@Example.com ', sharetribeUserId: 'user-a' })
    ).resolves.toBe(true);
  });

  it('refuses a row linked to another account', async () => {
    const { store } = storeWith([row({ sharetribe_user_id: 'previous-owner' })]);
    await expect(
      store.isEligible({ email: 'a@example.com', sharetribeUserId: 'user-a' })
    ).resolves.toBe(false);
  });

  it('keeps withdrawal and suppression authoritative', async () => {
    await expect(
      storeWith([row({ enabled: false })]).store.isEligible({ email: 'a@example.com' })
    ).resolves.toBe(false);
    await expect(
      storeWith([row({ suppressed: true })]).store.isEligible({ email: 'a@example.com' })
    ).resolves.toBe(false);
  });

  it('looks up by address only and passes the user id as a constraint', async () => {
    const { pool, store } = storeWith([row()]);
    await store.getPreference({ email: 'A@example.com', sharetribeUserId: 'user-a' });
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['a@example.com', 'user-a']);
    expect(sql).not.toMatch(/OR\s*\(\$2::text IS NOT NULL AND sharetribe_user_id = \$2\)/);
  });

  it('returns nothing without an address', async () => {
    const { pool, store } = storeWith([row()]);
    await expect(store.getPreference({ sharetribeUserId: 'user-a' })).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });
});
