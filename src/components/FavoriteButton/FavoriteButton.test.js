import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import FavoriteButton from './FavoriteButton';

const { screen, fireEvent } = testingLibrary;

// The test harness maps each translation key to itself; pass real labels so the
// accessible-name assertions read like the production UI (AVWelcomePopup pattern).
const messages = {
  'FavoriteButton.addToFavorites': 'Add to favorites',
  'FavoriteButton.removeFromFavorites': 'Remove from favorites',
};

describe('FavoriteButton', () => {
  it('renders an unfilled heart by default', () => {
    render(<FavoriteButton listingId="listing-1" />, { messages });
    const button = screen.getByRole('button', { name: /add to favorites/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders filled state from store', () => {
    render(<FavoriteButton listingId="listing-1" />, {
      messages,
      initialState: {
        favorites: { favoriteListingIds: ['listing-1'] },
        auth: { isAuthenticated: true },
      },
    });
    expect(screen.getByRole('button', { name: /remove from favorites/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('prevents the card link navigation on click', () => {
    render(<FavoriteButton listingId="listing-1" />, { messages });
    const button = screen.getByRole('button');
    const event = fireEvent.click(button);
    expect(event).toBe(false); // preventDefault was called
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<FavoriteButton listingId="listing-1" />, { messages });
    expect(asFragment()).toMatchSnapshot();
  });
});
