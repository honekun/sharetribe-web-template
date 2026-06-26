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
  it('buckets FASTEST→express and CHEAPEST→estándar with marked-up prices', () => {
    const out = svc.buildBuckets([fastestRate, cheapestRate]);
    expect(out.nacionalExpress.amountSubunits).toBe(svc.__toSubunitsWithMarkup(100));
    expect(out.nacionalEstandar.amountSubunits).toBe(svc.__toSubunitsWithMarkup(80));
    expect(out.rawRates).toHaveLength(2);
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
    eship.quote.mockResolvedValue({ quot_id: 'q1', rates: [fastestRate] });
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
    eship.quote.mockResolvedValue({ quot_id: 'q1', rates: [fastestRate] });
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
  it('re-quotes on a cache miss (unknown token)', async () => {
    mockOrigin(origin);
    eship.quote.mockResolvedValue({ quot_id: 'q2', rates: [fastestRate] });
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
