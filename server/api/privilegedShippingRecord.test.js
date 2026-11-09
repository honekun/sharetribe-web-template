// AV (audit A01): the privileged endpoints own the shipping record. A caller can
// never author `protectedData.avShipping`, and a real shipping order gets its
// authoritative `metadata.avShipping` written by the server.

jest.mock('../api-util/sdk', () => ({
  getSdk: jest.fn(),
  getTrustedSdk: jest.fn(),
  createCookieTokenStore: jest.fn(() => ({})),
  fetchCommission: jest.fn(),
  handleError: jest.fn(),
  serialize: jest.fn(data => data),
}));
jest.mock('../api-util/lineItems', () => ({
  transactionLineItems: jest.fn(() => Promise.resolve([])),
}));
jest.mock('../services/shippingQuoteService', () => ({ resolveBucketPrice: jest.fn() }));
const mockIntegrationSdk = { transactions: { updateMetadata: jest.fn() } };
jest.mock('../services/integrationSdk', () => ({ getIntegrationSdk: () => mockIntegrationSdk }));

const sdkUtils = require('../api-util/sdk');
const { resolveBucketPrice } = require('../services/shippingQuoteService');
const initiatePrivileged = require('./initiate-privileged');
const transitionPrivileged = require('./transition-privileged');

const commissionResponse = {
  data: { data: [{ type: 'jsonAsset', attributes: { data: {} } }] },
};

const listing = {
  id: { uuid: 'listing-1' },
  type: 'listing',
  attributes: { price: { amount: 50000, currency: 'MXN' } },
  relationships: { author: { data: { id: { uuid: 'seller-1' }, type: 'user' } } },
};
const included = [{ id: { uuid: 'seller-1' }, type: 'user', attributes: { profile: {} } }];

const shippingDetails = {
  name: 'Ana',
  phoneNumber: '5555',
  address: { line1: 'Calle 1', city: 'CDMX', state: 'CMX', postalCode: '01000' },
};
const forged = { rate_id: 'forged-rate', amountSubunits: 1, currency: 'MXN' };
const resolvedRate = {
  amountSubunits: 11800,
  currency: 'MXN',
  rate: { rate_id: 'rate-1', quot_id: 'quot-1', carrier: 'DHL', servicelevel: 'express' },
};

const mockRes = () => {
  let done;
  const finished = new Promise(resolve => {
    done = resolve;
  });
  const res = {
    status: jest.fn(() => res),
    set: jest.fn(() => res),
    send: jest.fn(() => res),
    end: jest.fn(() => done()),
    finished,
  };
  sdkUtils.handleError.mockImplementation((r, e) => {
    r.error = e;
    done();
  });
  return res;
};

const createdTx = { id: { uuid: 'tx-1' }, type: 'transaction' };
const trustedSdk = {
  transactions: {
    initiate: jest.fn(() => Promise.resolve({ status: 200, data: { data: createdTx } })),
    initiateSpeculative: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
    transition: jest.fn(() => Promise.resolve({ status: 200, data: { data: createdTx } })),
  },
};

const sentParams = sdkFn => sdkFn.mock.calls[0][0].params;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  sdkUtils.fetchCommission.mockResolvedValue(commissionResponse);
  sdkUtils.getTrustedSdk.mockResolvedValue(trustedSdk);
  sdkUtils.getSdk.mockReturnValue({
    listings: { show: jest.fn().mockResolvedValue({ data: { data: listing, included } }) },
    transactions: {
      show: jest.fn().mockResolvedValue({
        data: {
          data: {
            id: createdTx.id,
            attributes: { metadata: {}, transitions: [] },
            relationships: { listing: { data: { id: listing.id, type: 'listing' } } },
          },
          included: [listing, ...included],
        },
      }),
    },
  });
  mockIntegrationSdk.transactions.updateMetadata.mockResolvedValue({});
  resolveBucketPrice.mockResolvedValue(resolvedRate);
});

afterEach(() => jest.restoreAllMocks());

const initiate = async ({ orderData, protectedData, isSpeculative = false }) => {
  const res = mockRes();
  initiatePrivileged(
    {
      body: {
        isSpeculative,
        orderData,
        bodyParams: {
          transition: 'transition/request-payment',
          params: { listingId: listing.id, protectedData },
        },
        queryParams: {},
      },
    },
    res
  );
  await res.finished;
  return res;
};

