import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import BagPopup from './BagPopup';

const { screen } = testingLibrary;

// Harness maps translation keys to themselves; pass real labels for text matchers.
const messages = {
  'BagPopup.addedToBag': 'Added to your bag',
  'BagPopup.goToBag': 'Go to bag',
  'BagPopup.keepBrowsing': 'Keep browsing',
  'BagPopup.remove': 'Remove from bag',
};

describe('BagPopup', () => {
  it('renders nothing when closed', () => {
    render(<BagPopup />, { messages });
    expect(screen.queryByText(/added to your bag/i)).not.toBeInTheDocument();
  });

  it('renders contents when open', () => {
    render(<BagPopup />, {
      messages,
      withPortals: true,
      initialState: { bag: { bagListingIds: ['a'], isPopupOpen: true, hydrated: true } },
    });
    expect(screen.getByText(/added to your bag/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to bag/i })).toHaveAttribute('href', '/bag');
  });
});
