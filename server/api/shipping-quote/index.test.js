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

beforeEach(() => {
  jest.clearAllMocks();
  getSdk.mockReturnValue({ listings: { show: async () => listingShow() } });
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

it('maps any other error to 502 ESHIP_ERROR', async () => {
  svc.quoteForCheckout.mockRejectedValue(new Error('boom'));
  const res = createRes();
  await getQuoteHandler()(createReq(body), res);
  expect(res.statusCode).toBe(502);
  expect(res.body.code).toBe('ESHIP_ERROR');
});
