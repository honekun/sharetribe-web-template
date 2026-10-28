import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import AVListingImageGallery from './AVListingImageGallery';

const { screen, waitFor } = testingLibrary;

jest.mock('./ListingImageGallery', () => props => (
  <div data-testid="upstream-gallery" data-thumbnail-position={props.thumbnailPosition} />
));

const setViewportWide = matches => {
  window.matchMedia = jest.fn(() => ({
    matches,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
};

describe('AVListingImageGallery', () => {
  it('falls vertical thumbnails back to the bottom on small screens', () => {
    setViewportWide(false);
    render(<AVListingImageGallery thumbnailPosition="left" />);

    expect(screen.getByTestId('upstream-gallery')).toHaveAttribute(
      'data-thumbnail-position',
      'bottom'
    );
  });

  it('uses vertical thumbnails from the medium breakpoint', async () => {
    setViewportWide(true);
    render(<AVListingImageGallery thumbnailPosition="left" />);

    await waitFor(() =>
      expect(screen.getByTestId('upstream-gallery')).toHaveAttribute(
        'data-thumbnail-position',
        'left'
      )
    );
  });
});
