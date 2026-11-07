'use strict';

const {
  AV_SHIPPING_FEE_INCLUDE_FOR,
  resolveAvShippingFee,
  authoritativeShippingDestination,
  buildAvShippingProtectedData,
  buildAvShippingRecord,
  destinationFromShippingDetails,
  findShippingFeeLineItem,
  persistAvShippingRecord,
  recordAvShippingMetadata,
  resolveAvShippingForOrder,
  shippingChargeMatches,
  withAvShippingProtectedData,
} = require('./avShipping');

const mockIntegrationSdk = { transactions: { updateMetadata: jest.fn() } };
jest.mock('../services/integrationSdk', () => ({ getIntegrationSdk: () => mockIntegrationSdk }));

it('builds avShipping protectedData from a resolved rate', () => {
  const out = buildAvShippingProtectedData(
    { avShippingType: 'nacionalExpress', avQuoteToken: 't' },
    {
      amountSubunits: 11800,
      currency: 'MXN',
      rate: { carrier: 'DHL', servicelevel: { token: 'x' }, rate_id: 'r1', quot_id: 'q1' },
    }
  );
  expect(out.avShipping).toMatchObject({
    bucket: 'nacionalExpress',
    carrier: 'DHL',
    rate_id: 'r1',
    quot_id: 'q1',
    amountSubunits: 11800,
    currency: 'MXN',
  });
});

it('converts persisted shippingDetails into the canonical eShip destination', () => {
  expect(
    destinationFromShippingDetails({
      name: 'Buyer',
      phoneNumber: '8181',
      address: {
        line1: 'Calle 1 22 Int. 3',
        line2: 'Centro',
        city: 'Monterrey',
        state: 'NL',
        postalCode: '64000',
        country: 'MX',
      },
    })
  ).toEqual({
    name: 'Buyer',
    street1: 'Calle 1 22 Int. 3',
    street2: 'Centro',
    city: 'Monterrey',
    state: 'NL',
    zip: '64000',
    country: 'MX',
    phone: '8181',
  });
});

it('only trusts avDestination during speculation', () => {
  const avDestination = { zip: '11111', state: 'XX' };
  const protectedDestination = {
    name: 'Buyer',
    address: {
      line1: 'Calle 1',
      city: 'Monterrey',
      state: 'NL',
      postalCode: '64000',
    },
  };
  const orderData = {
    avDestination,
    protectedData: { shippingDetails: protectedDestination },
  };

  expect(authoritativeShippingDestination(orderData, true)).toBe(avDestination);
  expect(authoritativeShippingDestination(orderData, false)).toEqual(
    expect.objectContaining({ zip: '64000', state: 'NL' })
  );
});

it('returns an empty object when there is no resolved rate', () => {
  expect(buildAvShippingProtectedData({}, null)).toEqual({});
});

