import React from 'react';
import { useIntl } from '../../../../util/reactIntl';
import { AspectRatioWrapper } from '../../../../components';

import ListingImage from './ListingImage';
import css from './ImageSlot.module.css';

const ACCEPT_IMAGES = 'image/*';

const ImageSlot = props => {
  const {
    slotKey,
    label,
    image,
    onImageUpload,
    onRemoveImage,
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix,
    disabled,
    isRequired,
  } = props;
  const intl = useIntl();
  const inputId = `addImage_${slotKey}`;

  const handleChange = e => {
    const file = e.target.files[0];
    if (file) {
      onImageUpload(file, slotKey);
    }
  };

  const labelClass = isRequired ? css.required : css.slotLabel;

  if (image) {
    return (
      <div className={css.root}>
        <ListingImage
          image={image}
          className={css.thumbnail}
          savedImageAltText={intl.formatMessage(
            { id: 'EditListingPhotosForm.savedImageAltText' }
          )}
          onRemoveImage={() => onRemoveImage(slotKey)}
          aspectWidth={aspectWidth}
          aspectHeight={aspectHeight}
          variantPrefix={variantPrefix}
        />
        <p className={labelClass}>{label}</p>
      </div>
    );
  }

  return (
    <div className={css.root}>
      <div className={css.slotWrapper}>
        <AspectRatioWrapper width={aspectWidth} height={aspectHeight}>
          {!disabled && (
            <input
              id={inputId}
              name={inputId}
              type="file"
              accept={ACCEPT_IMAGES}
              onChange={handleChange}
              className={css.fileInput}
            />
          )}
          <label htmlFor={inputId} className={css.uploadArea}>
            <svg className={css.cameraIcon} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="2" />
              <path
                d="M19.5 17l-1.2 1.6A1 1 0 0117.5 19H15a1 1 0 00-1 1v10a1 1 0 001 1h18a1 1 0 001-1V20a1 1 0 00-1-1h-2.5a1 1 0 01-.8-.4L28.5 17a1 1 0 00-.8-.4h-7.4a1 1 0 00-.8.4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="25" r="4" stroke="currentColor" strokeWidth="1.5" />
              <line x1="24" y1="21" x2="24" y2="17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="22" y1="19.25" x2="26" y2="19.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className={css.uploadLabel}>{label}</span>
          </label>
        </AspectRatioWrapper>
      </div>
    </div>
  );
};

export default ImageSlot;
