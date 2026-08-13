'use strict';

const {
  authoritativeShippingDestination,
  buildAvShippingProtectedData,
  destinationFromShippingDetails,
  resolveAvShippingForOrder,
  withAvShippingProtectedData,
} = require('./avShipping');

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
    expect(out).toEqual({ resolvedRate: null, avShippingProtectedData: {} });
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
    expect(out).toEqual({ resolvedRate: null, avShippingProtectedData: {} });
  });
});

describe('withAvShippingProtectedData', () => {
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
