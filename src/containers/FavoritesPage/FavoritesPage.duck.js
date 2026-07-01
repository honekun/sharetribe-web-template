import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { createImageVariantConfig } from '../../util/sdkLoader';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { fetchCurrentUser } from '../../ducks/user.duck';

const entityRefs = entities => entities.map(e => ({ id: e.id, type: e.type }));

const favoritesPageSlice = createSlice({
  name: 'FavoritesPage',
  initialState: {
    queryInProgress: false,
    queryError: null,
    listingRefs: [],
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(queryFavoritesThunk.pending, state => {
        state.queryInProgress = true;
        state.queryError = null;
      })
      .addCase(queryFavoritesThunk.fulfilled, (state, action) => {
        state.queryInProgress = false;
        state.listingRefs = action.payload.listingRefs;
      })
      .addCase(queryFavoritesThunk.rejected, (state, action) => {
        state.queryInProgress = false;
        state.queryError = action.payload;
      });
  },
});

export default favoritesPageSlice.reducer;

const queryFavoritesPayloadCreator = (
  { config } = {},
  { dispatch, getState, rejectWithValue, extra: sdk }
) => {
  // Mirror SearchPage's card image variants so AVListingCard's ResponsiveImage
  // srcset resolves identically to search results.
  const { aspectWidth = 1, aspectHeight = 1, variantPrefix = 'listing-card' } =
    config?.layout?.listingImage || {};
  const aspectRatio = aspectHeight / aspectWidth;

  return dispatch(fetchCurrentUser())
    .then(() => {
      const currentUser = getState().user.currentUser;
      const ids = currentUser?.attributes?.profile?.privateData?.favoriteListingIds || [];
      if (ids.length === 0) {
        return { listingRefs: [] };
      }
      return sdk.listings
        .query({
          ids,
          include: ['author', 'author.profileImage', 'images'],
          'fields.listing': [
            'title',
            'geolocation',
            'price',
            'deleted',
            'state',
            'publicData.listingType',
            'publicData.transactionProcessAlias',
            'publicData.unitType',
            'publicData.cardStyle',
            'publicData.pickupEnabled',
            'publicData.shippingEnabled',
            'publicData.priceVariationsEnabled',
            'publicData.priceVariants',
            // For AV custom Listing Card.
            'publicData.brand',
            'publicData.all_sizes',
            'publicData.originalPrice',
          ],
          'fields.user': [
            'profile.displayName',
            'profile.abbreviatedName',
            'profile.publicData.userType',
            'profile.publicData.tipoTienda',
          ],
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
        })
        .then(response => {
          dispatch(addMarketplaceEntities(response));
          // API does not preserve ids order — restore saved order (newest first).
          const byId = new Map(response.data.data.map(l => [l.id.uuid, l]));
          const ordered = ids.map(id => byId.get(id)).filter(Boolean);
          return { listingRefs: entityRefs(ordered) };
        });
    })
    .catch(e => rejectWithValue(storableError(e)));
};

export const queryFavoritesThunk = createAsyncThunk(
  'FavoritesPage/queryFavorites',
  queryFavoritesPayloadCreator
);

export const loadData = (params, search, config) => queryFavoritesThunk({ config });
