import React from 'react';

import AVBlockDefaultView from '../AVBlockDefault/AVBlockDefaultView';
import AVPhotoSlider, { usableSlides } from './AVPhotoSlider';

/**
 * Block for the `photoSlider ::` block-name token: a default block whose media
 * is a cross-fading slider instead of the single media field.
 *
 * `AVBlockDefault` routes here through `resolveAvBlockComponent`, and the slide
 * URLs arrive as `sliderImages` from `createBlockCustomProps`. Everything else
 * (the title, text and CTA fields) is left to `AVBlockDefaultView` — the view,
 * not the dispatcher, or this block would re-route to itself forever.
 *
 * @component
 * @param {Object} props - block props, as passed by BlockBuilder
 * @param {Array<string>} [props.sliderImages] - slide URLs from microcopy
 * @returns {JSX.Element}
 */
const AVPhotoSliderBlock = props => {
  const { sliderImages, ...blockProps } = props;
  const slides = usableSlides(sliderImages);

  // With no slide configured, fall through to the block's own media field
  // rather than leaving a hole where the image should be.
  const mediaSlot = slides.length > 0 ? <AVPhotoSlider images={slides} /> : null;

  return <AVBlockDefaultView {...blockProps} mediaSlot={mediaSlot} />;
};

export default AVPhotoSliderBlock;
