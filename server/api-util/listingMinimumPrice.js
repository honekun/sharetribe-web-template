'use strict';

// The minimum listing price, read the way the client reads it.
//
// Console owns the value (Build → Transactions → Minimum transaction size); the
// listing form enforces it in the browser. Server paths that create listings
// without that form — bulk import — have to apply the same floor themselves.
//
// Two things about this asset are easy to get wrong, and both fail silently:
//
//  1. The path is `/transactions/minimum-transaction-size.json`, NOT
//     `transaction-size.json`. See configDefault.js `assets.transactionSize`.
//  2. The value is `{ type: 'subunit', amount }`, NOT a bare number. See
//     configHelpers.js `getListingMinimumPrice`, which reads it the same way.
const ASSET_PATH = '/transactions/minimum-transaction-size.json';

// Mirrors `listingMinimumPriceSubUnits` in src/config/configDefault.js ($20.00
// MXN), which the client uses when Console has no value or sets 0. Server code
// cannot import src/, so listingMinimumPrice.test.js keeps the two in step.
const DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS = 2000;

/**
 * Resolve the minimum listing price in currency subunits.
 *
 * Same rule as the client: a positive Console subunit amount wins, anything
 * else (absent asset, 0, wrong shape) falls back to the code default. A failed
 * fetch also falls back, with a warning, rather than blocking the caller.
 *
 * @param {Object} sdk Sharetribe Marketplace SDK instance
 * @returns {Promise<number>}
 */
const resolveListingMinimumPrice = sdk =>
  sdk
    .assetsByAlias({ paths: [ASSET_PATH], alias: 'latest' })
    .then(response => {
      const asset = response?.data?.data?.[0];
      const value = asset?.attributes?.data?.listingMinimumPrice;
      const isSubunitAmount = value?.type === 'subunit' && typeof value.amount === 'number';
      return isSubunitAmount && value.amount > 0
        ? value.amount
        : DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS;
    })
    .catch(e => {
      console.warn(
        `[listingMinimumPrice] Could not read ${ASSET_PATH}, using ${DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS}: ${e.message}`
      );
      return DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS;
    });

module.exports = { ASSET_PATH, DEFAULT_LISTING_MINIMUM_PRICE_SUBUNITS, resolveListingMinimumPrice };
