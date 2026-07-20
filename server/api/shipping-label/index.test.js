'use strict';

jest.mock('../../api-util/sdk');
jest.mock('../../services/integrationSdk');
jest.mock('../../services/shipmentService');
const { getSdk } = require('../../api-util/sdk');
const { getIntegrationSdk } = require('../../services/integrationSdk');
const shipmentService = require('../../services/shipmentService');
const rateLimiter = require('./rateLimiter');
const router = require('./index');

// Pull the POST /label handler off the router (mirrors shipping-quote's test).
function getLabelHandler() {
  const layer = router.stack.find(l => l.route?.path === '/label' && l.route.methods?.post);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

const createReq = body => ({ body });
const createRes = () => ({
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
});

const PROVIDER_ID = 'provider-1';
const currentUser = (id = PROVIDER_ID, email = 'seller@x.com') => ({
  data: { data: { id: { uuid: id }, attributes: { email } } },
});
const txShow = (providerId = PROVIDER_ID) => ({
  data: { data: { relationships: { provider: { data: { id: { uuid: providerId } } } } } },
});
const fullTx = { id: { uuid: 'tx-1' }, attributes: { protectedData: {}, metadata: {} } };

let callerSdk;

beforeEach(() => {
  jest.clearAllMocks();
  rateLimiter._test.store.clear();
  callerSdk = {
    currentUser: { show: jest.fn().mockResolvedValue(currentUser()) },
    transactions: { show: jest.fn().mockResolvedValue(txShow()) },
  };
  getSdk.mockReturnValue(callerSdk);
  getIntegrationSdk.mockReturnValue({
    transactions: { show: jest.fn().mockResolvedValue({ data: { data: fullTx } }) },
  });
});

async function run(body) {
  const req = createReq(body);
  const res = createRes();
  await getLabelHandler()(req, res);
  return res;
}

it('returns 400 when transactionId is missing', async () => {
  const res = await run({});
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('BAD_REQUEST');
});

it('returns 401 when the caller is not signed in', async () => {
  callerSdk.currentUser.show.mockResolvedValue({ data: { data: null } });
  const res = await run({ transactionId: 'tx-1' });
  expect(res.statusCode).toBe(401);
});

it('returns 403 when the caller is not the transaction provider', async () => {
  callerSdk.currentUser.show.mockResolvedValue(currentUser('someone-else', 'other@x.com'));
  const res = await run({ transactionId: 'tx-1' });
  expect(res.statusCode).toBe(403);
  expect(shipmentService.buyLabelForTransaction).not.toHaveBeenCalled();
});

it('returns 404 when the caller cannot see the transaction', async () => {
  callerSdk.transactions.show.mockRejectedValue(Object.assign(new Error('nf'), { status: 404 }));
  const res = await run({ transactionId: 'tx-1' });
  expect(res.statusCode).toBe(404);
});

it('buys the label (force) and returns 200 + avLabel when the provider retries', async () => {
  const avLabel = { status: 'purchased', labelUrl: 'https://l/1.pdf' };
  shipmentService.buyLabelForTransaction.mockResolvedValue(avLabel);

  const res = await run({ transactionId: 'tx-1' });

  expect(shipmentService.buyLabelForTransaction).toHaveBeenCalledWith(expect.anything(), fullTx, {
    force: true,
  });
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ avLabel });
});

it('returns 422 when there is nothing to buy (especial / Contactar AV)', async () => {
  shipmentService.buyLabelForTransaction.mockResolvedValue(null);
  const res = await run({ transactionId: 'tx-1' });
  expect(res.statusCode).toBe(422);
  expect(res.body.code).toBe('ESPECIAL');
});

it('returns 502 LABEL_FAILED when the carrier rejects the retry', async () => {
  shipmentService.buyLabelForTransaction.mockResolvedValue({
    status: 'failed',
    error: 'rate expired',
  });
  const res = await run({ transactionId: 'tx-1' });
  expect(res.statusCode).toBe(502);
  expect(res.body.code).toBe('LABEL_FAILED');
  expect(res.body.avLabel.status).toBe('failed');
});

it('rate-limits repeated retries per user with 429', async () => {
  shipmentService.buyLabelForTransaction.mockResolvedValue({ status: 'purchased' });
  let last;
  for (let i = 0; i < 12; i++) {
    // eslint-disable-next-line no-await-in-loop
    last = await run({ transactionId: 'tx-1' });
  }
  expect(last.statusCode).toBe(429);
  expect(last.body.code).toBe('RATE_LIMITED');
});
