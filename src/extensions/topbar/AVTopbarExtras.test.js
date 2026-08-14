import React from 'react';
import { useSelector } from 'react-redux';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { selectFavoriteIds } from '../../ducks/favorites.duck';

import AVTopbarExtras from './AVTopbarExtras';

const { screen, waitFor } = testingLibrary;

// AVTopbarExtras' job is deciding *whether* the popup shows, not how it looks —
// so observe the props it hands down rather than the rendered modal.
const mockPopupProps = jest.fn();
jest.mock('../../components/AVWelcomePopup', () => props => {
  mockPopupProps(props);
  return null;
});

// The favorites sync writes to the store; surface it as text to assert on.
const FavoritesProbe = () => {
  const ids = useSelector(selectFavoriteIds);
  return <div data-testid="favorites">{ids.join(',')}</div>;
};

const sellerUser = (publicData = {}, privateData = {}) => ({
  id: { uuid: 'user-1' },
  attributes: {
    profile: { publicData: { userType: 'vendedor', ...publicData }, privateData },
  },
});

const noop = () => {};
const defaults = {
  onManageDisableScrolling: noop,
  onMarkVendedorOnboarded: () => Promise.resolve(),
  location: { pathname: '/' },
};

const lastPopupProps = () => mockPopupProps.mock.calls[mockPopupProps.mock.calls.length - 1][0];

beforeEach(() => mockPopupProps.mockClear());

describe('AVTopbarExtras — welcome popup gate', () => {
  it('opens for a seller who has not onboarded', () => {
    render(<AVTopbarExtras {...defaults} isAuthenticated currentUser={sellerUser()} />);

    expect(lastPopupProps()).toMatchObject({ isOpen: true, userType: 'vendedor' });
  });

  it('stays closed once onboarding is completed', () => {
    render(
      <AVTopbarExtras
        {...defaults}
        isAuthenticated
        currentUser={sellerUser({ onboardingCompleted: true })}
      />
    );

    expect(lastPopupProps().isOpen).toBe(false);
  });

  it('stays closed for a non-seller', () => {
    render(
      <AVTopbarExtras
        {...defaults}
        isAuthenticated
        currentUser={sellerUser({ userType: 'comprador' })}
      />
    );

    expect(lastPopupProps().isOpen).toBe(false);
  });

  it('is suppressed on the signup page', () => {
    render(
      <AVTopbarExtras
        {...defaults}
        location={{ pathname: '/signup' }}
        isAuthenticated
        currentUser={sellerUser()}
      />
    );

    expect(lastPopupProps().isOpen).toBe(false);
  });

  it('returns the persistence promise from onClose so a CTA can await it', async () => {
    const onMarkVendedorOnboarded = jest.fn(() => Promise.resolve('saved'));
    render(
      <AVTopbarExtras
        {...defaults}
        onMarkVendedorOnboarded={onMarkVendedorOnboarded}
        isAuthenticated
        currentUser={sellerUser()}
      />
    );

    await expect(lastPopupProps().onClose()).resolves.toBe('saved');
    expect(onMarkVendedorOnboarded).toHaveBeenCalled();
  });
});

describe('AVTopbarExtras — favorites hydration', () => {
  const renderWithProbe = props =>
    render(
      <>
        <AVTopbarExtras {...defaults} {...props} />
        <FavoritesProbe />
      </>
    );

  it('hydrates the saved list from the current user', async () => {
    renderWithProbe({
      isAuthenticated: true,
      currentUser: sellerUser({}, { favoriteListingIds: ['l1', 'l2'] }),
    });

    await waitFor(() => expect(screen.getByTestId('favorites')).toHaveTextContent('l1,l2'));
  });

  it('clears the list for a signed-out visitor', async () => {
    renderWithProbe({ isAuthenticated: false, currentUser: null });

    await waitFor(() => expect(screen.getByTestId('favorites')).toHaveTextContent(''));
  });

  it('waits for currentUser before syncing an authenticated session', () => {
    // Syncing here would blank the hearts on every page load.
    renderWithProbe({ isAuthenticated: true, currentUser: null });

    expect(screen.getByTestId('favorites')).toHaveTextContent('');
  });
});
