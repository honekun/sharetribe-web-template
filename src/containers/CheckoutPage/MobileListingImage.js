import React from 'react';
import classNames from 'classnames';

import { AspectRatioWrapper, AvatarMedium, ResponsiveImage } from '../../components';

import { AV_LISTING_IMAGE_ASPECT_WIDTH, AV_LISTING_IMAGE_ASPECT_HEIGHT } from './avListingImage';
import css from './CheckoutPage.module.css';

// Matches below --viewportLarge in src/styles/customMediaQueries.css
const MAX_MOBILE_SCREEN_WIDTH = 1023;

const MobileListingImage = props => {
  const { listingTitle, author, firstImage, layoutListingImageConfig, showListingImage } = props;

  const { variantPrefix = 'listing-card' } = layoutListingImageConfig || {};
  const variants = firstImage
    ? Object.keys(firstImage?.attributes?.variants).filter(k => k.startsWith(variantPrefix))
    : [];

  // Mobile-only image: skip mount from --viewportLarge up so srcset is not fetched while
  // listingImageMobile is display:none.
  const hasMatchMedia = typeof window !== 'undefined' && !!window?.matchMedia;
  const isVisible = hasMatchMedia
    ? window.matchMedia(`(max-width: ${MAX_MOBILE_SCREEN_WIDTH}px)`)?.matches
    : true;

  return (
    <>
      {showListingImage && isVisible ? (
        <AspectRatioWrapper
          width={AV_LISTING_IMAGE_ASPECT_WIDTH}
          height={AV_LISTING_IMAGE_ASPECT_HEIGHT}
          className={css.listingImageMobile}
        >
          <ResponsiveImage
            rootClassName={css.rootForImage}
            alt={listingTitle}
            image={firstImage}
            variants={variants}
            sizes="100vw"
          />
        </AspectRatioWrapper>
      ) : null}
      <div
        className={classNames(css.avatarWrapper, css.avatarMobile, {
          [css.noListingImage]: !showListingImage,
        })}
      >
        <AvatarMedium user={author} disableProfileLink />
      </div>
    </>
  );
};

export default MobileListingImage;
