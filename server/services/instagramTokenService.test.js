'use strict';

const {
  InstagramTokenService,
  REFRESH_WHEN_DAYS_LEFT,
  MIN_TOKEN_AGE_HOURS,
} = require('./instagramTokenService');

const NOW = new Date('2026-08-14T12:00:00.000Z');
const daysFromNow = days => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

function mockPool(rows = []) {
  const pool = { query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }) };
  return pool;
}

const okResponse = body => ({ ok: true, json: async () => body, text: async () => '' });
const errResponse = (status, body) => ({
  ok: false,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const build = ({ rows = [], envToken = 'env-token', fetchImpl } = {}) =>
  new InstagramTokenService({
    pool: mockPool(rows),
    envToken,
    fetchImpl: fetchImpl || jest.fn(),
    now: () => NOW,
  });

describe('InstagramTokenService.getAccessToken', () => {
  it('prefers the stored token over the env seed', async () => {
    const service = build({
      rows: [{ access_token: 'stored-token', expires_at: daysFromNow(40).toISOString() }],
    });

    await expect(service.getAccessToken()).resolves.toBe('stored-token');
  });

  it('falls back to the env seed before anything has been stored', async () => {
    const service = build({ rows: [] });
    await expect(service.getAccessToken()).resolves.toBe('env-token');
  });

  it('falls back to the env seed when the database is unreachable', async () => {
    // Instagram is decorative; a Postgres outage must not take the route down.
    const service = build({});
    service.pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(service.getAccessToken()).resolves.toBe('env-token');
  });

  it('returns null when neither a stored token nor an env seed exists', async () => {
    const service = build({ rows: [], envToken: '' });
    await expect(service.getAccessToken()).resolves.toBeNull();
  });
});

describe('InstagramTokenService.refreshIfNeeded', () => {
  it('refreshes and persists when the token is inside the refresh window', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        okResponse({ access_token: 'fresh-token', expires_in: 60 * 24 * 60 * 60 })
      );
    const service = build({
      rows: [
        {
          access_token: 'aging-token',
          expires_at: daysFromNow(REFRESH_WHEN_DAYS_LEFT - 1).toISOString(),
          refreshed_at: daysFromNow(-30).toISOString(),
        },
      ],
      fetchImpl,
    });

    const result = await service.refreshIfNeeded();

    expect(result.refreshed).toBe(true);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain('refresh_access_token');
    expect(url).toContain('grant_type=ig_refresh_token');
    expect(url).toContain('aging-token');

    const write = service.pool.query.mock.calls.find(([q]) =>
      /INSERT INTO av_instagram_token/.test(q)
    );
    expect(write).toBeDefined();
    expect(write[1]).toContain('fresh-token');
  });

  it('leaves a token alone while it still has plenty of life', async () => {
    const fetchImpl = jest.fn();
    const service = build({
      rows: [
        {
          access_token: 'healthy-token',
          expires_at: daysFromNow(REFRESH_WHEN_DAYS_LEFT + 5).toISOString(),
          refreshed_at: daysFromNow(-10).toISOString(),
        },
      ],
      fetchImpl,
    });

    const result = await service.refreshIfNeeded();

    expect(result.refreshed).toBe(false);
    expect(result.reason).toBe('not_due');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('adopts the env seed on first run so a fresh deploy starts the clock', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        okResponse({ access_token: 'fresh-token', expires_in: 60 * 24 * 60 * 60 })
      );
    const service = build({ rows: [], fetchImpl });

    const result = await service.refreshIfNeeded();

    expect(result.refreshed).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toContain('env-token');
  });

  it('does not refresh a token younger than Instagram allows', async () => {
    // Instagram rejects a refresh for tokens less than 24 hours old.
    const fetchImpl = jest.fn();
    const service = build({
      rows: [
        {
          access_token: 'brand-new',
          expires_at: daysFromNow(60).toISOString(),
          refreshed_at: new Date(
            NOW.getTime() - (MIN_TOKEN_AGE_HOURS - 1) * 3600 * 1000
          ).toISOString(),
        },
      ],
      fetchImpl,
    });

    const result = await service.refreshIfNeeded();

    expect(result.refreshed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports an expired token instead of throwing, and does not persist anything', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      errResponse(400, {
        error: { message: 'Session has expired', type: 'OAuthException', code: 190 },
      })
    );
    const service = build({
      rows: [
        {
          access_token: 'dead-token',
          expires_at: daysFromNow(-5).toISOString(),
          refreshed_at: daysFromNow(-65).toISOString(),
        },
      ],
      fetchImpl,
    });

    const result = await service.refreshIfNeeded();

    expect(result.refreshed).toBe(false);
    expect(result.reason).toBe('token_expired');
    expect(
      service.pool.query.mock.calls.some(([q]) => /INSERT INTO av_instagram_token/.test(q))
    ).toBe(false);
  });

  it('skips entirely when no token is configured at all', async () => {
    const fetchImpl = jest.fn();
    const service = build({ rows: [], envToken: '', fetchImpl });

    const result = await service.refreshIfNeeded();

    expect(result).toEqual({ refreshed: false, reason: 'not_configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('survives a write failure without losing the refreshed token in memory', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        okResponse({ access_token: 'fresh-token', expires_in: 60 * 24 * 60 * 60 })
      );
    const service = build({ rows: [], fetchImpl });
    service.pool.query.mockImplementation(q =>
      /INSERT INTO av_instagram_token/.test(q)
        ? Promise.reject(new Error('disk full'))
        : Promise.resolve({ rows: [], rowCount: 0 })
    );

    const result = await service.refreshIfNeeded();

    expect(result.refreshed).toBe(true);
    expect(result.persisted).toBe(false);
  });
});
