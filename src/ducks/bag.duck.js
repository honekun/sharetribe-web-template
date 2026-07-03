import { createSlice } from '@reduxjs/toolkit';
import { readBag, writeBag } from '../util/bagStorage';
import { addMarketplaceEntities } from './marketplaceData.duck';
import { createImageVariantConfig } from '../util/sdkLoader';
import { storableError } from '../util/errors';
import * as log from '../util/log';

const MAX_BAG_ITEMS = 50;
// AVListingCard/ResponsiveImage cards are square by default; mirror SearchPage's
// aspectHeight/aspectWidth if the layout config differs.
const CARD_ASPECT_RATIO = 1;

const bagSlice = createSlice({
  name: 'bag',
  initialState: { bagListingIds: [], isPopupOpen: false, hydrated: false },
  reducers: {
    bagHydrated(state, action) {
      state.bagListingIds = action.payload || [];
      state.hydrated = true;
    },
    listingAddedToBag(state, action) {
      const id = action.payload;
      state.bagListingIds = [id, ...state.bagListingIds.filter(x => x !== id)].slice(
        0,
        MAX_BAG_ITEMS
      );
      state.isPopupOpen = true;
    },
    listingRemovedFromBag(state, action) {
      state.bagListingIds = state.bagListingIds.filter(x => x !== action.payload);
    },
    bagPopupOpened(state) {
      state.isPopupOpen = true;
    },
    bagPopupClosed(state) {
      state.isPopupOpen = false;
    },
  },
});

export const {
  bagHydrated,
  listingAddedToBag,
  listingRemovedFromBag,
  bagPopupOpened,
  bagPopupClosed,
} = bagSlice.actions;
export default bagSlice.reducer;

// ================ Selectors ================ //

export const selectBagIds = state => state.bag.bagListingIds;
export const selectBagCount = state => state.bag.bagListingIds.length;
export const selectIsInBag = (state, listingId) => state.bag.bagListingIds.includes(listingId);

// ================ Thunks ================ //

// Client-side only: load ids from localStorage into Redux (call once on mount).
export const hydrateBag = () => dispatch => {
  dispatch(bagHydrated(readBag()));
};

export const addToBag = listingId => (dispatch, getState) => {
  dispatch(listingAddedToBag(listingId));
  writeBag(selectBagIds(getState()));
};

export const removeFromBag = listingId => (dispatch, getState) => {
  dispatch(listingRemovedFromBag(listingId));
  writeBag(selectBagIds(getState()));
};

// Fetch full listing entities for the current bag ids into marketplaceData.
// Returns the ordered entity refs (used by BagPage duck and BagPopup).
export const fetchBagListings = () => (dispatch, getState, sdk) => {
  const ids = selectBagIds(getState());
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return sdk.listings
    .query({
      ids,
      include: ['author', 'author.profileImage', 'images'],
      'fields.listing': [
        'title',
        'price',
        'publicData.listingType',
        'publicData.transactionProcessAlias',
        'publicData.unitType',
        'publicData.originalPrice',
        'publicData.all_sizes',
        'publicData.shippingEnabled',
        'publicData.pickupEnabled',
      ],
      'fields.user': ['profile.displayName', 'profile.abbreviatedName'],
      'fields.image': [
        'variants.listing-card',
        'variants.listing-card-2x',
        'variants.square-small',
        'variants.square-small2x',
      ],
      // REQUIRED: these spreads are what make the SDK actually generate the
      // variants named above. Without them ResponsiveImage renders blank.
      ...createImageVariantConfig('listing-card', 400, CARD_ASPECT_RATIO),
      ...createImageVariantConfig('listing-card-2x', 800, CARD_ASPECT_RATIO),
      'limit.images': 1,
    })
    .then(response => {
      dispatch(addMarketplaceEntities(response));
      const byId = new Map(response.data.data.map(l => [l.id.uuid, l]));
      return ids
        .map(id => byId.get(id))
        .filter(Boolean)
        .map(l => ({ id: l.id, type: l.type }));
    })
    .catch(e => {
      log.error(e, 'fetch-bag-listings-failed');
      throw storableError(e);
    });
};
