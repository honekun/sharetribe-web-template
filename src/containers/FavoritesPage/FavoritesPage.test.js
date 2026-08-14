import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { createListing } from '../../util/testData';
import FavoritesPage, { FavoritesPageComponent } from './FavoritesPage';

const { screen } = testingLibrary;

// The harness maps each translation key to itself; pass real labels so text
// assertions read like production and don't collide across the "Favorites*" keys.
const messages = {
  'FavoritesPage.title': 'Favorites',
  'FavoritesPage.heading': 'My favorites',
  'FavoritesPage.noFavorites': 'You have not liked any listings yet.',
  'FavoritesPage.queryError': 'Loading favorites failed. Please try again.',
};

const baseProps = {
  listings: [],
  queryInProgress: false,
  queryError: null,
  scrollingDisabled: false,
};

describe('FavoritesPage', () => {
  it('renders empty state without crashing', () => {
    render(<FavoritesPageComponent {...baseProps} />, { messages });
    expect(screen.getByText('My favorites')).toBeInTheDocument();
    expect(screen.getByText('You have not liked any listings yet.')).toBeInTheDocument();
  });

  it('matches snapshot (empty state)', () => {
    const { asFragment } = render(<FavoritesPageComponent {...baseProps} />, { messages });
    expect(asFragment()).toMatchSnapshot();
  });

  // The connected page live-filters the loaded refs by the favorites duck, so
  // un-favoriting a card (which updates state.favorites optimistically) removes
  // it without a refetch.
  describe('live filter by favorites state', () => {
    const listingA = createListing('listing-a');
    const listingB = createListing('listing-b');

    // The page only exists for a signed-in user, and TopbarContainer keeps the
    // favorites slice in step with that user's saved list — so the session has
    // to carry the same ids, or the sync would (correctly) clear them.
    const stateWithFavorites = favoriteListingIds => ({
      auth: { isAuthenticated: true },
      user: {
        currentUser: {
          id: { uuid: 'user-id' },
          attributes: { profile: { publicData: {}, privateData: { favoriteListingIds } } },
        },
      },
      FavoritesPage: {
        listingRefs: [{ id: listingA.id, type: 'listing' }, { id: listingB.id, type: 'listing' }],
        queryInProgress: false,
        queryError: null,
      },
      favorites: { favoriteListingIds },
      marketplaceData: {
        entities: { listing: { 'listing-a': listingA, 'listing-b': listingB } },
      },
    });

    it('renders all loaded listings while they are favorited', () => {
      render(<FavoritesPage />, {
        initialState: stateWithFavorites(['listing-a', 'listing-b']),
        messages,
      });
      expect(screen.getByText('listing-a title')).toBeInTheDocument();
      expect(screen.getByText('listing-b title')).toBeInTheDocument();
    });

    it('hides a loaded listing once it is no longer in favorites', () => {
      render(<FavoritesPage />, {
        initialState: stateWithFavorites(['listing-b']),
        messages,
      });
      expect(screen.queryByText('listing-a title')).not.toBeInTheDocument();
      expect(screen.getByText('listing-b title')).toBeInTheDocument();
    });

    it('shows the empty state when every loaded listing is un-favorited', () => {
      render(<FavoritesPage />, { initialState: stateWithFavorites([]), messages });
      expect(screen.getByText('You have not liked any listings yet.')).toBeInTheDocument();
    });
  });
});
