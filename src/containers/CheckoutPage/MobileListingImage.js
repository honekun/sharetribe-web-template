import React from 'react';
import classNames from 'classnames';

import { AspectRatioWrapper, AvatarMedium, ResponsiveImage } from '../../components';

import { AV_LISTING_IMAGE_ASPECT_WIDTH, AV_LISTING_IMAGE_ASPECT_HEIGHT } from './avListingImage';
import css from './CheckoutPage.module.css';

const MobileListingImage = props => {
  const { listingTitle, author, firstImage, layoutListingImageConfig, showListingImage } = props;

  const { variantPrefix = 'listing-card' } = layoutListingImageConfig || {};
  const variants = firstImage
    ? Object.keys(firstImage?.attributes?.variants).filter(k => k.startsWith(variantPrefix))
    : [];

  return (
    <>
      {showListingImage && (
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
          />
        </AspectRatioWrapper>
      )}
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
