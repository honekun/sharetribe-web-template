import { types as sdkTypes, createImageVariantConfig } from '../../../util/sdkLoader';
import { addMarketplaceEntities, getListingsById } from '../../../ducks/marketplaceData.duck';

import { getRecommendedListingIds, getSelectionsSections, hasCustomSections } from './sections';

const { UUID } = sdkTypes;

const createListingsQueryParams = (config = {}, listingIds = []) => {
  const listingImage = config?.layout?.listingImage || {};
  const {
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix = 'listing-card',
  } = listingImage;
  const aspectRatio = aspectHeight / aspectWidth;
  const ids = [...new Set(listingIds)];

  return {
    ids,
    include: ['author', 'author.profileImage', 'images'],
    'fields.listing': [
      'title',
      'price',
      'deleted',
      'state',
      'publicData.listingType',
      'publicData.transactionProcessAlias',
      'publicData.unitType',
      'publicData.brand',
      'publicData.talla',
    ],
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
  const calls = [];

  if (recommendedListingIds.length > 0) {
    calls.push(dispatch(queryListingsByIds(recommendedListingIds, config)));
  }

  Object.values(selectionsSections).forEach(ids => {
    if (ids.length > 0) {
      calls.push(dispatch(queryListingsByIds(ids, config)));
    }
  });

  return Promise.all(calls).then(() => undefined);
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

  return {
    hasCustomSections: true,
    listings,
    selectionsListings,
  };
};
