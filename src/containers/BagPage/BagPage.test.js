import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import BagPage from './BagPage';

const { screen } = testingLibrary;

// Harness maps translation keys to themselves; pass real labels so text
// assertions read like production.
const messages = {
  'BagPage.title': 'My bag',
  'BagPage.heading': 'My bag',
  'BagPage.empty': 'Your bag is empty.',
};

const emptyState = {
  bag: { bagListingIds: [], isPopupOpen: false, hydrated: true },
  BagPage: { fetchInProgress: false, fetchError: null, listingRefs: [] },
};

describe('BagPage', () => {
  it('renders empty bag without crashing', () => {
    render(<BagPage />, { messages, initialState: emptyState });
    expect(screen.getByText('Your bag is empty.')).toBeInTheDocument();
  });

  it('matches snapshot (empty)', () => {
    const { asFragment } = render(<BagPage />, { messages, initialState: emptyState });
    expect(asFragment()).toMatchSnapshot();
  });
});
