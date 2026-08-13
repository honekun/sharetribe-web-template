import React from 'react';

import BlockDefault from '../BlockDefault/BlockDefault';
import AVPhotoSlider, { usableSlides } from './AVPhotoSlider';

/**
 * Block for the `photoSlider ::` block-name token: a default block whose media
 * is a cross-fading slider instead of the single media field.
 *
 * BlockBuilder routes here through `getEffectiveBlockType`, and the slide URLs
 * arrive as `sliderImages` from `createBlockCustomProps`. Everything else (the
 * title, text and CTA fields) is left to BlockDefault, so a slider block styles
 * and behaves exactly like any other block.
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

  return <BlockDefault {...blockProps} mediaSlot={mediaSlot} />;
};

export default AVPhotoSliderBlock;
