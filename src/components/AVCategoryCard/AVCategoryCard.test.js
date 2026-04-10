import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import AVCategoryCard from './AVCategoryCard';

const { screen } = testingLibrary;

const mockMedia = {
  fieldType: 'image',
  alt: 'Blazers category',
  image: {
    attributes: {
      variants: {
        'scaled-medium': { url: 'https://example.com/blazers-medium.jpg', width: 750, height: 1000 },
        original: { url: 'https://example.com/blazers.jpg', width: 1200, height: 1600 },
      },
    },
  },
};

describe('AVCategoryCard', () => {
  it('renders with category name from media alt and links to search page', () => {
    render(<AVCategoryCard categoryId="blazers" media={mockMedia} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('pub_categoryLevel1=blazers'));

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/blazers-medium.jpg');
    expect(img).toHaveAttribute('alt', 'Blazers category');
  });

  it('uses explicit name prop over formatted blockName', () => {
    render(<AVCategoryCard categoryId="dress-party" name="Party Dresses" media={mockMedia} />);
    expect(screen.getByText('Party Dresses')).toBeInTheDocument();
  });

  it('formats categoryId as display name when no name or alt provided', () => {
    render(<AVCategoryCard categoryId="dress-party" />);
    expect(screen.getByText('Dress Party')).toBeInTheDocument();
  });

  it('renders placeholder div when no media provided', () => {
    const { container } = render(<AVCategoryCard categoryId="blazers" />);
    // no img element — placeholder div renders instead
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.imagePlaceholder')).not.toBeNull();
  });

  it('uses scaled-medium variant url in preference to original', () => {
    render(<AVCategoryCard categoryId="blazers" media={mockMedia} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/blazers-medium.jpg');
  });

  it('falls back to original variant when scaled-medium is absent', () => {
    const mediaWithoutMedium = {
      ...mockMedia,
      image: {
        attributes: {
          variants: {
            original: { url: 'https://example.com/blazers.jpg' },
          },
        },
      },
    };
    render(<AVCategoryCard categoryId="blazers" media={mediaWithoutMedium} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/blazers.jpg');
  });

  it('matches snapshot', () => {
    const { asFragment } = render(
      <AVCategoryCard categoryId="blazers" name="Blazers" media={mockMedia} />
    );
    expect(asFragment().firstChild).toMatchSnapshot();
  });
});
