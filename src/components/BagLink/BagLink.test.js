import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import BagLink from './BagLink';

const { screen } = testingLibrary;

const messages = { 'BagLink.label': 'Shopping bag' };

describe('BagLink', () => {
  it('links to the bag page', () => {
    render(<BagLink />, { messages });
    expect(screen.getByRole('link', { name: /shopping bag/i })).toHaveAttribute('href', '/bag');
  });

  it('shows a count badge when bag has items', () => {
    render(<BagLink />, {
      messages,
      initialState: { bag: { bagListingIds: ['a', 'b'], isPopupOpen: false, hydrated: true } },
    });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('hides the badge when empty', () => {
    render(<BagLink />, { messages });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
