import reducer, {
  bagHydrated,
  listingAddedToBag,
  listingRemovedFromBag,
  bagPopupClosed,
  selectBagIds,
  selectBagCount,
  selectIsInBag,
  syncBagOwner,
} from './bag.duck';
import { readBag, readBagOwner, writeBag, writeBagOwner } from '../util/bagStorage';

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

describe('syncBagOwner', () => {
  beforeEach(() => window.localStorage.clear());

  const run = currentUserId => {
    const dispatch = jest.fn();
    syncBagOwner(currentUserId)(dispatch);
    return dispatch;
  };

  it('adopts a guest bag for the user who signs in, keeping its items', () => {
    writeBag(['a', 'b']);

    const dispatch = run('user-1');

    expect(readBagOwner()).toBe('user-1');
    expect(readBag()).toEqual(['a', 'b']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("empties a signed-in user's bag once the session is signed out", () => {
    writeBag(['a']);
    writeBagOwner('user-1');

    const dispatch = run(null);

    expect(readBag()).toEqual([]);
    expect(readBagOwner()).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(bagHydrated([]));
  });

  it('empties the bag and re-adopts it when a different account signs in', () => {
    writeBag(['a']);
    writeBagOwner('user-1');

    run('user-2');

    expect(readBag()).toEqual([]);
    expect(readBagOwner()).toBe('user-2');
  });

  it('keeps the bag for the same user across page loads', () => {
    writeBag(['a']);
    writeBagOwner('user-1');

    const dispatch = run('user-1');

    expect(readBag()).toEqual(['a']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('leaves a guest bag alone while signed out', () => {
    writeBag(['a']);

    run(null);

    expect(readBag()).toEqual(['a']);
    expect(readBagOwner()).toBeNull();
  });
});
