'use strict';

const fs = require('fs');
const path = require('path');

const {
  ASSET_PATH,
  DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS,
  resolveListingMinimumPrice,
} = require('./listingMinimumPrice');

const sdkReturning = data => ({
  assetsByAlias: jest.fn(() =>
    Promise.resolve({ data: { data: data ? [{ type: 'jsonAsset', attributes: { data } }] : [] } })
  ),
});

describe('resolveListingMinimumPrice', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it('reads the Console subunit amount', async () => {
    const sdk = sdkReturning({ listingMinimumPrice: { type: 'subunit', amount: 6000 } });

    await expect(resolveListingMinimumPrice(sdk)).resolves.toBe(6000);
  });

  it('requests minimum-transaction-size.json, not transaction-size.json', async () => {
    const sdk = sdkReturning({ listingMinimumPrice: { type: 'subunit', amount: 6000 } });

    await resolveListingMinimumPrice(sdk);

    expect(ASSET_PATH).toBe('/transactions/minimum-transaction-size.json');
    expect(sdk.assetsByAlias).toHaveBeenCalledWith({ paths: [ASSET_PATH], alias: 'latest' });
  });

  it('falls back to the code default when the asset is absent', async () => {
    await expect(resolveListingMinimumPrice(sdkReturning(null))).resolves.toBe(
      DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS
    );
  });

  it('falls back when Console sets 0, which means "no restriction"', async () => {
    // Same rule as the client (configHelpers): 0 falls back to the code default.
    const sdk = sdkReturning({ listingMinimumPrice: { type: 'subunit', amount: 0 } });

    await expect(resolveListingMinimumPrice(sdk)).resolves.toBe(
      DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS
    );
  });

  it('falls back on a bare number, which is not the shape this asset uses', async () => {
    const sdk = sdkReturning({ listingMinimumPrice: 6000 });

    await expect(resolveListingMinimumPrice(sdk)).resolves.toBe(
      DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS
    );
  });

  it('falls back and warns when the asset cannot be fetched', async () => {
    const sdk = { assetsByAlias: jest.fn(() => Promise.reject(new Error('ENOTFOUND'))) };

    await expect(resolveListingMinimumPrice(sdk)).resolves.toBe(
      DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS
    );
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ENOTFOUND'));
  });

  it('uses the same fallback as the client config', () => {
    // Server code cannot import src/ (ESM, browser bundle), so the value is
    // duplicated. This keeps the two copies from drifting apart.
    const configDefault = fs.readFileSync(
      path.join(__dirname, '../../src/config/configDefault.js'),
      'utf8'
    );
    const match = configDefault.match(/listingMinimumPriceSubUnits:\s*(\d+)/);

    expect(Number(match[1])).toBe(DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS);
  });
});
