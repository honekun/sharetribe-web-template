import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import AVTopbarIconLinks from './AVTopbarIconLinks';

const { screen } = testingLibrary;

describe('AVTopbarIconLinks', () => {
  it('shows inbox, favorites and bag when signed in', async () => {
    render(<AVTopbarIconLinks isAuthenticated notificationCount={0} inboxTab="orders" />);

    // The auth-only icons appear after mount (see the `mounted` guard).
    expect(await screen.findByRole('link', { name: 'TopbarDesktop.inbox' })).toHaveAttribute(
      'href',
      '/inbox/orders'
    );
    expect(screen.getByRole('link', { name: 'TopbarDesktop.favoritesLink' })).toHaveAttribute(
      'href',
      '/favorites'
    );
    expect(screen.getByRole('link', { name: 'BagLink.label' })).toHaveAttribute('href', '/bag');
  });

  it('shows only the bag when signed out', () => {
    render(<AVTopbarIconLinks isAuthenticated={false} inboxTab="orders" />);

    expect(screen.getByRole('link', { name: 'BagLink.label' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'TopbarDesktop.inbox' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'TopbarDesktop.favoritesLink' })
    ).not.toBeInTheDocument();
  });

  it('applies the layout className from the consuming topbar', () => {
    const { container } = render(
      <AVTopbarIconLinks className="layoutClass" isAuthenticated={false} inboxTab="orders" />
    );

    expect(container.querySelector('.layoutClass')).toBeInTheDocument();
  });
});
