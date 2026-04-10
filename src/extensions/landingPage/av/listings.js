import { types as sdkTypes, createImageVariantConfig } from '../../../util/sdkLoader';
import { addMarketplaceEntities, getListingsById } from '../../../ducks/marketplaceData.duck';
import { setTagListingIds } from '../../../ducks/avExtension.duck';

import { getRecommendedListingIds, getSelectionsSections, getTagListingsSections, hasCustomSections } from './sections';

const { UUID } = sdkTypes;

// AV-specific listing fields fetched for landing page sections.
// Keep in sync with publicData fields defined in configListing.js.
const AV_LISTING_PUBLIC_DATA_FIELDS = [
  'publicData.listingType',
  'publicData.transactionProcessAlias',
  'publicData.unitType',
  'publicData.brand',
  'publicData.talla',
];

const createListingsBaseQueryParams = (config = {}) => {
  const listingImage = config?.layout?.listingImage || {};
  const {
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix = 'listing-card',
  } = listingImage;
  const aspectRatio = aspectHeight / aspectWidth;

  return {
    include: ['author', 'author.profileImage', 'images'],
    'fields.listing': ['title', 'price', 'deleted', 'state', ...AV_LISTING_PUBLIC_DATA_FIELDS],
    'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'profile.image'],
    'fields.image': [
      'variants.square-xsmall2x',
      'variants.scaled-small',
      'variants.scaled-medium',
      `variants.${variantPrefix}`,
      `variants.${variantPrefix}-2x`,
    ],
    ...createImageVariantConfig(`${variantPrefix}`, 400, aspectRatio),
    ...createImageVariantConfig(`${variantPrefix}-2x`, 800, aspectRatio),
    ...createImageVariantConfig('square-xsmall2x', 60, aspectRatio),
    'limit.images': 1,
  };
};

const createListingsQueryParams = (config = {}, listingIds = []) => {
  const ids = [...new Set(listingIds)];
  return { ids, ...createListingsBaseQueryParams(config) };
};

const queryListingsByIds = (listingIds, config) => (dispatch, getState, sdk) => {
  if (!listingIds || listingIds.length === 0) {
    return Promise.resolve();
  }

  const params = createListingsQueryParams(config, listingIds);
  return sdk.listings.query(params).then(response => {
    const sanitizeConfig = { listingFields: config?.listing?.listingFields };
    dispatch(addMarketplaceEntities(response, sanitizeConfig));
    return response;
  });
};

/**
 * Parse a blockName into SDK filter params.
 *   "tag:hot-list"  → { pub_tags: 'hot-list' }
 *   "cat:blazers"   → { pub_categoryLevel1: 'blazers' }
 *   "hot-list"      → { pub_tags: 'hot-list' }  (default: tag)
 */
export const parseFilterFromBlockName = blockName => {
  if (!blockName) return null;
  if (blockName.startsWith('tag:')) return { pub_tags: blockName.slice(4) };
  if (blockName.startsWith('cat:')) return { pub_categoryLevel1: blockName.slice(4) };
  return { pub_tags: blockName };
};

const queryListingsByFilter = (filterParams, config) => (dispatch, getState, sdk) => {
  if (!filterParams) return Promise.resolve(null);

  const params = {
    ...createListingsBaseQueryParams(config),
    ...filterParams,
    perPage: 24,
  };

  return sdk.listings.query(params).then(response => {
    const sanitizeConfig = { listingFields: config?.listing?.listingFields };
    dispatch(addMarketplaceEntities(response, sanitizeConfig));
    return response;
  });
};

const toUUID = id => {
  if (!id) {
    return null;
  }
  try {
    return new UUID(id);
  } catch (e) {
    return null;
  }
};

const pickListingsById = (state, ids) => {
  const uuids = (ids || []).map(toUUID).filter(Boolean);
  return uuids.length > 0 ? getListingsById(state, uuids) : [];
};

export const loadCustomSectionListings = ({ pageData, dispatch, config }) => {
  if (!hasCustomSections(pageData)) {
    return Promise.resolve();
  }

  const recommendedListingIds = getRecommendedListingIds(pageData);
  const selectionsSections = getSelectionsSections(pageData);
  const tagListingsSectionsMap = getTagListingsSections(pageData);
  const calls = [];

  if (recommendedListingIds.length > 0) {
    calls.push(dispatch(queryListingsByIds(recommendedListingIds, config)));
  }

  Object.values(selectionsSections).forEach(ids => {
    if (ids.length > 0) {
      calls.push(dispatch(queryListingsByIds(ids, config)));
    }
  });

  // For each tag/category filter section, query listings and store the returned IDs
  const tagListingIdsAccumulator = {};
  Object.entries(tagListingsSectionsMap).forEach(([sectionId, blockName]) => {
    const filterParams = parseFilterFromBlockName(blockName);
    if (filterParams) {
      calls.push(
        dispatch(queryListingsByFilter(filterParams, config)).then(response => {
          const ids = (response?.data?.data || [])
            .map(l => l?.id?.uuid)
            .filter(Boolean);
          tagListingIdsAccumulator[sectionId] = ids;
        })
      );
    }
  });

  return Promise.all(calls).then(() => {
    if (Object.keys(tagListingIdsAccumulator).length > 0) {
      dispatch(setTagListingIds(tagListingIdsAccumulator));
    }
  });
};

export const selectCustomSectionListings = ({ state, pageData }) => {
  const hasSections = hasCustomSections(pageData);
  if (!hasSections) {
    return { hasCustomSections: false };
  }

  const recommendedListingIds = getRecommendedListingIds(pageData);
  const selectionsSections = getSelectionsSections(pageData);
  const listings = pickListingsById(state, recommendedListingIds);
  const selectionsListings = Object.entries(selectionsSections).reduce((collected, [sectionId, ids]) => {
    return { ...collected, [sectionId]: pickListingsById(state, ids) };
  }, {});

  // Read tag listing IDs from Redux and denormalize
  const tagListingIdsBySection = state.avLandingExtension?.tagListingIds || {};
  const tagListingsSections = Object.entries(tagListingIdsBySection).reduce(
    (collected, [sectionId, ids]) => ({
      ...collected,
      [sectionId]: pickListingsById(state, ids),
    }),
    {}
  );

  return {
    hasCustomSections: true,
    listings,
    selectionsListings,
    tagListingsSections,
  };
};