describe('initiate-privileged shipping record', () => {
  it('drops a caller-authored avShipping on a pickup order and records nothing', async () => {
    const res = await initiate({
      orderData: { deliveryMethod: 'pickup' },
      protectedData: { deliveryMethod: 'pickup', avShipping: forged },
    });

    expect(res.error).toBeUndefined();
    expect(sentParams(trustedSdk.transactions.initiate).protectedData).toEqual({
      deliveryMethod: 'pickup',
    });
    expect(mockIntegrationSdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });

  it('replaces the caller copy and writes the server record for a shipping order', async () => {
    const res = await initiate({
      orderData: { deliveryMethod: 'shipping', avShippingType: 'nacionalExpress' },
      protectedData: { shippingDetails, avShipping: forged },
    });

    expect(res.error).toBeUndefined();
    const { protectedData } = sentParams(trustedSdk.transactions.initiate);
    expect(protectedData.avShipping).toMatchObject({ rate_id: 'rate-1', amountSubunits: 11800 });

    expect(mockIntegrationSdk.transactions.updateMetadata).toHaveBeenCalledTimes(1);
    const [write] = mockIntegrationSdk.transactions.updateMetadata.mock.calls[0];
    expect(write.id.uuid).toBe('tx-1');
    expect(write.metadata.avShipping).toMatchObject({
      rate_id: 'rate-1',
      quot_id: 'quot-1',
      amountSubunits: 11800,
      currency: 'MXN',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('never writes a record for a speculative call', async () => {
    await initiate({
      orderData: { deliveryMethod: 'shipping', avShippingType: 'nacionalExpress' },
      protectedData: { shippingDetails },
      isSpeculative: true,
    });
    expect(trustedSdk.transactions.initiateSpeculative).toHaveBeenCalled();
    expect(mockIntegrationSdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });

  it('answers the buyer without waiting for the metadata write', async () => {
    mockIntegrationSdk.transactions.updateMetadata.mockReturnValue(new Promise(() => {}));
    const res = await initiate({
      orderData: { deliveryMethod: 'shipping', avShippingType: 'nacionalExpress' },
      protectedData: { shippingDetails },
    });
    expect(res.error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockIntegrationSdk.transactions.updateMetadata).toHaveBeenCalledTimes(1);
    // The fallback the label step uses if that write never lands.
    expect(sentParams(trustedSdk.transactions.initiate).protectedData.avShipping).toMatchObject({
      rate_id: 'rate-1',
    });
  });

  it('still answers the buyer when the metadata write fails', async () => {
    mockIntegrationSdk.transactions.updateMetadata.mockRejectedValue(new Error('down'));
    const res = await initiate({
      orderData: { deliveryMethod: 'shipping', avShippingType: 'nacionalExpress' },
      protectedData: { shippingDetails },
    });
    expect(res.error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('transition-privileged shipping record', () => {
  const transition = async ({ orderData, protectedData }) => {
    const res = mockRes();
    transitionPrivileged(
      {
        body: {
          isSpeculative: false,
          orderData,
          bodyParams: {
            id: createdTx.id,
            transition: 'transition/request-payment-after-inquiry',
            params: { protectedData },
          },
          queryParams: {},
        },
      },
      res
    );
    await res.finished;
    return res;
  };

  it('drops a caller-authored avShipping on pickup', async () => {
    const res = await transition({
      orderData: { deliveryMethod: 'pickup' },
      protectedData: { avShipping: forged },
    });
    expect(res.error).toBeUndefined();
    expect(sentParams(trustedSdk.transactions.transition).protectedData).toEqual({});
    expect(mockIntegrationSdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });

  it('records the rate against the transitioned transaction', async () => {
    await transition({
      orderData: { deliveryMethod: 'shipping', avShippingType: 'nacionalExpress' },
      protectedData: { shippingDetails },
    });
    const [write] = mockIntegrationSdk.transactions.updateMetadata.mock.calls[0];
    expect(write.id.uuid).toBe('tx-1');
    expect(write.metadata.avShipping).toMatchObject({ rate_id: 'rate-1' });
  });
});
