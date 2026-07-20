'use strict';

jest.mock('../api-util/eshipClient');
jest.mock('./integrationSdk');
const eship = require('../api-util/eshipClient');
const { getIntegrationSdk } = require('./integrationSdk');
const svc = require('./shippingQuoteService');

const listing = (publicData, authorId = 'author-1') => ({
  id: { uuid: 'l1' },
  attributes: { publicData },
  author: { id: { uuid: authorId } },
});
const destination = {
  name: 'Buyer',
  street1: 'C 1',
  city: 'MTY',
  state: 'NL',
  zip: '64000',
  country: 'MX',
  phone: '8181',
};
const origin = {
  name: 'Seller',
  street1: 'A 2',
  city: 'CDMX',
  state: 'CDMX',
  zip: '06700',
  phone: '5555',
};

const mockOrigin = shippingOrigin =>
  getIntegrationSdk.mockReturnValue({
    users: {
      show: async () => ({
        data: { data: { attributes: { profile: { protectedData: { shippingOrigin } } } } },
      }),
    },
  });

const fastestRate = {
  rate_id: 'r1',
  provider: 'DHL',
  currency: 'MXN',
  days: 2,
  amount: 100,
  servicelevel: { name: 'Exp', token: 'dhl_exp' },
  tags: ['FASTEST'],
};
const cheapestRate = {
  rate_id: 'r2',
  provider: 'Estafeta',
  currency: 'MXN',
  days: 5,
  amount: 80,
  servicelevel: { name: 'Eco', token: 'est_eco' },
  tags: ['CHEAPEST'],
};

beforeEach(() => {
  eship.quote.mockReset();
  getIntegrationSdk.mockReset();
});

describe('resolveOrigin', () => {
  // The real sdk.listings.show response (no include) carries the author only as a
  // relationship reference, not a denormalized `author` object.
  const relListing = authorId => ({
    id: { uuid: 'l1' },
    attributes: { publicData: { avPackageSize: 'M' } },
    relationships: { author: { data: { id: { uuid: authorId } } } },
  });

  it('resolves the author id from relationships when author is not denormalized', async () => {
    mockOrigin(origin);
    const result = await svc.resolveOrigin(relListing('author-9'));
    expect(getIntegrationSdk().users.show).toBeDefined();
    expect(result).toEqual(origin);
  });

  it('returns null when neither author nor relationships carry an id', async () => {
    const result = await svc.resolveOrigin({ id: { uuid: 'l1' }, attributes: {} });
    expect(result).toBe(null);
  });

  it('throws OriginLookupError (not NoOrigin) when the Integration call fails', async () => {
    // A 404 here = author absent from the Integration app's marketplace (a
    // Marketplace/Integration credential-env mismatch). Must be distinct from
    // "seller saved no origin" so the endpoint can report it separately.
    const err = Object.assign(new Error('Request failed with status code 404'), { status: 404 });
    getIntegrationSdk.mockReturnValue({
      users: {
        show: async () => {
          throw err;
        },
      },
    });
    await expect(svc.resolveOrigin(relListing('author-9'))).rejects.toBeInstanceOf(
      svc.OriginLookupError
    );
    await expect(svc.resolveOrigin(relListing('author-9'))).rejects.toMatchObject({ status: 404 });
  });
});

describe('resolveParcel', () => {
  it('returns dims+weight for a sized listing', () => {
    expect(svc.resolveParcel(listing({ avPackageSize: 'M' }))).toMatchObject({
      length: 35,
      width: 30,
      height: 10,
      distance_unit: 'cm',
      weight: 1,
      mass_unit: 'kg',
    });
  });
  it('returns null for especial', () => {
    expect(svc.resolveParcel(listing({ avPackageSize: 'especial' }))).toBe(null);
  });
});

