import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import AVPhotoSlider, { usableSlides } from './AVPhotoSlider';

const { act } = testingLibrary;

// The slides are decorative (alt=""), so they expose the "presentation" role
// rather than "img" — read them straight from the DOM instead.
const slidesOf = container => Array.from(container.querySelectorAll('img'));

const IMAGES = ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg', 'https://cdn.test/3.jpg'];

describe('usableSlides', () => {
  it('drops the entries an operator has not filled in', () => {
    expect(usableSlides(['a.jpg', '', '  ', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg']);
  });

  it('trims surrounding whitespace', () => {
    expect(usableSlides([' a.jpg '])).toEqual(['a.jpg']);
  });

  it('returns an empty array for anything that is not an array of strings', () => {
    expect(usableSlides(undefined)).toEqual([]);
    expect(usableSlides(null)).toEqual([]);
    expect(usableSlides('a.jpg')).toEqual([]);
    expect(usableSlides([null, 3, {}])).toEqual([]);
  });
});

describe('AVPhotoSlider', () => {
  it('renders the supplied images, not a bundled default', () => {
    jest.useFakeTimers();
    try {
      const { container } = render(<AVPhotoSlider images={IMAGES} intervalMs={1000} />);
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const rendered = slidesOf(container);
      expect(rendered.map(img => img.getAttribute('src'))).toEqual(IMAGES);
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders nothing when no slide is configured', () => {
    const { container } = render(<AVPhotoSlider images={['', '', '', '']} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the images prop is missing', () => {
    const { container } = render(<AVPhotoSlider />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mounts only the first slide up front, so the rest are not fetched', () => {
    const { container } = render(<AVPhotoSlider images={IMAGES} />);
    const rendered = slidesOf(container);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toHaveAttribute('src', IMAGES[0]);
  });

  it('advances to the next slide and mounts it lazily', () => {
    jest.useFakeTimers();
    try {
      const { container } = render(<AVPhotoSlider images={IMAGES} intervalMs={1000} />);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const rendered = slidesOf(container);
      expect(rendered).toHaveLength(2);
      expect(rendered[1]).toHaveAttribute('src', IMAGES[1]);
      expect(rendered[1]).toHaveAttribute('loading', 'lazy');
      // The second slide is the visible one now.
      expect(rendered[1].getAttribute('aria-hidden')).toBe('false');
      expect(rendered[0].getAttribute('aria-hidden')).toBe('true');
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps every slide mounted after a full cycle so the wrap can cross-fade', () => {
    jest.useFakeTimers();
    try {
      const { container } = render(<AVPhotoSlider images={IMAGES} intervalMs={1000} />);

      act(() => {
        jest.advanceTimersByTime(3000); // 0 -> 1 -> 2 -> back to 0
      });

      const rendered = slidesOf(container);
      expect(rendered).toHaveLength(IMAGES.length);
      expect(rendered[0].getAttribute('aria-hidden')).toBe('false');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not start a timer for a single slide', () => {
    jest.useFakeTimers();
    try {
      const { container } = render(<AVPhotoSlider images={['only.jpg']} intervalMs={1000} />);
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      const rendered = slidesOf(container);
      expect(rendered).toHaveLength(1);
      expect(rendered[0].getAttribute('aria-hidden')).toBe('false');
    } finally {
      jest.useRealTimers();
    }
  });

  it('stays in range when the configured slides shrink', () => {
    jest.useFakeTimers();
    const { container, rerender } = render(<AVPhotoSlider images={IMAGES} intervalMs={1000} />);
    try {
      act(() => {
        jest.advanceTimersByTime(2000); // now showing the third slide
      });

      rerender(<AVPhotoSlider images={[IMAGES[0]]} intervalMs={1000} />);

      const rendered = slidesOf(container);
      expect(rendered).toHaveLength(1);
      expect(rendered[0]).toHaveAttribute('src', IMAGES[0]);
      expect(rendered[0].getAttribute('aria-hidden')).toBe('false');
    } finally {
      jest.useRealTimers();
    }
  });

  it('passes the className through to the wrapper', () => {
    const { container } = render(<AVPhotoSlider images={IMAGES} className="mediaInTitle" />);
    expect(container.firstChild).toHaveClass('mediaInTitle');
  });
});
