/**
 * Brand-aware topbar search.
 *
 * The topbar search placeholder promises "Busca por producto o marca", but the
 * `brand` listing field is a `schemaType: 'enum'` (see configListingAV.js). In
 * Sharetribe only `text` fields enter the keyword index, so `?keywords=prada`
 * never matches a listing purely on its brand — it only matches title/description.
 * Switching the schema to `text` would make brand keyword-searchable but would
 * cost the Marca filter, the FieldSearchableSelect input, and the curated
 * 600+ brand vocabulary.
 *
 * Instead we resolve the typed text against the brand enum locally: an exact
 * (normalized) hit on a brand label or slug searches `?pub_brand=<slug>`, which
 * is what the shopper actually meant. Anything else falls through to the normal
 * keyword search.
 */

// The catch-all "Otra..." option is a real enum value but a meaningless search
// target, so it never matches.
const EXCLUDED_BRAND_OPTIONS = ['other'];

// Guard against a one-character query collapsing onto a short brand slug.
const MIN_TOKEN_LENGTH = 2;

/**
 * Fold a brand label or a user's query down to a comparable token: lowercase,
 * accents stripped, and every non-alphanumeric character removed. This makes
 * "A.P.C." / "apc", "Alaïa" / "alaia" and "H&M" / "h m" all compare equal.
 *
 * @param {string} str raw label, slug or search query
 * @returns {string} normalized token ('' when there is nothing comparable)
 */
export const normalizeBrandToken = str =>
  typeof str === 'string'
    ? str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '')
    : '';

/**
 * Pull the `brand` field's enum options out of the merged listing-field config.
 *
 * @param {Array} listingFields `config.listing.listingFields`
 * @returns {Array} the brand field's enumOptions (empty when absent)
 */
const getBrandEnumOptions = (listingFields = []) => {
  const brandField = listingFields.find(field => field?.key === 'brand');
  return Array.isArray(brandField?.enumOptions) ? brandField.enumOptions : [];
};

/**
 * Find the brand slug a search query names, comparing the normalized query
 * against each option's label and its slug. Returns null when the query names
 * no brand, which is the common case (product searches).
 *
 * @param {string} keywords raw search query
 * @param {Array} listingFields `config.listing.listingFields`
 * @returns {string|null} the matching `option` slug, or null
 */
export const findBrandOption = (keywords, listingFields = []) => {
  const token = normalizeBrandToken(keywords);
  if (token.length < MIN_TOKEN_LENGTH) {
    return null;
  }

  const match = getBrandEnumOptions(listingFields).find(entry => {
    const option = entry?.option;
    if (typeof option !== 'string' || EXCLUDED_BRAND_OPTIONS.includes(option)) {
      return false;
    }
    return normalizeBrandToken(entry.label) === token || normalizeBrandToken(option) === token;
  });

  return match ? match.option : null;
};

/**
 * Build the topbar's search params for a keyword submit.
 *
 * Exactly one of `keywords` / `pub_brand` is ever set; the other is explicitly
 * `undefined` so it clears any stale value carried over from
 * `currentSearchParams` (`stringify` in util/urlHelpers drops undefined). Were
 * both set they would AND together and reliably return nothing, since a
 * brand-only match never satisfies the keyword index.
 *
 * @param {Object} params
 * @param {string} params.keywords raw search query
 * @param {Array} params.listingFields `config.listing.listingFields`
 * @returns {Object} `{ keywords, pub_brand }` for the search URL
 */
export const resolveKeywordsSearchParams = ({ keywords, listingFields = [] } = {}) => {
  const brandOption = findBrandOption(keywords, listingFields);

  return brandOption
    ? { keywords: undefined, pub_brand: brandOption }
    : { keywords, pub_brand: undefined };
};

/**
 * The value the topbar search box should show for the current URL.
 *
 * A brand search leaves no `keywords` param, so without this the box would go
 * blank on the results page right after the shopper searched "Prada". Show the
 * brand's label instead, so the box keeps reflecting what they asked for.
 *
 * @param {Object} params
 * @param {string} params.keywords `keywords` from the URL
 * @param {string} params.pubBrand `pub_brand` from the URL
 * @param {Array} params.listingFields `config.listing.listingFields`
 * @returns {string|undefined} the value to display in the search box
 */
export const resolveKeywordsInitialValue = ({ keywords, pubBrand, listingFields = [] } = {}) => {
  if (keywords || !pubBrand) {
    return keywords;
  }

  const match = getBrandEnumOptions(listingFields).find(entry => entry?.option === pubBrand);
  return match?.label || keywords;
};
