import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../../util/testHelpers';
import { AV_PROFILE_LINKS } from '../../../../../extensions/topbar/links';

import { AVInboxLink, FavoritesLink, renderAvProfileMenuItems } from './AVTopbarLinks';

const { screen } = testingLibrary;

describe('FavoritesLink', () => {
  it('links to the favorites page with an accessible label', () => {
    render(<FavoritesLink />);

    const link = screen.getByRole('link', { name: 'TopbarDesktop.favoritesLink' });
    expect(link).toHaveAttribute('href', '/favorites');
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
});
