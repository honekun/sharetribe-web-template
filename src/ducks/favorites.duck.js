import { createSlice } from '@reduxjs/toolkit';
import { clearCurrentUser, setCurrentUser } from './user.duck';
import { denormalisedResponseEntities } from '../util/data';
import * as log from '../util/log';
import { trackMarketingEngagement } from '../util/api';

// Max ids supported by sdk.listings.query({ ids }) in one call.
const MAX_FAVORITES = 100;

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: { favoriteListingIds: [] },
  reducers: {
    setFavorites(state, action) {
      state.favoriteListingIds = action.payload || [];
    },
    favoriteToggled(state, action) {
      const id = action.payload;
      const without = state.favoriteListingIds.filter(fav => fav !== id);
      state.favoriteListingIds =
        without.length === state.favoriteListingIds.length
          ? [id, ...without].slice(0, MAX_FAVORITES)
          : without;
    },
  },
  extraReducers: builder => {
    // Favorites belong to the signed-in user, so they end with the session.
    // Tying this to the action rather than to a component means it happens even
    // if nothing that syncs favorites is mounted at the time.
    builder.addCase(clearCurrentUser, state => {
      state.favoriteListingIds = [];
    });
  },
});

export const { setFavorites, favoriteToggled } = favoritesSlice.actions;
export default favoritesSlice.reducer;

// ================ Selectors ================ //

export const selectFavoriteIds = state => state.favorites.favoriteListingIds;
export const selectIsFavorite = (state, listingId) =>
  state.favorites.favoriteListingIds.includes(listingId);

// ================ Thunks ================ //

// Sync local state from the freshly fetched currentUser (call after login /
// fetchCurrentUser succeeds — see TopbarContainer).
export const syncFavoritesFromUser = currentUser => dispatch => {
  const ids = currentUser?.attributes?.profile?.privateData?.favoriteListingIds || [];
  dispatch(setFavorites(ids));
};

// Optimistic toggle: flip locally, persist, roll back on failure.
export const toggleFavorite = listingId => (dispatch, getState, sdk) => {
  const previous = selectFavoriteIds(getState());
  const addingFavorite = !previous.includes(listingId);
  dispatch(favoriteToggled(listingId));
  const next = selectFavoriteIds(getState());

  return sdk.currentUser
    .updateProfile({ privateData: { favoriteListingIds: next } }, { expand: true })
    .then(response => {
      // Keep state.user.currentUser in sync (same pattern as markVendedorOnboarded).
      const entities = denormalisedResponseEntities(response);
      if (entities.length === 1) {
        dispatch(setCurrentUser(entities[0]));
      }
      return addingFavorite
        ? trackMarketingEngagement({ listingId, action: 'favorite' })
            .catch(error => log.error(error, 'marketing-favorite-tracking-failed', { listingId }))
            .then(() => response)
        : response;
    })
    .catch(e => {
      dispatch(setFavorites(previous));
      log.error(e, 'toggle-favorite-failed', { listingId });
    });
};
