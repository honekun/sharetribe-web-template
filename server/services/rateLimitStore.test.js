'use strict';

const { PostgresRateLimiter, createSharedRateLimit, windowStartMs } = require('./rateLimitStore');

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
});

function mockPool(count = 1) {
  return { query: jest.fn().mockResolvedValue({ rows: [{ count }] }) };
}

function makeReqRes(ip = '9.9.9.9') {
  const req = { ip };
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return { req, res };
}

describe('rateLimitStore', () => {
  describe('windowStartMs', () => {
    it('buckets a timestamp to the start of its fixed window', () => {
      expect(windowStartMs(1_000_000_123, 60_000)).toBe(
        Math.floor(1_000_000_123 / 60_000) * 60_000
      );
    });
  });

  describe('PostgresRateLimiter.hit', () => {
    it('records the hit for the current window and reports not-limited under max', async () => {
      const pool = mockPool(3);
      const limiter = new PostgresRateLimiter(pool, { bucket: 'b', windowMs: 60_000, max: 20 });

      const result = await limiter.hit('1.2.3.4', 1_000_000_000);

      const params = pool.query.mock.calls[0][1];
      expect(params[0]).toBe('b'); // bucket
      expect(params[1]).toBe('1.2.3.4'); // identifier
      expect(params[2]).toEqual(new Date(windowStartMs(1_000_000_000, 60_000)));
      expect(result.limited).toBe(false);
      expect(result.count).toBe(3);
    });

    it('reports limited once the count exceeds the max', async () => {
      const pool = mockPool(21);
      const limiter = new PostgresRateLimiter(pool, { bucket: 'b', windowMs: 60_000, max: 20 });

      const result = await limiter.hit('1.2.3.4');

      expect(result.limited).toBe(true);
    });
  });

  describe('createSharedRateLimit middleware', () => {
    it('calls next when under the limit, keyed on the request IP', async () => {
      const limiter = { hit: jest.fn().mockResolvedValue({ limited: false }) };
      const mw = createSharedRateLimit(
        { bucket: 'b', windowMs: 1, max: 1, message: { ok: false } },
        () => limiter
      );
      const { req, res } = makeReqRes('9.9.9.9');
      const next = jest.fn();

      await mw(req, res, next);

      expect(limiter.hit).toHaveBeenCalledWith('9.9.9.9');
      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('returns 429 with the configured message when limited', async () => {
      const limiter = { hit: jest.fn().mockResolvedValue({ limited: true }) };
      const mw = createSharedRateLimit(
        { bucket: 'b', windowMs: 1, max: 1, message: { ok: false, error: 'rate_limited' } },
        () => limiter
      );
      const { req, res } = makeReqRes();
      const next = jest.fn();

      await mw(req, res, next);

      expect(res.statusCode).toBe(429);
      expect(res.body).toEqual({ ok: false, error: 'rate_limited' });
      expect(next).not.toHaveBeenCalled();
    });

    it('fails open (calls next) when the store errors', async () => {
      const limiter = { hit: jest.fn().mockRejectedValue(new Error('db down')) };
      const mw = createSharedRateLimit(
        { bucket: 'b', windowMs: 1, max: 1, message: { ok: false } },
        () => limiter
      );
      const { req, res } = makeReqRes();
      const next = jest.fn();

      await mw(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });
});
