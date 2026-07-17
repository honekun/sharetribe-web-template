'use strict';

jest.mock('../../api-util/sdk');
jest.mock('../../services/shippingQuoteService');
const { getSdk } = require('../../api-util/sdk');
const svc = require('../../services/shippingQuoteService');
const router = require('./index');

// Pull the POST /quote handler off the router (mirrors server/api/brevo.test.js).
function getQuoteHandler() {
  const layer = router.stack.find(l => l.route?.path === '/quote' && l.route.methods?.post);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createReq(body) {
  return { body };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const listingShow = () => ({
  data: {
    data: {
      id: { uuid: 'l1' },
      attributes: { publicData: { avPackageSize: 'M' } },
      author: { id: { uuid: 'a1' } },
    },
  },
});
const body = {
  listingId: 'l1',
  destination: { zip: '64000', state: 'NL', country: 'MX', name: 'B', phone: '81' },
};

let showMock;
beforeEach(() => {
  jest.clearAllMocks();
  showMock = jest.fn(async () => listingShow());
  getSdk.mockReturnValue({ listings: { show: showMock } });
});

it('fetches the listing with the author included (relationships need include)', async () => {
  // sdk.listings.show without include:['author'] returns no `relationships`, so
  // the seller author id is unresolvable -> false NO_ORIGIN. The author must be included.
  svc.quoteForCheckout.mockResolvedValue({
    quoteToken: 't',
    express: null,
    estandar: null,
    rawRates: [],
  });
  await getQuoteHandler()(createReq(body), createRes());
  expect(showMock).toHaveBeenCalledWith(expect.objectContaining({ include: ['author'] }));
});

it('returns 200 with the quote payload', async () => {
  svc.quoteForCheckout.mockResolvedValue({
    quoteToken: 't',
    express: { amountSubunits: 11800 },
    estandar: null,
    rawRates: [],
  });
  const res = createRes();
  await getQuoteHandler()(createReq(body), res);
  expect(res.statusCode).toBe(200);
  expect(res.body.quoteToken).toBe('t');
});

it('returns 400 when listingId or destination is missing', async () => {
  const res = createRes();
  await getQuoteHandler()(createReq({ listingId: 'l1' }), res);
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('BAD_REQUEST');
});

it('maps NoOriginError to 409 NO_ORIGIN', async () => {
  svc.quoteForCheckout.mockRejectedValue(new svc.NoOriginError());
  const res = createRes();
  await getQuoteHandler()(createReq(body), res);
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('NO_ORIGIN');
});

it('maps EspecialError to 422 ESPECIAL', async () => {
  svc.quoteForCheckout.mockRejectedValue(new svc.EspecialError());
  const res = createRes();
  await getQuoteHandler()(createReq(body), res);
  expect(res.statusCode).toBe(422);
  expect(res.body.code).toBe('ESPECIAL');
});

it('maps OriginLookupError to 502 ORIGIN_LOOKUP (distinct from a carrier error)', async () => {
  svc.quoteForCheckout.mockRejectedValue(new svc.OriginLookupError({ status: 404 }));
  const res = createRes();
  await getQuoteHandler()(createReq(body), res);
  expect(res.statusCode).toBe(502);
  expect(res.body.code).toBe('ORIGIN_LOOKUP');
});

it('includes origin lookup detail + status when ESHIP_API_DEBUG is "true"', async () => {
  const ORIGINAL = process.env.ESHIP_API_DEBUG;
  process.env.ESHIP_API_DEBUG = 'true';
  try {
    svc.quoteForCheckout.mockRejectedValue(
      Object.assign(new svc.OriginLookupError(), {
        status: 404,
        message: 'Request failed with status code 404',
      })
    );
    const res = createRes();
    await getQuoteHandler()(createReq(body), res);
    expect(res.body.code).toBe('ORIGIN_LOOKUP');
    expect(res.body.originStatus).toBe(404);
    expect(res.body.detail).toMatch(/404/);
  } finally {
    if (ORIGINAL === undefined) delete process.env.ESHIP_API_DEBUG;
    else process.env.ESHIP_API_DEBUG = ORIGINAL;
  }
});

it('maps any other error to 502 ESHIP_ERROR', async () => {
  svc.quoteForCheckout.mockRejectedValue(new Error('boom'));
  const res = createRes();
  await getQuoteHandler()(createReq(body), res);
  expect(res.statusCode).toBe(502);
  expect(res.body.code).toBe('ESHIP_ERROR');
});

describe('ESHIP_API_DEBUG response detail', () => {
  const ORIGINAL = process.env.ESHIP_API_DEBUG;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ESHIP_API_DEBUG;
    else process.env.ESHIP_API_DEBUG = ORIGINAL;
  });

  // Mirrors a real EshipApiError (carries .detail used by describeEshipError).
  const eshipError = () =>
    Object.assign(new Error('eShip API error 400: No couriers found for this account.'), {
      name: 'EshipApiError',
      status: 400,
      body: { status: 'ERROR', message: 'No couriers found for this account.' },
      detail: 'No couriers found for this account.',
    });

  it('omits eShip detail by default (live behavior)', async () => {
    delete process.env.ESHIP_API_DEBUG;
    svc.quoteForCheckout.mockRejectedValue(eshipError());
    const res = createRes();
    await getQuoteHandler()(createReq(body), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ code: 'ESHIP_ERROR' });
  });

  it('omits eShip detail when ESHIP_API_DEBUG is "false"', async () => {
    process.env.ESHIP_API_DEBUG = 'false';
    svc.quoteForCheckout.mockRejectedValue(eshipError());
    const res = createRes();
    await getQuoteHandler()(createReq(body), res);
    expect(res.body.detail).toBeUndefined();
  });

  it('includes the explicit eShip error + status + body when ESHIP_API_DEBUG is "true"', async () => {
    process.env.ESHIP_API_DEBUG = 'true';
    svc.quoteForCheckout.mockRejectedValue(eshipError());
    const res = createRes();
    await getQuoteHandler()(createReq(body), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.code).toBe('ESHIP_ERROR');
    expect(res.body.detail).toMatch(/No couriers found for this account\./);
    expect(res.body.eshipStatus).toBe(400);
    expect(res.body.eshipBody).toEqual({
      status: 'ERROR',
      message: 'No couriers found for this account.',
    });
  });

  it('falls back to the error message when there is no eShip body', async () => {
    process.env.ESHIP_API_DEBUG = 'true';
    svc.quoteForCheckout.mockRejectedValue(new Error('connect ETIMEDOUT'));
    const res = createRes();
    await getQuoteHandler()(createReq(body), res);
    expect(res.body.detail).toMatch(/connect ETIMEDOUT/);
  });
});
