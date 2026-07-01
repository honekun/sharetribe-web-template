import reducer, {
  bagHydrated,
  listingAddedToBag,
  listingRemovedFromBag,
  bagPopupClosed,
  selectBagIds,
  selectBagCount,
  selectIsInBag,
} from './bag.duck';

describe('bag.duck', () => {
  const initial = reducer(undefined, { type: 'unknown' });

  it('initial state: empty, popup closed, not hydrated', () => {
    expect(initial).toEqual({ bagListingIds: [], isPopupOpen: false, hydrated: false });
  });

  it('bagHydrated loads ids and marks hydrated', () => {
    const state = reducer(initial, bagHydrated(['a']));
    expect(state.bagListingIds).toEqual(['a']);
    expect(state.hydrated).toBe(true);
  });

  it('listingAddedToBag prepends id, dedupes, opens popup', () => {
    let state = reducer(initial, listingAddedToBag('a'));
    state = reducer(state, listingAddedToBag('b'));
    state = reducer(state, listingAddedToBag('a'));
    expect(state.bagListingIds).toEqual(['a', 'b']);
    expect(state.isPopupOpen).toBe(true);
  });

  it('listingRemovedFromBag removes id', () => {
    const state = reducer({ ...initial, bagListingIds: ['a', 'b'] }, listingRemovedFromBag('a'));
    expect(state.bagListingIds).toEqual(['b']);
  });

  it('bagPopupClosed closes popup', () => {
    const state = reducer({ ...initial, isPopupOpen: true }, bagPopupClosed());
    expect(state.isPopupOpen).toBe(false);
  });

  it('selectors', () => {
    const globalState = { bag: { bagListingIds: ['x'], isPopupOpen: false, hydrated: true } };
    expect(selectBagIds(globalState)).toEqual(['x']);
    expect(selectBagCount(globalState)).toBe(1);
    expect(selectIsInBag(globalState, 'x')).toBe(true);
  });
});
