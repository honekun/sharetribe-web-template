import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import BagPopup from './BagPopup';

const { screen } = testingLibrary;

// Harness maps translation keys to themselves; pass real labels for text matchers.
const messages = {
  'BagPopup.titleLabel': 'Bag',
  'BagPopup.titleCount': '({count} items)',
  'BagPopup.close': 'Close',
  'BagPopup.goToBag': 'Go to bag',
};

describe('BagPopup', () => {
  it('renders nothing when closed', () => {
    render(<BagPopup />, { messages });
    expect(screen.queryByText(/go to bag/i)).not.toBeInTheDocument();
  });

  it('renders the anchored dropdown when open', () => {
    render(<BagPopup />, {
      messages,
      initialState: { bag: { bagListingIds: ['a'], isPopupOpen: true, hydrated: true } },
    });
    // Title label + item count render as separate spans; close + Go to bag actions are shown.
    expect(screen.getByRole('dialog', { name: 'Bag (1 items)' })).toBeInTheDocument();
    expect(screen.getByText('Bag')).toBeInTheDocument();
    expect(screen.getByText('(1 items)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to bag/i })).toHaveAttribute('href', '/bag');
  });

  it('uses selectors that return stable references (no React-Redux warning)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(<BagPopup />, {
      messages,
      initialState: { bag: { bagListingIds: ['a'], isPopupOpen: true, hydrated: true } },
    });
    const unstable = warn.mock.calls.filter(([msg]) =>
      /returned a different result when called with the same parameters/.test(String(msg))
    );
    warn.mockRestore();
    expect(unstable).toEqual([]);
  });
});
