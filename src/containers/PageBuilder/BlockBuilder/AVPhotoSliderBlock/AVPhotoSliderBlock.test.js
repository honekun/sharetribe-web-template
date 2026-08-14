import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render } from '../../../../util/testHelpers';

import AVPhotoSliderBlock from './AVPhotoSliderBlock';

const IMAGES = ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg'];

const mediaField = {
  fieldType: 'image',
  alt: 'Block media',
  image: {
    id: 'image-id',
    type: 'imageAsset',
    attributes: {
      variants: {
        square: { url: 'https://cdn.test/media.jpg', width: 400, height: 400 },
      },
    },
  },
};

describe('AVPhotoSliderBlock', () => {
  it('renders the configured slides in place of the media field', () => {
    const { container } = render(
      <AVPhotoSliderBlock blockId="b1" sliderImages={IMAGES} media={mediaField} />
    );

    const sources = Array.from(container.querySelectorAll('img')).map(img =>
      img.getAttribute('src')
    );
    expect(sources).toContain(IMAGES[0]);
    expect(sources).not.toContain('https://cdn.test/media.jpg');
  });

  it('falls back to the media field when no slide is configured', () => {
    const { container } = render(
      <AVPhotoSliderBlock blockId="b1" sliderImages={['', '', '', '']} media={mediaField} />
    );

    // ResponsiveImage renders a srcset rather than a src.
    expect(container.querySelector('img[srcset]')).toBeInTheDocument();
  });

  it('still renders the block text fields around the slider', () => {
    const { getByText } = render(
      <AVPhotoSliderBlock
        blockId="b1"
        sliderImages={IMAGES}
        title={{ fieldType: 'heading2', content: 'Slider block title' }}
      />
    );

    expect(getByText('Slider block title')).toBeInTheDocument();
  });
});
