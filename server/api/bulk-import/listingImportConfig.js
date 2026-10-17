'use strict';

// The Console configuration one import is validated against, read once per
// upload: which publicData keys a CSV may write (publicDataKeys.js), the enum
// options each value must match, and the category tree
// (listingFieldOptions.js).

const { allowedPublicDataKeysFromFields } = require('./publicDataKeys');
const { buildFieldOptions, buildCategoryTree } = require('./listingFieldOptions');

const FIELDS_ASSET_PATH = '/listings/listing-fields.json';
const CATEGORIES_ASSET_PATH = '/listings/listing-categories.json';

/**
 * Read the listing-fields and listing-categories assets and build the import
 * config. An asset that does not exist counts as empty: no Console fields, or
 * a marketplace without categories (then no category is required).
 *
 * A failed fetch rejects. Without the assets no value or category can be
 * checked, and importing unchecked values is how listings ended up storing
 * labels that no filter matches, so the caller refuses the upload instead.
 *
 * @param {Object} sdk Sharetribe Marketplace SDK instance
 * @returns {Promise<{ allowedPublicDataKeys: Set<string>, fieldOptions: Map, categoryTree: Array }>}
 */
const resolveListingImportConfig = sdk =>
  Promise.resolve()
    .then(() =>
      sdk.assetsByAlias({ paths: [FIELDS_ASSET_PATH, CATEGORIES_ASSET_PATH], alias: 'latest' })
    )
    .then(response => {
      const assets = Array.isArray(response?.data?.data) ? response.data.data : [];
      const assetData = path =>
        assets.find(asset => asset?.attributes?.assetPath === path)?.attributes?.data;
      const hostedFields = assetData(FIELDS_ASSET_PATH)?.listingFields;
      const categories = assetData(CATEGORIES_ASSET_PATH)?.categories;
      return {
        allowedPublicDataKeys: allowedPublicDataKeysFromFields(hostedFields),
        fieldOptions: buildFieldOptions(hostedFields),
        categoryTree: buildCategoryTree(categories),
      };
    });

module.exports = { FIELDS_ASSET_PATH, CATEGORIES_ASSET_PATH, resolveListingImportConfig };