describe('resolveAvShippingForOrder', () => {
  // Mirrors the shape resolveBucketPrice returns on a cache hit / re-quote.
  const rate = {
    amountSubunits: 11800,
    currency: 'MXN',
    rate: { carrier: 'DHL', servicelevel: { token: 'x' }, rate_id: 'r1', quot_id: 'q1' },
  };
  const destination = {
    name: 'Ana',
    street1: 'Calle 1',
    city: 'CDMX',
    state: 'CMX',
    postalCode: '01000',
  };
  const shippingDetails = {
    name: 'Ana',
    phoneNumber: '5555',
    address: {
      line1: 'Calle 1',
      city: 'CDMX',
      state: 'CMX',
      postalCode: '01000',
    },
  };
  const listing = { id: { uuid: 'l1' } };

  it('is a no-op for non-shipping orders and never calls the quote service', async () => {
    const resolveBucketPrice = jest.fn();
    const out = await resolveAvShippingForOrder({
      resolveBucketPrice,
      listing,
      fullOrderData: { deliveryMethod: 'pickup', avShippingType: 'nacionalExpress' },
      isSpeculative: false,
    });
    expect(out).toEqual({
      resolvedRate: null,
      avShippingProtectedData: {},
      avShippingRecord: null,
    });
    expect(resolveBucketPrice).not.toHaveBeenCalled();
  });

  it('quotes the speculative destination sent by the client', async () => {
    const resolveBucketPrice = jest.fn().mockResolvedValue(rate);
    const out = await resolveAvShippingForOrder({
      resolveBucketPrice,
      listing,
      fullOrderData: {
        deliveryMethod: 'shipping',
        avShippingType: 'nacionalExpress',
        avQuoteToken: 'tok',
        avDestination: destination,
        buyerEmail: 'a@example.com',
      },
      isSpeculative: true,
    });
    expect(resolveBucketPrice).toHaveBeenCalledWith({
      quoteToken: 'tok',
      avShippingType: 'nacionalExpress',
      listing,
      destination,
      buyerEmail: 'a@example.com',
    });
    expect(out.resolvedRate).toBe(rate);
    expect(out.avShippingProtectedData.avShipping).toMatchObject({ rate_id: 'r1' });
    // A speculation never creates the authoritative record.
    expect(out.avShippingRecord).toBeNull();
  });

  it('builds the authoritative record for a real shipping order', async () => {
    const out = await resolveAvShippingForOrder({
      resolveBucketPrice: jest.fn().mockResolvedValue(rate),
      listing,
      fullOrderData: {
        deliveryMethod: 'shipping',
        avShippingType: 'nacionalExpress',
        protectedData: { shippingDetails },
      },
      isSpeculative: false,
    });
    expect(out.avShippingRecord).toMatchObject({
      bucket: 'nacionalExpress',
      rate_id: 'r1',
      amountSubunits: rate.amountSubunits,
      currency: rate.currency,
    });
    expect(typeof out.avShippingRecord.recordedAt).toBe('string');
  });

  it('quotes the persisted shippingDetails — not avDestination — for a real order', async () => {
    const resolveBucketPrice = jest.fn().mockResolvedValue(rate);
    await resolveAvShippingForOrder({
      resolveBucketPrice,
      listing,
      fullOrderData: {
        deliveryMethod: 'shipping',
        avShippingType: 'nacionalExpress',
        avDestination: { name: 'Attacker', street1: 'elsewhere' },
        protectedData: { shippingDetails },
      },
      isSpeculative: false,
    });
    expect(resolveBucketPrice.mock.calls[0][0].destination).toMatchObject({
      name: 'Ana',
      street1: 'Calle 1',
      country: 'MX',
    });
  });

  it('rejects a real shipping order with no resolvable rate', async () => {
    await expect(
      resolveAvShippingForOrder({
        resolveBucketPrice: jest.fn().mockResolvedValue(null),
        listing,
        fullOrderData: {
          deliveryMethod: 'shipping',
          avShippingType: 'nacionalExpress',
          protectedData: { shippingDetails },
        },
        isSpeculative: false,
      })
    ).rejects.toMatchObject({ status: 422, data: { code: 'SHIPPING_QUOTE_REQUIRED' } });
  });

  it('rejects a real shipping order with an incomplete destination', async () => {
    await expect(
      resolveAvShippingForOrder({
        resolveBucketPrice: jest.fn().mockResolvedValue(rate),
        listing,
        fullOrderData: {
          deliveryMethod: 'shipping',
          avShippingType: 'nacionalExpress',
          protectedData: { shippingDetails: { name: 'Ana' } },
        },
        isSpeculative: false,
      })
    ).rejects.toMatchObject({ data: { code: 'SHIPPING_QUOTE_REQUIRED' } });
  });

  it('tolerates a speculative order that has no destination yet', async () => {
    const out = await resolveAvShippingForOrder({
      resolveBucketPrice: jest.fn().mockResolvedValue(null),
      listing,
      fullOrderData: { deliveryMethod: 'shipping' },
      isSpeculative: true,
    });
    expect(out).toEqual({
      resolvedRate: null,
      avShippingProtectedData: {},
      avShippingRecord: null,
    });
  });
});

describe('withAvShippingProtectedData', () => {
  it('drops a caller-authored avShipping even when nothing resolved (pickup)', () => {
    expect(
      withAvShippingProtectedData(
        { protectedData: { a: 1, avShipping: { rate_id: 'forged', amountSubunits: 1 } } },
        {}
      )
    ).toEqual({ protectedData: { a: 1 } });
  });

  it('replaces a caller-authored avShipping with the server one', () => {
    expect(
      withAvShippingProtectedData(
        { protectedData: { a: 1, avShipping: { rate_id: 'forged' } } },
        { avShipping: { rate_id: 'r1' } }
      )
    ).toEqual({ protectedData: { a: 1, avShipping: { rate_id: 'r1' } } });
  });

  it('returns nothing when no shipping data resolved', () => {
    expect(withAvShippingProtectedData({ protectedData: { a: 1 } }, {})).toEqual({});
  });

  it('merges into existing protectedData without dropping it', () => {
    expect(
      withAvShippingProtectedData({ protectedData: { a: 1 } }, { avShipping: { rate_id: 'r1' } })
    ).toEqual({ protectedData: { a: 1, avShipping: { rate_id: 'r1' } } });
  });

  it('works when the params carry no protectedData at all', () => {
    expect(withAvShippingProtectedData(undefined, { avShipping: { rate_id: 'r1' } })).toEqual({
      protectedData: { avShipping: { rate_id: 'r1' } },
    });
  });
});

