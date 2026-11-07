jest.mock('../util/api', () => ({
  trackMarketingEngagement: jest.fn(() => Promise.resolve()),
}));

import configureStore from '../store';
import { trackMarketingEngagement } from '../util/api';
import * as log from '../util/log';
import { createCurrentUser } from '../util/testData';
import reducer, {
  setFavorites,
  favoriteToggled,
  selectFavoriteIds,
  selectIsFavorite,
  syncFavoritesFromUser,
  toggleFavorite,
} from './favorites.duck';
import { logoutThunk } from './auth.duck';
import { clearCurrentUser, setCurrentUser } from './user.duck';

describe('favorites.duck', () => {
  it('has empty initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      favoriteListingIds: [],
      session: {},
    });
  });

  it('starts every store-level reset with a new session token', () => {
    const first = reducer(undefined, { type: 'unknown' });
    const second = reducer(undefined, { type: 'unknown' });
    expect(first.session).not.toBe(second.session);
    // Unrelated updates keep the token.
    expect(reducer(first, setFavorites(['a'])).session).toBe(first.session);
  });

  it('setFavorites replaces the list', () => {
    const state = reducer(undefined, setFavorites(['a', 'b']));
    expect(state.favoriteListingIds).toEqual(['a', 'b']);
  });

  it('favoriteToggled adds an id to the front', () => {
    const state = reducer({ favoriteListingIds: ['a'] }, favoriteToggled('b'));
    expect(state.favoriteListingIds).toEqual(['b', 'a']);
  });

  it('favoriteToggled removes an existing id', () => {
    const state = reducer({ favoriteListingIds: ['a', 'b'] }, favoriteToggled('a'));
    expect(state.favoriteListingIds).toEqual(['b']);
  });

  it('caps the list at 100 ids, dropping the oldest', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);
    const state = reducer({ favoriteListingIds: ids }, favoriteToggled('new-id'));
    expect(state.favoriteListingIds).toHaveLength(100);
    expect(state.favoriteListingIds[0]).toBe('new-id');
    expect(state.favoriteListingIds).not.toContain('id-99');
  });

  it('drops the list and the session token when the user session ends', () => {
    const before = reducer(undefined, setFavorites(['a', 'b']));
    const state = reducer(before, clearCurrentUser());
    expect(state.favoriteListingIds).toEqual([]);
    expect(state.session).not.toBe(before.session);
  });

  describe('syncFavoritesFromUser', () => {
    const userWithFavorites = ids => ({
      id: { uuid: 'user-id' },
      attributes: { profile: { privateData: { favoriteListingIds: ids } } },
    });

    const dispatchedIdsFor = currentUser => {
      const dispatch = jest.fn();
      syncFavoritesFromUser(currentUser)(dispatch);
      expect(dispatch).toHaveBeenCalledTimes(1);
      return dispatch.mock.calls[0][0].payload;
    };

    it('takes the ids saved on the user', () => {
      expect(dispatchedIdsFor(userWithFavorites(['a', 'b']))).toEqual(['a', 'b']);
    });

    it('clears the list for a user who has saved none', () => {
      expect(dispatchedIdsFor(userWithFavorites(undefined))).toEqual([]);
      expect(dispatchedIdsFor({ id: { uuid: 'user-id' }, attributes: {} })).toEqual([]);
    });

    it('clears the list when there is no signed-in user', () => {
      expect(dispatchedIdsFor(null)).toEqual([]);
      expect(dispatchedIdsFor(undefined)).toEqual([]);
    });
  });

  it('selectors read from state.favorites', () => {
    const globalState = { favorites: { favoriteListingIds: ['x'] } };
    expect(selectFavoriteIds(globalState)).toEqual(['x']);
    expect(selectIsFavorite(globalState, 'x')).toBe(true);
    expect(selectIsFavorite(globalState, 'y')).toBe(false);
  });

  describe('toggleFavorite persistence queue', () => {
    beforeEach(() => {
      trackMarketingEngagement.mockResolvedValue(undefined);
    });

    const deferred = () => {
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    };
    const responseWithFavorites = ids => ({
      data: {
        data: createCurrentUser('user-id', {
          profile: { privateData: { favoriteListingIds: ids } },
        }),
      },
    });

    it('serializes deferred writes and does not rehydrate an older favorites array', async () => {
      const firstUpdate = deferred();
      const secondUpdate = deferred();
      const sdk = {
        currentUser: {
          updateProfile: jest
            .fn()
            .mockReturnValueOnce(firstUpdate.promise)
            .mockReturnValueOnce(secondUpdate.promise),
        },
      };
      const store = configureStore({ sdk });

      const firstToggle = store.dispatch(toggleFavorite('listing-a'));
      await Promise.resolve();
      expect(sdk.currentUser.updateProfile).toHaveBeenCalledTimes(1);
      expect(sdk.currentUser.updateProfile.mock.calls[0][0]).toEqual({
        privateData: { favoriteListingIds: ['listing-a'] },
      });

      const secondToggle = store.dispatch(toggleFavorite('listing-b'));
      expect(store.getState().favorites.favoriteListingIds).toEqual(['listing-b', 'listing-a']);
      expect(sdk.currentUser.updateProfile).toHaveBeenCalledTimes(1);

      firstUpdate.resolve(responseWithFavorites(['listing-a']));
      await firstToggle;
      await Promise.resolve();

      expect(store.getState().favorites.favoriteListingIds).toEqual(['listing-b', 'listing-a']);
      expect(sdk.currentUser.updateProfile).toHaveBeenCalledTimes(2);
      expect(sdk.currentUser.updateProfile.mock.calls[1][0]).toEqual({
        privateData: { favoriteListingIds: ['listing-b', 'listing-a'] },
      });

      secondUpdate.resolve(responseWithFavorites(['listing-b', 'listing-a']));
      await secondToggle;

      expect(store.getState().favorites.favoriteListingIds).toEqual(['listing-b', 'listing-a']);
      expect(
        store.getState().user.currentUser.attributes.profile.privateData.favoriteListingIds
      ).toEqual(['listing-b', 'listing-a']);
    });

    it('rebases a later intent when an earlier deferred write fails', async () => {
      const logSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
      const firstUpdate = deferred();
      const secondUpdate = deferred();
      const error = new Error('network down');
      const sdk = {
        currentUser: {
          updateProfile: jest
            .fn()
            .mockReturnValueOnce(firstUpdate.promise)
            .mockReturnValueOnce(secondUpdate.promise),
        },
      };
      const store = configureStore({ sdk });

      const firstToggle = store.dispatch(toggleFavorite('listing-a'));
      await Promise.resolve();
      const secondToggle = store.dispatch(toggleFavorite('listing-b'));

      firstUpdate.reject(error);
      await firstToggle;
      await Promise.resolve();

      expect(store.getState().favorites.favoriteListingIds).toEqual(['listing-b']);
      expect(sdk.currentUser.updateProfile.mock.calls[1][0]).toEqual({
        privateData: { favoriteListingIds: ['listing-b'] },
      });

      secondUpdate.resolve(responseWithFavorites(['listing-b']));
      await secondToggle;
      expect(store.getState().favorites.favoriteListingIds).toEqual(['listing-b']);
      expect(logSpy).toHaveBeenCalledWith(error, 'toggle-favorite-failed', {
        listingId: 'listing-a',
      });
      logSpy.mockRestore();
    });

    describe('session boundaries (audit A02)', () => {
      const signIn = (store, userId, favoriteListingIds = []) => {
        store.dispatch(
          setCurrentUser(
            createCurrentUser(userId, { profile: { privateData: { favoriteListingIds } } })
          )
        );
        store.dispatch(setFavorites(favoriteListingIds));
      };
      // What auth.duck's logout does: clear the user, then the root reset.
      const logOut = store => {
        store.dispatch(clearCurrentUser());
        store.dispatch(logoutThunk.fulfilled(true, 'logout-request'));
      };
      const responseFor = (userId, ids) => ({
        data: {
          data: createCurrentUser(userId, {
            profile: { privateData: { favoriteListingIds: ids } },
          }),
        },
      });
      const flush = () => new Promise(resolve => setTimeout(resolve, 0));

      it("never writes Alice's queued favorites into Bob's profile", async () => {
        const firstUpdate = deferred();
        const sdk = {
          currentUser: { updateProfile: jest.fn().mockReturnValueOnce(firstUpdate.promise) },
        };
        const store = configureStore({ sdk });
        signIn(store, 'alice');

        const first = store.dispatch(toggleFavorite('alice-1'));
        await Promise.resolve();
        const second = store.dispatch(toggleFavorite('alice-2'));
        expect(sdk.currentUser.updateProfile).toHaveBeenCalledTimes(1);

        logOut(store);
        signIn(store, 'bob', ['bob-1']);

        firstUpdate.resolve(responseFor('alice', ['alice-1']));
        await first;
        await second;
        await flush();

        expect(sdk.currentUser.updateProfile).toHaveBeenCalledTimes(1);
        expect(store.getState().favorites.favoriteListingIds).toEqual(['bob-1']);
        expect(store.getState().user.currentUser.id.uuid).toBe('bob');
        expect(trackMarketingEngagement).not.toHaveBeenCalled();
      });

      it('ignores a delayed success or failure after logout', async () => {
        const logSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
        const success = deferred();
        const failure = deferred();
        const sdk = {
          currentUser: {
            updateProfile: jest
              .fn()
              .mockReturnValueOnce(success.promise)
              .mockReturnValueOnce(failure.promise),
          },
        };

        const storeA = configureStore({ sdk });
        signIn(storeA, 'alice');
        const okToggle = storeA.dispatch(toggleFavorite('alice-1'));
        await Promise.resolve();
        logOut(storeA);
        success.resolve(responseFor('alice', ['alice-1']));
        await okToggle;
        expect(storeA.getState().favorites.favoriteListingIds).toEqual([]);
        expect(storeA.getState().user.currentUser).toBeNull();

        const storeB = configureStore({ sdk });
        signIn(storeB, 'alice', ['kept']);
        const failedToggle = storeB.dispatch(toggleFavorite('alice-2'));
        await Promise.resolve();
        logOut(storeB);
        signIn(storeB, 'bob', ['bob-1']);
        failure.reject(new Error('network down'));
        await failedToggle;
        expect(storeB.getState().favorites.favoriteListingIds).toEqual(['bob-1']);
        logSpy.mockRestore();
      });

      it('does not let a new session of the same user inherit stale intents', async () => {
        const firstUpdate = deferred();
        const thirdUpdate = deferred();
        const sdk = {
          currentUser: {
            updateProfile: jest
              .fn()
              .mockReturnValueOnce(firstUpdate.promise)
              .mockReturnValueOnce(thirdUpdate.promise),
          },
        };
        const store = configureStore({ sdk });
        signIn(store, 'alice');

        const first = store.dispatch(toggleFavorite('old-1'));
        await Promise.resolve();
        const stale = store.dispatch(toggleFavorite('old-2'));

        logOut(store);
        signIn(store, 'alice', ['fresh']);
        const third = store.dispatch(toggleFavorite('new-1'));
        await Promise.resolve();
        // The new session waits for the request already in flight.
        expect(sdk.currentUser.updateProfile).toHaveBeenCalledTimes(1);

        firstUpdate.resolve(responseFor('alice', ['old-1']));
        await first;
        await stale;
        await flush();

        expect(sdk.currentUser.updateProfile).toHaveBeenCalledTimes(2);
        expect(sdk.currentUser.updateProfile.mock.calls[1][0]).toEqual({
          privateData: { favoriteListingIds: ['new-1', 'fresh'] },
        });
        // The stale response did not overwrite the new session's user.
        expect(
          store.getState().user.currentUser.attributes.profile.privateData.favoriteListingIds
        ).toEqual(['fresh']);

        thirdUpdate.resolve(responseFor('alice', ['new-1', 'fresh']));
        await third;
        expect(store.getState().favorites.favoriteListingIds).toEqual(['new-1', 'fresh']);
      });
    });
  });
});
