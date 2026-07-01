import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import AddToBagButton from './AddToBagButton';

const { screen } = testingLibrary;

// The test harness maps each translation key to itself; pass real labels so the
// accessible-name matchers read like production (AVWelcomePopup/FavoriteButton pattern).
const messages = {
  'AddToBagButton.addToBag': 'Add to bag',
  'AddToBagButton.inBag': 'In your bag',
};

describe('AddToBagButton', () => {
  it('renders "add to bag" when listing not in bag', () => {
    render(<AddToBagButton listingId="l1" />, { messages });
    expect(screen.getByRole('button', { name: /add to bag/i })).toBeInTheDocument();
  });

  it('renders "in your bag" state when already added', () => {
    render(<AddToBagButton listingId="l1" />, {
      messages,
      initialState: { bag: { bagListingIds: ['l1'], isPopupOpen: false, hydrated: true } },
    });
    expect(screen.getByRole('button', { name: /in your bag/i })).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<AddToBagButton listingId="l1" />, { messages });
    expect(asFragment()).toMatchSnapshot();
  });
});
