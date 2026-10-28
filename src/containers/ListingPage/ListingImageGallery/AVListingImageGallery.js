import React, { useEffect, useState } from 'react';

import ListingImageGallery from './ListingImageGallery';

// AV-only react-image-gallery overrides. Keeping this import here lets the
// upstream gallery component remain otherwise pristine apart from its narrow
// thumbnailPosition pass-through seam.
import './ListingImageGalleryAV.module.css';

const VIEWPORT_MEDIUM_QUERY = '(min-width: 768px)';

const useResponsiveThumbnailPosition = requested => {
  const isVertical = requested === 'left' || requested === 'right';
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(VIEWPORT_MEDIUM_QUERY);
    const update = () => setIsWide(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return isVertical && !isWide ? 'bottom' : requested;
};

/**
 * AV adapter for the upstream gallery. It owns the responsive vertical-thumbnail
 * behavior and AV CSS while delegating image rendering, lazy mounting, memoization,
 * fetch priority, responsive sizing, and CLS reservation to upstream.
 */
const AVListingImageGallery = props => {
  const { thumbnailPosition = 'bottom', ...rest } = props;
  const effectiveThumbnailPosition = useResponsiveThumbnailPosition(thumbnailPosition);

  return <ListingImageGallery {...rest} thumbnailPosition={effectiveThumbnailPosition} />;
};

export default AVListingImageGallery;