describe('buildBuckets', () => {
  const rate = (rate_id, days, amount, tags = []) => ({
    rate_id,
    provider: 'C',
    currency: 'MXN',
    days,
    amount,
    servicelevel: { name: rate_id },
    tags,
  });

  it('estándar = cheapest overall; express = fewest days then cheapest', () => {
    const out = svc.buildBuckets([rate('a', 2, 100), rate('b', 5, 80)]);
    expect(out.nacionalEstandar.amountSubunits).toBe(svc.__toSubunitsWithMarkup(80)); // cheapest
    expect(out.nacionalExpress.amountSubunits).toBe(svc.__toSubunitsWithMarkup(100)); // fewest days
    expect(out.rawRates).toHaveLength(2);
  });

  it('express picks the cheapest among the rates sharing the fewest days', () => {
    // days: a,b = 2 (fastest); c = 5. Express must be the cheaper of a/b (b=150).
    const out = svc.buildBuckets([rate('a', 2, 200), rate('b', 2, 150), rate('c', 5, 80)]);
    expect(out.nacionalExpress.amountSubunits).toBe(svc.__toSubunitsWithMarkup(150));
    expect(out.nacionalEstandar.amountSubunits).toBe(svc.__toSubunitsWithMarkup(80));
  });

  it('fills BOTH buckets from a single rate when only one is returned', () => {
    const out = svc.buildBuckets([rate('solo', 3, 120)]);
    expect(out.nacionalExpress.amountSubunits).toBe(svc.__toSubunitsWithMarkup(120));
    expect(out.nacionalEstandar.amountSubunits).toBe(svc.__toSubunitsWithMarkup(120));
  });

  it('selects on price/days, ignoring eShip FASTEST/CHEAPEST tags', () => {
    // Tags deliberately contradict the numbers.
    const out = svc.buildBuckets([rate('a', 2, 100, ['CHEAPEST']), rate('b', 5, 80, ['FASTEST'])]);
    expect(out.nacionalEstandar.amountSubunits).toBe(svc.__toSubunitsWithMarkup(80)); // truly cheapest
    expect(out.nacionalExpress.amountSubunits).toBe(svc.__toSubunitsWithMarkup(100)); // truly fastest
  });

  it('returns only rawRates when there are no rates', () => {
    const out = svc.buildBuckets([]);
    expect(out.rawRates).toEqual([]);
    expect(out.nacionalExpress).toBeUndefined();
    expect(out.nacionalEstandar).toBeUndefined();
  });
});

describe('quoteForCheckout', () => {
  it('throws EspecialError for especial listings', async () => {
    await expect(
      svc.quoteForCheckout({
        listing: listing({ avPackageSize: 'especial' }),
        destination,
        buyerEmail: 'b@x.com',
      })
    ).rejects.toBeInstanceOf(svc.EspecialError);
  });
  it('throws NoOriginError when the seller has no origin', async () => {
    mockOrigin(undefined);
    await expect(
      svc.quoteForCheckout({
        listing: listing({ avPackageSize: 'M' }),
        destination,
        buyerEmail: 'b@x.com',
      })
    ).rejects.toBeInstanceOf(svc.NoOriginError);
  });
  it('returns a token + buckets on success', async () => {
    mockOrigin(origin);
    eship.quote.mockResolvedValue({ object_id: 'q1', rates: [fastestRate] });
    const res = await svc.quoteForCheckout({
      listing: listing({ avPackageSize: 'M' }),
      destination,
      buyerEmail: 'b@x.com',
    });
    expect(res.quoteToken).toEqual(expect.any(String));
    expect(res.express.amountSubunits).toBeGreaterThan(0);
  });
});

