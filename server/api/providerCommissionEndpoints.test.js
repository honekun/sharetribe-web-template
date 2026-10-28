// AV: the three line-item endpoints charge the listing author's per-seller
// commission override (Console metadata `avCommissionPercentage`).

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
jest.mock('../api-util/avShipping', () => ({
  resolveAvShippingForOrder: jest.fn(() =>
    Promise.resolve({ resolvedRate: null, avShippingProtectedData: {} })
  ),
  withAvShippingProtectedData: jest.fn(() => ({})),
}));
jest.mock('../services/shippingQuoteService', () => ({ resolveBucketPrice: jest.fn() }));

const sdkUtils = require('../api-util/sdk');
const { transactionLineItems } = require('../api-util/lineItems');
const transactionLineItemsEndpoint = require('./transaction-line-items');
const initiatePrivileged = require('./initiate-privileged');
const transitionPrivileged = require('./transition-privileged');

const hostedCommission = {
  providerCommission: { percentage: 22, minimum_amount: 0 },
  customerCommission: { percentage: 0, minimum_amount: 0 },
};

const commissionResponse = {
  data: { data: [{ type: 'jsonAsset', attributes: { data: hostedCommission } }] },
};

const listing = {
  id: { uuid: 'listing-1' },
  type: 'listing',
  attributes: { price: { amount: 50000, currency: 'MXN' } },
  relationships: { author: { data: { id: { uuid: 'seller-1' }, type: 'user' } } },
};

const ownListing = {
  ...listing,
  type: 'ownListing',
  relationships: { author: { data: { id: { uuid: 'seller-1' }, type: 'currentUser' } } },
};

const author = (metadata, type = 'user') => ({
  id: { uuid: 'seller-1' },
  type,
  attributes: { profile: { metadata } },
});

// Resolves once the endpoint has answered, successfully or not.
const mockRes = () => {
  let done;
  const finished = new Promise(resolve => {
    done = resolve;
  });
  const res = {
    status: jest.fn(() => res),
    set: jest.fn(() => res),
    send: jest.fn(() => res),
    json: jest.fn(() => res),
    end: jest.fn(() => done()),
    finished,
  };
  sdkUtils.handleError.mockImplementation((r, e) => {
    r.error = e;
    done();
  });
  return res;
};

const trustedSdk = {
  transactions: {
    initiate: jest.fn(() => Promise.resolve({ status: 200, statusText: 'OK', data: {} })),
    initiateSpeculative: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
    transition: jest.fn(() => Promise.resolve({ status: 200, statusText: 'OK', data: {} })),
    transitionSpeculative: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
  },
};

const chargedProviderCommission = () => transactionLineItems.mock.calls[0][2];

beforeEach(() => {
  jest.clearAllMocks();
  sdkUtils.fetchCommission.mockResolvedValue(commissionResponse);
  sdkUtils.getTrustedSdk.mockResolvedValue(trustedSdk);
});

describe('transaction-line-items', () => {
  const run = async (included, isOwnListing = false) => {
    const responseListing = isOwnListing ? ownListing : listing;
    const sdk = {
      listings: { show: jest.fn().mockResolvedValue({ data: { data: listing, included } }) },
      ownListings: {
        show: jest.fn().mockResolvedValue({ data: { data: responseListing, included } }),
      },
    };
    sdkUtils.getSdk.mockReturnValue(sdk);
    const res = mockRes();
    transactionLineItemsEndpoint(
      { body: { isOwnListing, listingId: listing.id, orderData: {} } },
      res
    );
    await res.finished;
    return { res, sdk };
  };

  it('asks for the author and charges the override', async () => {
    const { res, sdk } = await run([author({ avCommissionPercentage: 15 })]);
    expect(sdk.listings.show).toHaveBeenCalledWith({ id: listing.id, include: ['author'] });
    expect(chargedProviderCommission()).toEqual({ percentage: 15 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('resolves the currentUser author on an own-listing preview', async () => {
    const { res, sdk } = await run([author({}, 'currentUser')], true);
    expect(sdk.ownListings.show).toHaveBeenCalledWith({ id: listing.id, include: ['author'] });
    expect(chargedProviderCommission()).toEqual(hostedCommission.providerCommission);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('charges the marketplace rate without an override', async () => {
    await run([author({})]);
    expect(chargedProviderCommission()).toEqual(hostedCommission.providerCommission);
  });

  it('fails instead of guessing when the author is missing', async () => {
    const { res } = await run([]);
    expect(transactionLineItems).not.toHaveBeenCalled();
    expect(res.error.message).toMatch(/Listing author unavailable/);
  });
});

describe('initiate-privileged', () => {
  const run = async included => {
    const sdk = {
      listings: { show: jest.fn().mockResolvedValue({ data: { data: listing, included } }) },
    };
    sdkUtils.getSdk.mockReturnValue(sdk);
    const res = mockRes();
    initiatePrivileged(
      {
        body: {
          isSpeculative: false,
          orderData: {},
          bodyParams: {
            transition: 'transition/request-payment',
            params: { listingId: listing.id },
          },
        },
      },
      res
    );
    await res.finished;
    return res;
  };

  it('charges the override at payment', async () => {
    const res = await run([author({ avCommissionPercentage: 0 })]);
    expect(chargedProviderCommission()).toEqual({ percentage: 0 });
    expect(trustedSdk.transactions.initiate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('charges the marketplace rate for an invalid override', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await run([author({ avCommissionPercentage: 40 })]);
    expect(chargedProviderCommission()).toEqual(hostedCommission.providerCommission);
    warn.mockRestore();
  });

  it('does not initiate a transaction when the author is missing', async () => {
    const res = await run([]);
    expect(trustedSdk.transactions.initiate).not.toHaveBeenCalled();
    expect(res.error.message).toMatch(/Listing author unavailable/);
  });
});

describe('transition-privileged', () => {
  const run = async included => {
    const transaction = {
      id: { uuid: 'tx-1' },
      type: 'transaction',
      attributes: { metadata: {}, transitions: [], payinTotal: null },
      relationships: { listing: { data: { id: listing.id, type: 'listing' } } },
    };
    const sdk = {
      transactions: {
        show: jest.fn().mockResolvedValue({
          data: { data: transaction, included: [listing, ...included] },
        }),
      },
    };
    sdkUtils.getSdk.mockReturnValue(sdk);
    const res = mockRes();
    transitionPrivileged(
      {
        body: {
          isSpeculative: false,
          orderData: {},
          bodyParams: {
            id: transaction.id,
            transition: 'transition/request-payment-after-inquiry',
            params: {},
          },
        },
      },
      res
    );
    await res.finished;
    return res;
  };

  it('charges the override from the included listing author', async () => {
    const res = await run([author({ avCommissionPercentage: 12.5 })]);
    expect(chargedProviderCommission()).toEqual({ percentage: 12.5 });
    expect(trustedSdk.transactions.transition).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not transition when the author is missing', async () => {
    const res = await run([]);
    expect(trustedSdk.transactions.transition).not.toHaveBeenCalled();
    expect(res.error.message).toMatch(/Listing author unavailable/);
  });
});
