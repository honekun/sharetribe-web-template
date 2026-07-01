import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { FavoritesPageComponent } from './FavoritesPage';

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
});
