'use strict';

jest.mock('../../api-util/sdk');
const { getSdk } = require('../../api-util/sdk');
const router = require('./index');
const { summaryHandler, summarize, _test } = router;
const { PAYMENT_PROCESS_NAMES } = require('./balanceTransitions');

const createRes = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const money = amount => ({ amount, currency: 'MXN' });
const tx = (lastTransition, amount, createdAt) => ({
  attributes: { lastTransition, payoutTotal: money(amount), createdAt },
});

const THIS_MONTH = new Date().toISOString();
const LAST_YEAR = new Date(new Date().getFullYear() - 1, 0, 15).toISOString();

const page = (data, totalPages = 1) => ({ data: { data, meta: { totalPages } } });

let sdk;

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(_test.summaryCache).forEach(key => delete _test.summaryCache[key]);
  _test.inFlight.clear();
  sdk = {
    currentUser: {
      show: jest.fn().mockResolvedValue({ data: { data: { id: { uuid: 'user-1' } } } }),
    },
    transactions: { query: jest.fn().mockResolvedValue(page([])) },
  };
  getSdk.mockReturnValue(sdk);
});

const run = (query = {}) => {
  const res = createRes();
  return summaryHandler({ query }, res).then(() => res);
};

describe('summarize', () => {
  it('buckets sales by last transition and by creation month', () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const result = summarize(
      [
        tx('transition/complete', 1000, THIS_MONTH),
        tx('transition/review-1-by-customer', 500, LAST_YEAR),
        tx('transition/cancel', 9999, THIS_MONTH),
        tx('transition/auto-cancel', 9999, LAST_YEAR),
        tx('transition/confirm-payment', 300, THIS_MONTH),
        tx('transition/mark-delivered', 200, LAST_YEAR),
      ],
      monthStart
    );

    expect(result).toEqual({
      completedTotalAmount: 1500,
      pendingTotalAmount: 500,
      cancelledCount: 2,
      currentMonthCompletedAmount: 1000,
      currentMonthPendingAmount: 300,
      currentMonthCancelledCount: 1,
      currency: 'MXN',
    });
  });
});

describe('GET /summary', () => {
  it('mounts the rate limiter before the handler', () => {
    const layer = router.stack.find(l => l.route?.path === '/summary');
    expect(layer.route.stack).toHaveLength(2);
    expect(layer.route.stack[1].handle).toBe(summaryHandler);
  });

  it('runs a single query chain with server-derived processes, ignoring the query string', async () => {
    sdk.transactions.query.mockResolvedValue(page([tx('transition/complete', 1000, THIS_MONTH)]));

    const res = await run({
      processNames: 'evil-process',
      completed: 'transition/confirm-payment',
      refunded: 'a,b,c',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, completedTotalAmount: 1000, truncated: false });
    expect(sdk.transactions.query).toHaveBeenCalledTimes(1);
    const params = sdk.transactions.query.mock.calls[0][0];
    expect(params).toMatchObject({ only: 'sale', processNames: PAYMENT_PROCESS_NAMES });
    expect(params.lastTransitions).toBeUndefined();
  });

  it('stops paginating at MAX_PAGES and flags the result as truncated', async () => {
    sdk.transactions.query.mockResolvedValue(page([], _test.MAX_PAGES + 10));

    const res = await run();

    expect(sdk.transactions.query).toHaveBeenCalledTimes(_test.MAX_PAGES);
    expect(res.body.truncated).toBe(true);
  });

  it('serves repeat requests from the per-user cache', async () => {
    await run();
    await run({ completed: 'x' });

    expect(sdk.transactions.query).toHaveBeenCalledTimes(1);
    expect(Object.keys(_test.summaryCache)).toEqual(['user-1']);
  });

  it('shares one computation between concurrent requests from the same user', async () => {
    let release;
    sdk.transactions.query.mockReturnValue(
      new Promise(resolve => {
        release = () => resolve(page([]));
      })
    );

    const both = Promise.all([run(), run()]);
    await new Promise(resolve => setImmediate(resolve));
    release();
    const [a, b] = await both;

    expect(sdk.transactions.query).toHaveBeenCalledTimes(1);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(_test.inFlight.size).toBe(0);
  });

  it('returns 401 when the caller is not signed in', async () => {
    sdk.currentUser.show.mockRejectedValue(new Error('401'));

    const res = await run();

    expect(res.statusCode).toBe(401);
    expect(sdk.transactions.query).not.toHaveBeenCalled();
  });

  it('returns 502 and caches nothing when the query fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    sdk.transactions.query.mockRejectedValue(new Error('boom'));

    const res = await run();

    expect(res.statusCode).toBe(502);
    expect(Object.keys(_test.summaryCache)).toHaveLength(0);
    expect(_test.inFlight.size).toBe(0);
    console.error.mockRestore();
  });
});
