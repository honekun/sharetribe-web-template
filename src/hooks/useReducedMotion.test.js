import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../util/testHelpers';

import useReducedMotion from './useReducedMotion';

const { act } = testingLibrary;

const Probe = () => <span data-testid="value">{String(useReducedMotion())}</span>;

// jsdom has no real media queries, so stand in a controllable MediaQueryList.
const mockMatchMedia = ({ matches, legacyListenerApi = false }) => {
  const listeners = new Set();
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    ...(legacyListenerApi
      ? {
          addListener: fn => listeners.add(fn),
          removeListener: fn => listeners.delete(fn),
        }
      : {
          addEventListener: (_, fn) => listeners.add(fn),
          removeEventListener: (_, fn) => listeners.delete(fn),
        }),
  };
  window.matchMedia = jest.fn().mockReturnValue(mql);
  return {
    mql,
    change: next => {
      mql.matches = next;
      act(() => listeners.forEach(fn => fn({ matches: next })));
    },
    listenerCount: () => listeners.size,
  };
};

describe('useReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('reports the preference once the effect has run', () => {
    mockMatchMedia({ matches: true });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('value')).toHaveTextContent('true');
  });

  it('reports false when the visitor has expressed no preference', () => {
    mockMatchMedia({ matches: false });
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('value')).toHaveTextContent('false');
  });

  it('follows the preference when it changes while the page is open', () => {
    const media = mockMatchMedia({ matches: false });
    const { getByTestId } = render(<Probe />);

    media.change(true);
    expect(getByTestId('value')).toHaveTextContent('true');

    media.change(false);
    expect(getByTestId('value')).toHaveTextContent('false');
  });

  it('supports the deprecated addListener API older Safari versions expose', () => {
    const media = mockMatchMedia({ matches: false, legacyListenerApi: true });
    const { getByTestId } = render(<Probe />);

    media.change(true);
    expect(getByTestId('value')).toHaveTextContent('true');
  });

  it('unsubscribes on unmount', () => {
    const media = mockMatchMedia({ matches: false });
    const { unmount } = render(<Probe />);
    expect(media.listenerCount()).toBe(1);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('falls back to false where matchMedia is unavailable (SSR, old browsers)', () => {
    window.matchMedia = undefined;
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('value')).toHaveTextContent('false');
  });
});
