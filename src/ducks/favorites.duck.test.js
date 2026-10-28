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
import { clearCurrentUser } from './user.duck';

describe('favorites.duck', () => {
  it('has empty initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({ favoriteListingIds: [] });
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

  it('drops the list when the user session ends', () => {
    const state = reducer({ favoriteListingIds: ['a', 'b'] }, clearCurrentUser());
    expect(state.favoriteListingIds).toEqual([]);
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
  });
});