describe('resolveAvShippingFee', () => {
  const rate = { amountSubunits: 11800, currency: 'MXN', rate: { rate_id: 'r1' } };
  const shipping = { deliveryMethod: 'shipping', avShippingType: 'nacionalExpress' };

  it('keeps the shipping fee off the provider payout', () => {
    // AV buys the label centrally, so the buyer's shipping payment stays with the platform.
    expect(AV_SHIPPING_FEE_INCLUDE_FOR).toEqual(['customer']);
  });

  it('returns null for a non-shipping order without quoting', async () => {
    const resolveBucketPrice = jest.fn();
    expect(
      await resolveAvShippingFee({
        resolveBucketPrice,
        orderData: { deliveryMethod: 'pickup', avShippingType: 'nacionalExpress' },
        currency: 'MXN',
      })
    ).toBeNull();
    expect(resolveBucketPrice).not.toHaveBeenCalled();
  });

  it('does not quote before the buyer has chosen a delivery type', async () => {
    const resolveBucketPrice = jest.fn();
    expect(
      await resolveAvShippingFee({
        resolveBucketPrice,
        orderData: { deliveryMethod: 'shipping' },
        currency: 'MXN',
      })
    ).toBeNull();
    expect(resolveBucketPrice).not.toHaveBeenCalled();
  });

  it('quotes and returns a Money at the resolved amount', async () => {
    const fee = await resolveAvShippingFee({
      resolveBucketPrice: jest.fn().mockResolvedValue(rate),
      orderData: shipping,
      currency: 'MXN',
    });
    expect(fee.amount).toEqual(11800);
    expect(fee.currency).toEqual('MXN');
  });

  it('falls back to the listing currency when the rate omits one', async () => {
    const fee = await resolveAvShippingFee({
      resolveBucketPrice: jest.fn().mockResolvedValue({ amountSubunits: 500 }),
      orderData: shipping,
      currency: 'MXN',
    });
    expect(fee.currency).toEqual('MXN');
  });

  it('uses a pre-resolved rate instead of quoting again', async () => {
    const resolveBucketPrice = jest.fn();
    const fee = await resolveAvShippingFee({
      resolveBucketPrice,
      orderData: shipping,
      currency: 'MXN',
      options: { resolvedShippingRate: rate },
    });
    expect(fee.amount).toEqual(11800);
    expect(resolveBucketPrice).not.toHaveBeenCalled();
  });

  it('treats an explicit pre-resolved null as "resolved to nothing", not "unresolved"', async () => {
    const resolveBucketPrice = jest.fn();
    expect(
      await resolveAvShippingFee({
        resolveBucketPrice,
        orderData: shipping,
        currency: 'MXN',
        options: { resolvedShippingRate: null },
      })
    ).toBeNull();
    expect(resolveBucketPrice).not.toHaveBeenCalled();
  });
});

describe('buildAvShippingRecord', () => {
  it('returns null without a resolved rate', () => {
    expect(buildAvShippingRecord({}, null)).toBeNull();
  });

  it('stamps the record with the recording time', () => {
    const now = new Date('2026-11-06T12:00:00.000Z');
    expect(
      buildAvShippingRecord(
        { avShippingType: 'nacionalEstandar' },
        { amountSubunits: 9900, currency: 'MXN', rate: { rate_id: 'r9', quot_id: 'q9' } },
        now
      )
    ).toEqual({
      bucket: 'nacionalEstandar',
      quot_id: 'q9',
      rate_id: 'r9',
      carrier: null,
      servicelevel: null,
      amountSubunits: 9900,
      currency: 'MXN',
      recordedAt: '2026-11-06T12:00:00.000Z',
    });
  });
});

