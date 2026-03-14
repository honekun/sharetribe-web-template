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
            <span className={css.uploadText}>+</span>
          </label>
        </AspectRatioWrapper>
      </div>
      <p className={labelClass}>{label}</p>
    </div>
  );
};

export default ImageSlot;
