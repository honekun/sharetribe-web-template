import configureStore from '../store';
import { createCurrentUser, createOwnListing } from '../util/testData';
import * as log from '../util/log';
import {
  clearCurrentUser,
  fetchCurrentUser,
  markVendedorOnboarded,
  setCurrentUser,
  setCurrentUserHasOrders,
} from './user.duck';

// fetchCurrentUser dispatches the derived-data fetches from inside its own
// .then, before its fulfilled reducer stores the user. A cold page load (no
// currentUser in the store yet) must still query listings and orders.
describe('fetchCurrentUser derived data on a cold load', () => {
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  const setup = userAttributes => {
    const currentUser = createCurrentUser('user-1', userAttributes);
    const sdk = {
      authInfo: jest.fn(() => Promise.resolve({ isAnonymous: false })),
      currentUser: { show: jest.fn(() => Promise.resolve({ data: { data: currentUser } })) },
      ownListings: {
        query: jest.fn(() => Promise.resolve({ data: { data: [createOwnListing('listing-1')] } })),
      },
      transactions: {
        query: jest.fn(params =>
          Promise.resolve({ data: { data: params.states ? [] : [{ id: 'tx-1' }] } })
        ),
      },
    };
    const store = configureStore({ initialState: { auth: { isAuthenticated: true } }, sdk });
    return { store, sdk };
  };

  it('queries published listings even though the store has no currentUser yet', async () => {
    const { store, sdk } = setup();
    expect(store.getState().user.currentUser).toBeNull();

    await store.dispatch(fetchCurrentUser());
    await flush();

    expect(sdk.ownListings.query).toHaveBeenCalledTimes(1);
    expect(store.getState().user.currentUserHasListings).toBe(true);
  });

  it('queries orders for an unverified user even though the store has no currentUser yet', async () => {
    const { store, sdk } = setup({ emailVerified: false });

    await store.dispatch(fetchCurrentUser());
    await flush();

    const ordersQuery = sdk.transactions.query.mock.calls.find(
      ([params]) => params.only === 'order' && !params.states
    );
    expect(ordersQuery).toBeDefined();
    expect(store.getState().user.currentUserHasOrders).toBe(true);
  });
});

describe('clearCurrentUser', () => {
  it('resets the hasOrders flag so it does not leak to the next session', () => {
    const store = configureStore({});
    store.dispatch(setCurrentUserHasOrders());
    expect(store.getState().user.currentUserHasOrders).toBe(true);

    store.dispatch(clearCurrentUser());

    expect(store.getState().user.currentUserHasOrders).toBeNull();
  });
});

describe('markVendedorOnboarded', () => {
  const payload = { publicData: { onboardingCompleted: true } };

  it('persists onboardingCompleted and syncs the current user in state', async () => {
    const updatedUser = createCurrentUser('user-1');
    const sdk = {
      currentUser: {
        updateProfile: jest.fn(() => Promise.resolve({ data: { data: updatedUser } })),
      },
    };
    const dispatch = jest.fn();

    await markVendedorOnboarded()(dispatch, () => ({}), sdk);

    expect(sdk.currentUser.updateProfile).toHaveBeenCalledWith(payload, { expand: true });
    // The denormalised user is pushed into state.user.currentUser via setCurrentUser.
    const dispatched = dispatch.mock.calls.map(([action]) => action);
    expect(dispatched).toContainEqual(expect.objectContaining({ type: setCurrentUser.type }));
  });

  it('swallows persistence errors and logs them (popup stays dismissed for the session)', async () => {
    const logSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    const error = new Error('network down');
    const sdk = { currentUser: { updateProfile: jest.fn(() => Promise.reject(error)) } };
    const dispatch = jest.fn();

    // Should resolve, not reject — no unhandled rejection.
    await expect(markVendedorOnboarded()(dispatch, () => ({}), sdk)).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(error, 'mark-vendedor-onboarded-failed');
    expect(dispatch).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