describe('recordAvShippingMetadata / persistAvShippingRecord', () => {
  const record = { rate_id: 'r1', amountSubunits: 11800, currency: 'MXN' };

  beforeEach(() => {
    mockIntegrationSdk.transactions.updateMetadata.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes only the avShipping metadata key', async () => {
    mockIntegrationSdk.transactions.updateMetadata.mockResolvedValue({});
    await expect(
      recordAvShippingMetadata(mockIntegrationSdk, { uuid: 'tx-1' }, record)
    ).resolves.toBe(true);
    const [params] = mockIntegrationSdk.transactions.updateMetadata.mock.calls[0];
    expect(params.id.uuid).toBe('tx-1');
    expect(params.metadata).toEqual({ avShipping: record });
  });

  it('never throws when the write keeps failing', async () => {
    mockIntegrationSdk.transactions.updateMetadata.mockRejectedValue(new Error('down'));
    await expect(recordAvShippingMetadata(mockIntegrationSdk, 'tx-1', record)).resolves.toBe(false);
    expect(mockIntegrationSdk.transactions.updateMetadata).toHaveBeenCalledTimes(2);
  });

  it('skips the write without a record or id', async () => {
    await expect(recordAvShippingMetadata(mockIntegrationSdk, null, record)).resolves.toBe(false);
    await expect(recordAvShippingMetadata(mockIntegrationSdk, 'tx-1', null)).resolves.toBe(false);
    expect(mockIntegrationSdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });

  it('returns the API response unchanged and takes the id from it', async () => {
    mockIntegrationSdk.transactions.updateMetadata.mockResolvedValue({});
    const apiResponse = { status: 200, data: { data: { id: { uuid: 'tx-2' } } } };
    await expect(persistAvShippingRecord(apiResponse, record)).resolves.toBe(apiResponse);
    expect(mockIntegrationSdk.transactions.updateMetadata.mock.calls[0][0].id.uuid).toBe('tx-2');
  });

  it('prefers an explicit transaction id (transition endpoint)', async () => {
    mockIntegrationSdk.transactions.updateMetadata.mockResolvedValue({});
    await persistAvShippingRecord({ data: { data: {} } }, record, 'tx-3');
    expect(mockIntegrationSdk.transactions.updateMetadata.mock.calls[0][0].id.uuid).toBe('tx-3');
  });

  it('does nothing without a record (pickup or speculation)', async () => {
    const apiResponse = { data: { data: { id: { uuid: 'tx-4' } } } };
    await expect(persistAvShippingRecord(apiResponse, null)).resolves.toBe(apiResponse);
    expect(mockIntegrationSdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });
});

describe('shipping charge binding', () => {
  const money = (amount, currency = 'MXN') => ({ amount, currency });
  const fee = (amount, overrides = {}) => ({
    code: 'line-item/shipping-fee',
    unitPrice: money(amount),
    lineTotal: money(amount),
    quantity: 1,
    includeFor: ['customer'],
    reversal: false,
    ...overrides,
  });
  const item = { code: 'line-item/item', lineTotal: money(50000), includeFor: ['customer'] };
  const record = { rate_id: 'r1', amountSubunits: 11800, currency: 'MXN' };

  it('finds the customer shipping fee and ignores reversals', () => {
    expect(findShippingFeeLineItem([item, fee(11800, { reversal: true })])).toBeNull();
    expect(findShippingFeeLineItem([item, fee(11800)])).toMatchObject({ lineTotal: money(11800) });
    expect(findShippingFeeLineItem(undefined)).toBeNull();
  });

  it('matches only the recorded amount and currency', () => {
    expect(shippingChargeMatches([item, fee(11800)], record)).toBe(true);
    expect(shippingChargeMatches([item, fee(11700)], record)).toBe(false);
    expect(
      shippingChargeMatches([item, { ...fee(11800), lineTotal: money(11800, 'USD') }], record)
    ).toBe(false);
  });

  it('never matches a pickup transaction or a missing record', () => {
    expect(shippingChargeMatches([item], record)).toBe(false);
    expect(shippingChargeMatches([item, fee(11800)], null)).toBe(false);
    expect(shippingChargeMatches([item, fee(11800)], { ...record, amountSubunits: '11800' })).toBe(
      false
    );
  });

  it('ignores a fee the customer does not pay', () => {
    expect(shippingChargeMatches([fee(11800, { includeFor: ['provider'] })], record)).toBe(false);
  });
});
