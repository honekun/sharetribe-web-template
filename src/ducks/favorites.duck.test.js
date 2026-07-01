import reducer, {
  setFavorites,
  favoriteToggled,
  selectFavoriteIds,
  selectIsFavorite,
} from './favorites.duck';

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

  it('selectors read from state.favorites', () => {
    const globalState = { favorites: { favoriteListingIds: ['x'] } };
    expect(selectFavoriteIds(globalState)).toEqual(['x']);
    expect(selectIsFavorite(globalState, 'x')).toBe(true);
    expect(selectIsFavorite(globalState, 'y')).toBe(false);
  });
});
