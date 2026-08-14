import reducer, {
  setFavorites,
  favoriteToggled,
  selectFavoriteIds,
  selectIsFavorite,
  syncFavoritesFromUser,
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
});
