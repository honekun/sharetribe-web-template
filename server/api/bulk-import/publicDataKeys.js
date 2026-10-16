'use strict';

// Which listing publicData keys a bulk-import CSV may write.
//
// A `pub_*`/`pd_*` column becomes a publicData key, and any signed-in user may
// import. Without a policy a row could set `pub_listingType` or
// `pub_transactionProcessAlias` and publish listings on a transaction setup the
// marketplace does not support. Two lists apply, in this order:
//
//  1. SYSTEM_PUBLIC_DATA_KEYS are never accepted from a CSV. The app (or the
//     import worker) owns them, and the worker writes them after the CSV values.
//  2. IGNORED_PUBLIC_DATA_KEYS are dropped without an error, so an older sheet
//     that still carries the column keeps importing.
//  3. Every other key must be allowed: a documented template column, or a
//     public-scope listing field configured in Console.

// Mirrors the built-in keys in src/util/configHelpers.js
// `hasClashWithBuiltInPublicDataKey`, minus categoryLevel1-3 (CSV-writable — they
// are template columns), plus the AV keys the worker and wizard write. Server
// code cannot import that ESM module, so publicDataKeys.test.js pins the copy.
const SYSTEM_PUBLIC_DATA_KEYS = new Set([
  'listingType',
  'transactionProcessAlias',
  'unitType',
  'location',
  'pickupEnabled',
  'shippingEnabled',
  'shippingPriceInSubunitsOneItem',
  'shippingPriceInSubunitsAdditionalItems',
  'cardStyle',
  // AV-owned
  'imageSlots',
  'avPackageSize',
  'avPackageSizeLocked',
  'avPlaceholderImage',
  'avPlaceholderImageId',
]);

// Columns bulk import used to accept and no longer writes. `tags` drives curated
// carousels (hot-list, ofertas), and any signed-in user may import, so a seller
// could otherwise place their own listings in a curated list. Ignored even if
// Console defines `tags` as a public field.
const IGNORED_PUBLIC_DATA_KEYS = new Set(['tags']);

// The publicData columns of the seller template (GET /api/bulk-import/template),
// as documented in docs/implementation/bulk-import.md. Always allowed, so an
// import still works when the Console asset cannot be read, and so `temporada` —
// saved but not a Console field — keeps importing. `color`/`all_sizes`/`brand`
// are code-defined (configListingAV.js) and may be absent from the hosted asset.
const TEMPLATE_PUBLIC_DATA_KEYS = new Set([
  'brand',
  'categoryLevel1',
  'categoryLevel2',
  'categoryLevel3',
  'color',
  'all_sizes',
  'genero',
  'estado',
  'estilo',
  'temporada',
  'originalPrice',
]);

const ASSET_PATH = '/listings/listing-fields.json';

/**
 * Resolve the set of publicData keys a CSV may write: the template columns plus
 * every public-scope listing field in Console. A failed fetch falls back to the
 * template columns alone, with a warning, rather than blocking the import.
 * System and ignored keys are excluded even if Console defines them.
 *
 * @param {Object} sdk Sharetribe Marketplace SDK instance
 * @returns {Promise<Set<string>>}
 */
const resolveAllowedPublicDataKeys = sdk =>
  Promise.resolve()
    .then(() => sdk.assetsByAlias({ paths: [ASSET_PATH], alias: 'latest' }))
    .then(response => {
      const asset = response?.data?.data?.[0];
      const hostedFields = asset?.attributes?.data?.listingFields;
      const hostedKeys = (Array.isArray(hostedFields) ? hostedFields : [])
        // Console omits scope for public fields in some assets; configHelpers
        // defaults it to 'public' the same way.
        .filter(f => typeof f?.key === 'string' && (f.scope || 'public') === 'public')
        .map(f => f.key);
      const allowed = new Set([...TEMPLATE_PUBLIC_DATA_KEYS, ...hostedKeys]);
      SYSTEM_PUBLIC_DATA_KEYS.forEach(key => allowed.delete(key));
      IGNORED_PUBLIC_DATA_KEYS.forEach(key => allowed.delete(key));
      return allowed;
    })
    .catch(e => {
      console.warn(
        `[bulk-import] Could not read ${ASSET_PATH}, allowing template columns only: ${e.message}`
      );
      return new Set(TEMPLATE_PUBLIC_DATA_KEYS);
    });

/**
 * Copy of `publicData` without system-owned or ignored keys. The worker applies
 * this before writing its own values, so a row that bypassed validateRows still
 * cannot override them.
 */
const omitSystemPublicDataKeys = publicData =>
  Object.fromEntries(
    Object.entries(publicData || {}).filter(
      ([key]) => !SYSTEM_PUBLIC_DATA_KEYS.has(key) && !IGNORED_PUBLIC_DATA_KEYS.has(key)
    )
  );

module.exports = {
  ASSET_PATH,
  SYSTEM_PUBLIC_DATA_KEYS,
  IGNORED_PUBLIC_DATA_KEYS,
  TEMPLATE_PUBLIC_DATA_KEYS,
  resolveAllowedPublicDataKeys,
  omitSystemPublicDataKeys,
};
