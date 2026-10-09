import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { AV_PROFILE_LINKS } from './links';

import { filterAvProfileLinks, useAvProfileLinks, useIsNavPageHidden } from './avNavVisibility';

const { screen } = testingLibrary;

const stateWithUserType = userType => ({
  user: { currentUser: { attributes: { profile: { publicData: { userType } } } } },
});

const pageNames = links => links.map(({ pageName }) => pageName);

describe('filterAvProfileLinks', () => {
  it('returns the whole registry, in order, for a user with nothing hidden', () => {
    const links = filterAvProfileLinks({
      attributes: { profile: { publicData: { userType: 'vendedor' } } },
    });

    expect(links).toEqual(AV_PROFILE_LINKS);
  });

  it('drops favorites for a store seller and keeps the rest in order', () => {
    const links = filterAvProfileLinks({
      attributes: { profile: { publicData: { userType: 'vendedor-tienda' } } },
    });

    expect(pageNames(links)).toEqual(['MyPurchasesPage', 'MySalesPage', 'MyBalancePage']);
  });

  it('returns the whole registry when signed out', () => {
    expect(filterAvProfileLinks(null)).toEqual(AV_PROFILE_LINKS);
  });
});

// The hooks are what the two consumers with no `currentUser` in scope use, so
// the point of these is that they read the *store*, not an argument.
describe('useIsNavPageHidden', () => {
  const Probe = ({ pageName }) => (
    <span data-testid="hidden">{String(useIsNavPageHidden(pageName))}</span>
  );

  it('reports a hidden entry for a store seller in the store', () => {
    render(<Probe pageName="InboxPage:orders" />, {
      initialState: stateWithUserType('vendedor-tienda'),
    });

    expect(screen.getByTestId('hidden')).toHaveTextContent('true');
  });

  it('reports nothing hidden for another user type', () => {
    render(<Probe pageName="InboxPage:orders" />, { initialState: stateWithUserType('vendedor') });

    expect(screen.getByTestId('hidden')).toHaveTextContent('false');
  });

  it('reports nothing hidden when the store holds no user', () => {
    render(<Probe pageName="InboxPage:orders" />);

    expect(screen.getByTestId('hidden')).toHaveTextContent('false');
  });
});

describe('useAvProfileLinks', () => {
  const Probe = () => <span data-testid="links">{pageNames(useAvProfileLinks()).join(',')}</span>;

  it('filters the registry using the user in the store', () => {
    render(<Probe />, { initialState: stateWithUserType('vendedor-tienda') });

    expect(screen.getByTestId('links')).toHaveTextContent(
      'MyPurchasesPage,MySalesPage,MyBalancePage'
    );
  });

  it('returns the whole registry for everyone else', () => {
    render(<Probe />, { initialState: stateWithUserType('vendedor') });

    expect(screen.getByTestId('links')).toHaveTextContent(pageNames(AV_PROFILE_LINKS).join(','));
  });
});