describe('resolveBucketPrice', () => {
  it('returns the pinned amount from cache on a hit', async () => {
    mockOrigin(origin);
    eship.quote.mockResolvedValue({ object_id: 'q1', rates: [fastestRate] });
    const { quoteToken, express } = await svc.quoteForCheckout({
      listing: listing({ avPackageSize: 'M' }),
      destination,
      buyerEmail: 'b@x.com',
    });
    eship.quote.mockClear();
    const fee = await svc.resolveBucketPrice({
      quoteToken,
      avShippingType: 'nacionalExpress',
      listing: listing({ avPackageSize: 'M' }),
      destination,
      buyerEmail: 'b@x.com',
    });
    expect(fee.amountSubunits).toBe(express.amountSubunits);
    expect(eship.quote).not.toHaveBeenCalled(); // cache hit, no re-quote
  });
  it('does not accept a token created for a different listing', async () => {
    mockOrigin(origin);
    eship.quote.mockResolvedValue({ object_id: 'q1', rates: [fastestRate] });
    const { quoteToken } = await svc.quoteForCheckout({
      listing: listing({ avPackageSize: 'M' }),
      destination,
      buyerEmail: 'b@x.com',
    });
    eship.quote.mockClear();
    eship.quote.mockResolvedValue({ object_id: 'q2', rates: [fastestRate] });

    await svc.resolveBucketPrice({
      quoteToken,
      avShippingType: 'nacionalExpress',
      listing: { ...listing({ avPackageSize: 'M' }), id: { uuid: 'l2' } },
      destination,
      buyerEmail: 'b@x.com',
    });

    expect(eship.quote).toHaveBeenCalledTimes(1);
  });
  it('does not accept a token created for a different destination', async () => {
    mockOrigin(origin);
    eship.quote.mockResolvedValue({ object_id: 'q1', rates: [fastestRate] });
    const { quoteToken } = await svc.quoteForCheckout({
      listing: listing({ avPackageSize: 'M' }),
      destination,
      buyerEmail: 'b@x.com',
    });
    eship.quote.mockClear();
    eship.quote.mockResolvedValue({ object_id: 'q2', rates: [fastestRate] });

    await svc.resolveBucketPrice({
      quoteToken,
      avShippingType: 'nacionalExpress',
      listing: listing({ avPackageSize: 'M' }),
      destination: { ...destination, zip: '44100', state: 'JAL' },
      buyerEmail: 'b@x.com',
    });

    expect(eship.quote).toHaveBeenCalledTimes(1);
  });
  it('re-quotes on a cache miss (unknown token)', async () => {
    mockOrigin(origin);
    eship.quote.mockResolvedValue({ object_id: 'q2', rates: [fastestRate] });
    const fee = await svc.resolveBucketPrice({
      quoteToken: 'nope',
      avShippingType: 'nacionalExpress',
      listing: listing({ avPackageSize: 'M' }),
      destination,
      buyerEmail: 'b@x.com',
    });
    expect(eship.quote).toHaveBeenCalledTimes(1);
    expect(fee.amountSubunits).toBeGreaterThan(0);
    expect(fee.rate.quot_id).toBe('q2');
  });
  it('returns null without quoting when no delivery type is chosen', async () => {
    const fee = await svc.resolveBucketPrice({
      quoteToken: undefined,
      avShippingType: undefined,
      listing: listing({ avPackageSize: 'M' }),
      destination: undefined,
      buyerEmail: undefined,
    });
    expect(fee).toBe(null);
    expect(eship.quote).not.toHaveBeenCalled();
  });

  it('returns null without quoting on a cache miss when there is no destination', async () => {
    const fee = await svc.resolveBucketPrice({
      quoteToken: 'unknown',
      avShippingType: 'nacionalExpress',
      listing: listing({ avPackageSize: 'M' }),
      destination: undefined,
      buyerEmail: undefined,
    });
    expect(fee).toBe(null);
    expect(eship.quote).not.toHaveBeenCalled();
  });

  it('returns null for an especial listing', async () => {
    const fee = await svc.resolveBucketPrice({
      quoteToken: 'x',
      avShippingType: 'nacionalExpress',
      listing: listing({ avPackageSize: 'especial' }),
      destination,
      buyerEmail: 'b@x.com',
    });
    expect(fee).toBe(null);
  });
});
