import React from 'react';
import '@testing-library/jest-dom';
import {
  getHostedConfiguration,
  renderWithProviders as render,
  testingLibrary,
} from '../../util/testHelpers';
import { createCurrentUser, createListing } from '../../util/testData';
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

// The page only renders for a signed-in user, so every case carries one — with
// a userType, since that is what the manage-listings tab is derived from.
const currentUser = createCurrentUser('user-id', {
  profile: { publicData: { userType: 'a' } },
});

const baseProps = {
  currentUser,
  listings: [],
  queryInProgress: false,
  queryError: null,
  scrollingDisabled: false,
};

// Same hosted config the harness uses, but with user type 'a' barred from
// posting listings — the case that must not show the tab.
const configWithoutPostListings = () => {
  const hosted = getHostedConfiguration();
  return {
    ...hosted,
    userTypes: {
      userTypes: hosted.userTypes.userTypes.map(ut =>
        ut.userType === 'a' ? { ...ut, accountLinksVisibility: { postListings: false } } : ut
      ),
    },
  };
};

describe('FavoritesPage', () => {
  it('renders empty state without crashing', () => {
    render(<FavoritesPageComponent {...baseProps} />, { messages });
    expect(screen.getByText('My favorites')).toBeInTheDocument();
    expect(screen.getByText('You have not liked any listings yet.')).toBeInTheDocument();
  });

  // UserNav only builds the "your listings" tab when showManageListingsLink is
  // passed, so a missing prop silently drops it from this page's nav bar. The
  // two cases together show the prop is derived from the user rather than
  // hardcoded: same page, same markup, opposite result purely from the user
  // type's postListings permission.
  it('renders the manage-listings tab for a user whose type may post listings', () => {
    render(<FavoritesPageComponent {...baseProps} />, { messages });
    expect(screen.getByText('UserNav.yourListings')).toBeInTheDocument();
  });

  it('omits the manage-listings tab for a user whose type may not post listings', () => {
    render(<FavoritesPageComponent {...baseProps} />, {
      messages,
      config: configWithoutPostListings(),
    });
    expect(screen.queryByText('UserNav.yourListings')).not.toBeInTheDocument();
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
