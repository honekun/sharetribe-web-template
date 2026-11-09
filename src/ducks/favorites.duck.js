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
//
// The store (and its getState) outlives logout, so every queue is also bound to
// the favorites `session` token below: work queued by one session never writes
// to, or reports back into, the next one (audit A02).
const favoriteUpdateQueues = new WeakMap();

// A fresh object per session. Only its identity matters. The slice uses a lazy
// initial state, so the root reset on logout (src/reducers.js) creates a new
// token, and `clearCurrentUser` (logout or an expired session) replaces it too.
// SSR state arrives as a parsed copy, which is again a distinct object.
const newSession = () => ({});
const selectFavoritesSession = state => state.favorites?.session;
const selectCurrentUserId = state => state.user?.currentUser?.id?.uuid || null;

const applyFavoriteIntent = (ids, listingId, shouldBeFavorite) => {
  const without = ids.filter(id => id !== listingId);
  return shouldBeFavorite ? [listingId, ...without].slice(0, MAX_FAVORITES) : without;
};

const getFavoriteUpdateQueue = (getState, confirmedIds) => {
  const state = getState();
  const session = selectFavoritesSession(state);
  const ownerId = selectCurrentUserId(state);
  const existing = favoriteUpdateQueues.get(getState);
  const sameOwner = existing && (!existing.ownerId || !ownerId || existing.ownerId === ownerId);
  if (existing && existing.session === session && sameOwner) {
    // A queue started before currentUser hydrated belongs to the first user seen.
    if (!existing.ownerId) existing.ownerId = ownerId;
    return existing;
  }
  // A new session or user starts empty instead of inheriting the old queue's
  // intents and confirmed list. For the same (or a not-yet-known) user it still
  // waits behind any request already in flight, so writes to one profile cannot
  // land out of order; another user's queue never waits on the previous
  // account's request.
  const queue = {
    tail: sameOwner ? existing.tail.catch(() => undefined) : Promise.resolve(),
    pending: [],
    confirmedIds,
    session,
    ownerId,
  };
  favoriteUpdateQueues.set(getState, queue);
  return queue;
};

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: () => ({ favoriteListingIds: [], session: newSession() }),
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
      state.session = newSession();
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
//
// Each operation remembers the session and user it was made in. It is dropped —
// no profile write, no state update — if either has changed by the time it
// would write, or by the time its response arrives.
export const toggleFavorite = listingId => (dispatch, getState, sdk) => {
  const state = getState();
  const previous = selectFavoriteIds(state);
  const shouldBeFavorite = !previous.includes(listingId);
  const queue = getFavoriteUpdateQueue(getState, previous);
  if (queue.pending.length === 0) {
    queue.confirmedIds = previous;
  }

  dispatch(favoriteToggled(listingId));
  const operation = {
    listingId,
    shouldBeFavorite,
    session: queue.session,
    ownerId: selectCurrentUserId(state),
  };
  queue.pending.push(operation);

  // A toggle made before currentUser hydrated has no owner yet; it binds to the
  // user present when it is written, and its response must match that user.
  const isCurrent = responseUserId => {
    const current = getState();
    if (selectFavoritesSession(current) !== operation.session) return false;
    const currentUserId = selectCurrentUserId(current);
    if (!operation.ownerId) operation.ownerId = currentUserId;
    if (operation.ownerId && currentUserId !== operation.ownerId) return false;
    return !responseUserId || !operation.ownerId || responseUserId === operation.ownerId;
  };

  // A dropped operation leaves the queue too: left in `pending`, it would be
  // replayed into every later optimistic list and keep the queue from ever
  // draining (so currentUser would never be refreshed).
  const dropOperation = () => {
    queue.pending = queue.pending.filter(item => item !== operation);
    return undefined;
  };

  const persistOperation = async () => {
    if (!isCurrent()) return dropOperation();

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

    const entities = succeeded ? denormalisedResponseEntities(response) : [];
    if (!isCurrent(entities[0]?.id?.uuid)) return dropOperation();

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
