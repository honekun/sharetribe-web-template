import { createSlice } from '@reduxjs/toolkit';
import { setCurrentUser } from './user.duck';
import { denormalisedResponseEntities } from '../util/data';
import * as log from '../util/log';

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
      return response;
    })
    .catch(e => {
      dispatch(setFavorites(previous));
      log.error(e, 'toggle-favorite-failed', { listingId });
    });
};
