import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';
import { AV_PROFILE_LINKS } from '../../../../extensions/topbar/links';

import { AVMobileBagSection, renderAvMobileMenuLinks } from './AVMobileMenuLinks';

const { screen } = testingLibrary;

describe('AVMobileBagSection', () => {
  it('links to the bag', () => {
    render(<AVMobileBagSection />);

    expect(screen.getByRole('link', { name: 'TopbarMobileMenu.bagLink' })).toHaveAttribute(
      'href',
      '/bag'
    );
  });
});

describe('renderAvMobileMenuLinks', () => {
  const noActivePage = () => null;

  it('renders the bag row plus one row per AV profile link', () => {
    const items = renderAvMobileMenuLinks(noActivePage);

    expect(items).toHaveLength(AV_PROFILE_LINKS.length + 1);
    // Rows sit directly inside upstream's <ul>, so each needs a key.
    items.forEach(item => expect(item.key).toBeTruthy());
  });

  it("passes each page name through the caller's active-page helper", () => {
    const currentPageClass = jest.fn(() => null);
    renderAvMobileMenuLinks(currentPageClass);

    const asked = currentPageClass.mock.calls.map(([page]) => page);
    expect(asked).toEqual(['BagPage', ...AV_PROFILE_LINKS.map(l => l.pageName)]);
  });

  it('applies the active class the helper returns', () => {
    const items = renderAvMobileMenuLinks(page => (page === 'BagPage' ? 'currentPage' : null));

    expect(items[0].props.className).toContain('currentPage');
    expect(items[1].props.className).not.toContain('currentPage');
  });
});
