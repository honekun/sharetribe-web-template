import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../../util/testHelpers';
import { AV_PROFILE_LINKS } from '../../../../../extensions/topbar/links';

import { AVInboxLink, FavoritesLink, renderAvProfileMenuItems } from './AVTopbarLinks';

const { screen } = testingLibrary;

const storeSellerState = {
  user: {
    currentUser: { attributes: { profile: { publicData: { userType: 'vendedor-tienda' } } } },
  },
};

describe('FavoritesLink', () => {
  it('links to the favorites page with an accessible label', () => {
    render(<FavoritesLink />);

    const link = screen.getByRole('link', { name: 'TopbarDesktop.favoritesLink' });
    expect(link).toHaveAttribute('href', '/favorites');
  });

  // Three copies of this component are mounted at once (desktop topbar, mobile
  // topbar, mobile menu footer). Only the caller that means to be unique may
  // set an id, or every page carries three of the same one.
  it('carries no id unless one is given', () => {
    render(<FavoritesLink />);
    expect(screen.getByRole('link', { name: 'TopbarDesktop.favoritesLink' })).not.toHaveAttribute(
      'id'
    );
  });

  it('uses the id it is given', () => {
    render(<FavoritesLink id="favorites-link" />);
    expect(screen.getByRole('link', { name: 'TopbarDesktop.favoritesLink' })).toHaveAttribute(
      'id',
      'favorites-link'
    );
  });

  // Gated in the component so all three mount points hide it at once.
  it('renders nothing for a store seller', () => {
    const { container } = render(<FavoritesLink id="favorites-link" />, {
      initialState: storeSellerState,
    });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('AVInboxLink', () => {
  it('links to the inbox tab with an accessible label', () => {
    render(<AVInboxLink notificationCount={0} inboxTab="sales" />);

    const link = screen.getByRole('link', { name: 'TopbarDesktop.inbox' });
    expect(link).toHaveAttribute('href', '/inbox/sales');
  });

  it('shows a notification dot only when there are notifications', () => {
    const { container: none } = render(<AVInboxLink notificationCount={0} inboxTab="orders" />);
    expect(none.querySelector('.notificationDot')).not.toBeInTheDocument();

    const { container: some } = render(<AVInboxLink notificationCount={3} inboxTab="orders" />);
    expect(some.querySelector('.notificationDot')).toBeInTheDocument();
  });

  it('carries no id unless one is given', () => {
    render(<AVInboxLink notificationCount={0} inboxTab="sales" />);
    expect(screen.getByRole('link', { name: 'TopbarDesktop.inbox' })).not.toHaveAttribute('id');
  });

  it('uses the id it is given', () => {
    render(<AVInboxLink id="inbox-link" notificationCount={0} inboxTab="sales" />);
    expect(screen.getByRole('link', { name: 'TopbarDesktop.inbox' })).toHaveAttribute(
      'id',
      'inbox-link'
    );
  });

  // Only the inbox sidebar's Orders tab is hidden from store sellers; the
  // envelope itself is how they reach messages about their sales.
  it('stays visible for a store seller', () => {
    render(<AVInboxLink notificationCount={3} inboxTab="sales" />, {
      initialState: storeSellerState,
    });

    expect(screen.getByRole('link', { name: 'TopbarDesktop.inbox' })).toHaveAttribute(
      'href',
      '/inbox/sales'
    );
  });
});

describe('renderAvProfileMenuItems', () => {
  it('returns one keyed MenuItem per AV profile link', () => {
    const items = renderAvProfileMenuItems('ProfileSettingsPage');

    expect(items).toHaveLength(AV_PROFILE_LINKS.length);
    // MenuContent throws unless every child is a keyed MenuItem.
    items.forEach(item => expect(item.key).toBeTruthy());
  });

  it('marks only the current page as active', () => {
    const active = AV_PROFILE_LINKS[0].pageName;
    const items = renderAvProfileMenuItems(active);

    const classNamesByPage = items.map(item => item.props.children.props.className);
    expect(classNamesByPage[0]).toContain('currentPage');
    classNamesByPage.slice(1).forEach(cls => expect(cls).not.toContain('currentPage'));
  });

  it('omits the favorites item for a store seller', () => {
    const storeSeller = {
      attributes: { profile: { publicData: { userType: 'vendedor-tienda' } } },
    };
    const items = renderAvProfileMenuItems('ProfileSettingsPage', storeSeller);

    expect(items.map(item => item.key)).toEqual([
      'MyPurchasesPage',
      'MySalesPage',
      'MyBalancePage',
    ]);
  });
});
