import { createSlice } from '@reduxjs/toolkit';

import { denormalisedResponseEntities } from '../util/data';
import * as log from '../util/log';
import { trackMarketingEngagement } from '../util/api';

import { clearCurrentUser, setCurrentUser } from './user.duck';

// Max ids supported by sdk.listings.query({ ids }) in one call.
const MAX_FAVORITES = 100;

// Profile updates replace privateData.favoriteListingIds as a whole. Keep one
// queue per Redux store so concurrent toggles cannot persist out of order. A
// WeakMap avoids putting promises in Redux state and lets discarded stores be
// garbage-collected (notably SSR requests and tests).
const favoriteUpdateQueues = new WeakMap();

const applyFavoriteIntent = (ids, listingId, shouldBeFavorite) => {
  const without = ids.filter(id => id !== listingId);
  return shouldBeFavorite ? [listingId, ...without].slice(0, MAX_FAVORITES) : without;
};

const getFavoriteUpdateQueue = (getState, confirmedIds) => {
  const existing = favoriteUpdateQueues.get(getState);
  if (existing) return existing;
  const queue = { tail: Promise.resolve(), pending: [], confirmedIds };
  favoriteUpdateQueues.set(getState, queue);
  return queue;
};

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

// Optimistic toggle: flip locally, then serialize full-array profile writes.
// Pending intents are replayed over the last confirmed array after every
// response, so a failure rolls back only its own effect and preserves newer
// clicks.
export const toggleFavorite = listingId => (dispatch, getState, sdk) => {
  const previous = selectFavoriteIds(getState());
  const shouldBeFavorite = !previous.includes(listingId);
  const queue = getFavoriteUpdateQueue(getState, previous);
  if (queue.pending.length === 0) {
    queue.confirmedIds = previous;
  }

  dispatch(favoriteToggled(listingId));
  const operation = { listingId, shouldBeFavorite };
  queue.pending.push(operation);

  const persistOperation = async () => {
    const nextConfirmedIds = applyFavoriteIntent(queue.confirmedIds, listingId, shouldBeFavorite);
    let response;
    let succeeded = false;

    try {
      response = await sdk.currentUser.updateProfile(
        { privateData: { favoriteListingIds: nextConfirmedIds } },
        { expand: true }
      );
      queue.confirmedIds = nextConfirmedIds;
      succeeded = true;
    } catch (error) {
      log.error(error, 'toggle-favorite-failed', { listingId });
    }

    queue.pending = queue.pending.filter(item => item !== operation);
    const optimisticIds = queue.pending.reduce(
      (ids, item) => applyFavoriteIntent(ids, item.listingId, item.shouldBeFavorite),
      queue.confirmedIds
    );
    dispatch(setFavorites(optimisticIds));

    if (!succeeded) return undefined;

    // An older response must not update currentUser while newer intents are
    // pending: AVTopbarExtras hydrates favorites from currentUser and would
    // otherwise overwrite the optimistic list with the older array.
    if (queue.pending.length === 0) {
      const entities = denormalisedResponseEntities(response);
      if (entities.length === 1) {
        dispatch(setCurrentUser(entities[0]));
      }
    }

    return shouldBeFavorite
      ? trackMarketingEngagement({ listingId, action: 'favorite' })
          .catch(error => log.error(error, 'marketing-favorite-tracking-failed', { listingId }))
          .then(() => response)
      : response;
  };

  const queuedUpdate = queue.tail.then(persistOperation, persistOperation);
  queue.tail = queuedUpdate;
  return queuedUpdate;
};
