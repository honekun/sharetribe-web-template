import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render } from '../../../../../util/testHelpers';

import PriorityLinks from './AVPriorityLinks';

const links = [
  { text: 'Blog', type: 'external', href: 'https://example.com/blog' },
  { text: 'About', type: 'external', href: 'https://example.com/about' },
];

// jsdom has no layout: offsetWidth is always 0, which is exactly what a
// display:none TopbarDesktop reports below --viewportLarge.
const setRenderedWidth = width =>
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);

describe('AVPriorityLinks measurement', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not write zero widths while the desktop topbar is hidden', () => {
    setRenderedWidth(0);
    const setLinks = jest.fn();

    const { rerender } = render(
      <PriorityLinks links={links} priorityLinks={[]} setLinks={setLinks} containerWidth={0} />
    );
    rerender(
      <PriorityLinks links={links} priorityLinks={[]} setLinks={setLinks} containerWidth={0} />
    );

    expect(setLinks).not.toHaveBeenCalled();
  });

  it('measures once the container is resized to a visible desktop width', () => {
    const offsetWidth = setRenderedWidth(0);
    const setLinks = jest.fn();

    const { rerender } = render(
      <PriorityLinks links={links} priorityLinks={[]} setLinks={setLinks} containerWidth={0} />
    );
    expect(setLinks).not.toHaveBeenCalled();

    // Resize to desktop: the links now have a width and the ResizeObserver
    // reports a new containerWidth.
    offsetWidth.mockReturnValue(80);
    rerender(
      <PriorityLinks links={links} priorityLinks={[]} setLinks={setLinks} containerWidth={1200} />
    );

    expect(setLinks).toHaveBeenCalledWith([
      { ...links[0], width: 80, cumulatedWidth: 80 },
      { ...links[1], width: 80, cumulatedWidth: 160 },
    ]);
  });

  it('does not remeasure links that already carry widths', () => {
    setRenderedWidth(80);
    const setLinks = jest.fn();
    const measured = [
      { ...links[0], width: 80, cumulatedWidth: 80 },
      { ...links[1], width: 80, cumulatedWidth: 160 },
    ];

    render(
      <PriorityLinks
        links={measured}
        priorityLinks={measured}
        setLinks={setLinks}
        containerWidth={1200}
      />
    );

    expect(setLinks).not.toHaveBeenCalled();
  });
});
