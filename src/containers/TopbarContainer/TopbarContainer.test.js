import React from 'react';
import { Provider } from 'react-redux';
import '@testing-library/jest-dom';

import { IntlProvider } from '../../util/reactIntl';
import { testingLibrary } from '../../util/testHelpers';
import configureStore from '../../store';
import { selectFavoriteIds } from '../../ducks/favorites.duck';
import { clearCurrentUser } from '../../ducks/user.duck';

import { TopbarContainerComponent } from './TopbarContainer';

// The Topbar itself is not under test here, and rendering it would pull in the
// whole app configuration context.
jest.mock('./Topbar/Topbar', () => ({ __esModule: true, default: () => null }));

const { render, waitFor } = testingLibrary;

const noop = () => null;

// renderWithProviders builds a new store on every render, which a rerender-based
// test would silently reset, so this suite owns the store and reads the slice
// straight off it.
const renderWithStore = (ui, initialState) => {
  const store = configureStore({ initialState });
  const Wrapper = ({ children }) => (
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}} textComponent="span">
        {children}
      </IntlProvider>
    </Provider>
  );
  return { store, ...render(ui, { wrapper: Wrapper }) };
};

// userType is left unset so the onboarding popup stays out of this test.
const userWith = (uuid, favoriteListingIds) => ({
  id: { uuid },
  attributes: {
    profile: {
      publicData: {},
      ...(favoriteListingIds === undefined ? {} : { privateData: { favoriteListingIds } }),
    },
  },
});

const topbarWith = (currentUser, isAuthenticated = !!currentUser) => (
  <TopbarContainerComponent
    currentUser={currentUser}
    isAuthenticated={isAuthenticated}
    location={{ pathname: '/' }}
    onManageDisableScrolling={noop}
    onMarkVendedorOnboarded={() => Promise.resolve()}
    onLogout={noop}
    onResendVerificationEmail={noop}
    notificationCount={0}
    hasGenericError={false}
  />
);

const renderTopbar = (currentUser, initialFavorites = [], isAuthenticated) => {
  const view = renderWithStore(topbarWith(currentUser, isAuthenticated), {
    favorites: { favoriteListingIds: initialFavorites },
  });
  return {
    ...view,
    signIn: (nextUser, nextIsAuthenticated) =>
      view.rerender(topbarWith(nextUser, nextIsAuthenticated)),
    favorites: () => selectFavoriteIds(view.store.getState()),
  };
};

describe('TopbarContainer favorites sync', () => {
  it('loads the signed-in user’s saved favorites', async () => {
    const { favorites } = renderTopbar(userWith('user-a', ['listing-1', 'listing-2']));
    await waitFor(() => expect(favorites()).toEqual(['listing-1', 'listing-2']));
  });

  it('clears favorites left over from a previous session on logout', async () => {
    const { favorites } = renderTopbar(null, ['listing-1', 'listing-2']);
    await waitFor(() => expect(favorites()).toEqual([]));
  });

  it('replaces one user’s favorites when another signs in', async () => {
    const { favorites, signIn } = renderTopbar(userWith('user-a', ['listing-1']));
    await waitFor(() => expect(favorites()).toEqual(['listing-1']));

    // A different account with nothing saved must not inherit the list.
    signIn(userWith('user-b', undefined));
    await waitFor(() => expect(favorites()).toEqual([]));

    signIn(userWith('user-c', ['listing-9']));
    await waitFor(() => expect(favorites()).toEqual(['listing-9']));
  });

  it('does not re-sync while the same user and list are unchanged', async () => {
    const { store, favorites, signIn } = renderTopbar(userWith('user-a', ['listing-1']));
    await waitFor(() => expect(favorites()).toEqual(['listing-1']));

    const listBefore = favorites();
    // A new currentUser object carrying the same data must not churn the slice.
    signIn(userWith('user-a', ['listing-1']));

    expect(selectFavoriteIds(store.getState())).toBe(listBefore);
  });

  it('clears the slice when the session ends, whatever is mounted', () => {
    const { store, favorites } = renderTopbar(userWith('user-a', ['listing-1']));
    store.dispatch(clearCurrentUser());
    expect(favorites()).toEqual([]);
  });

  it('keeps the list while an authenticated user is still being fetched', async () => {
    // currentUser arrives a moment after the session is known to be signed in;
    // clearing in that window would blank the hearts on every page load.
    const { favorites, signIn } = renderTopbar(null, ['listing-1'], true);

    await waitFor(() => expect(favorites()).toEqual(['listing-1']));

    signIn(userWith('user-a', ['listing-1', 'listing-2']), true);
    await waitFor(() => expect(favorites()).toEqual(['listing-1', 'listing-2']));
  });
});
