import React, { useState, useRef, useEffect } from 'react';
import { Form as FinalForm } from 'react-final-form';
import isEqual from 'lodash/isEqual';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { isUploadImageOverLimitError } from '../../../../util/errors';

// Import shared components
import { Button, Form } from '../../../../components';

// Import modules from this directory
import ImageSlot from './ImageSlot';
import css from './EditListingPhotosForm.module.css';

const SLOT_KEYS = ['front', 'back', 'horizontal', 'details'];

const ImageUploadError = props => {
  return props.uploadOverLimit ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.imageUploadFailed.uploadOverLimit" />
    </p>
  ) : props.uploadImageError ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.imageUploadFailed.uploadFailed" />
    </p>
  ) : null;
};

const PublishListingError = props => {
  return props.error ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.publishListingFailed" />
    </p>
  ) : null;
};

const ShowListingsError = props => {
  return props.error ? (
    <p className={css.error}>
      <FormattedMessage id="EditListingPhotosForm.showListingFailed" />
    </p>
  ) : null;
};

// Inner component that has access to FinalForm's form API via render props
const PhotosFormContent = props => {
  const {
    form,
    className,
    fetchErrors,
    handleSubmit,
    invalid,
    onRemoveImage,
    disabled,
    ready,
    saveActionMsg,
    updated,
    updateInProgress,
    values,
    listingImageConfig,
    allImages,
    onImageUploadHandler,
    imageUploadRequested,
    pendingUploadRef,
  } = props;

  const intl = useIntl();
  const [submittedImages, setSubmittedImages] = useState([]);

  const { aspectWidth = 1, aspectHeight = 1, variantPrefix } = listingImageConfig;

  // When a new image appears in allImages and we have a pending slot, assign it
  useEffect(() => {
    const pending = pendingUploadRef.current;
    if (pending && pending.tempId && allImages) {
      const newImage = allImages.find(img => img.id === pending.tempId);
      if (newImage) {
        form.change(`image_${pending.slotKey}`, newImage);
        pendingUploadRef.current = null;
      }
    }
  }, [allImages, form]);

  const { publishListingError, showListingsError, updateListingError, uploadImageError } =
    fetchErrors || {};
  const uploadOverLimit = isUploadImageOverLimitError(uploadImageError);

  const currentSlotImages = SLOT_KEYS.map(k => values[`image_${k}`]).filter(Boolean);
  const arrayOfImgIds = imgs => imgs?.map(i => (typeof i.id === 'string' ? i.imageId : i.id));
  const imageIdsFromCurrent = arrayOfImgIds(currentSlotImages);
  const imageIdsFromPreviousSubmit = arrayOfImgIds(submittedImages);
  const imageArrayHasSameImages = isEqual(imageIdsFromCurrent, imageIdsFromPreviousSubmit);
  const submittedOnce = submittedImages.length > 0;
  const pristineSinceLastSubmit = submittedOnce && imageArrayHasSameImages;

  const hasFrontImage = !!values.image_front;
  const frontImageRequired = !hasFrontImage;

  const submitReady = (updated && pristineSinceLastSubmit) || ready;
  const submitInProgress = updateInProgress;
  const submitDisabled =
    invalid ||
    disabled ||
    submitInProgress ||
    imageUploadRequested ||
    ready ||
    frontImageRequired;

  const classes = classNames(css.root, className);

  return (
    <Form
      className={classes}
      onSubmit={e => {
        const slotImages = SLOT_KEYS.map(k => values[`image_${k}`]).filter(Boolean);
        setSubmittedImages(slotImages);
        handleSubmit(e);
      }}
    >
      {updateListingError ? (
        <p className={css.error}>
          <FormattedMessage id="EditListingPhotosForm.updateFailed" />
        </p>
      ) : null}

      <div className={css.imageSlotsGrid}>
        {SLOT_KEYS.map(slotKey => (
          <ImageSlot
            key={slotKey}
            slotKey={slotKey}
            label={intl.formatMessage({
              id: `EditListingPhotosForm.slotLabel.${slotKey}`,
            })}
            image={values[`image_${slotKey}`]}
            onImageUpload={(file, key) => {
              onImageUploadHandler(file, key);
            }}
            onRemoveImage={key => {
              const img = values[`image_${key}`];
              if (img) {
                form.change(`image_${key}`, null);
                onRemoveImage(img?.id);
              }
            }}
            aspectWidth={aspectWidth}
            aspectHeight={aspectHeight}
            variantPrefix={variantPrefix}
            disabled={imageUploadRequested}
            isRequired={slotKey === 'front'}
          />
        ))}
      </div>

      {frontImageRequired ? (
        <div className={css.arrayError}>
          {intl.formatMessage({ id: 'EditListingPhotosForm.frontImageRequired' })}
        </div>
      ) : null}

      <ImageUploadError
        uploadOverLimit={uploadOverLimit}
        uploadImageError={uploadImageError}
      />

      <p className={css.tip}>
        <FormattedMessage id="EditListingPhotosForm.addImagesTip" />
      </p>

      <PublishListingError error={publishListingError} />
      <ShowListingsError error={showListingsError} />

      <Button
        className={css.submitButton}
        type="submit"
        inProgress={submitInProgress}
        disabled={submitDisabled}
        ready={submitReady}
      >
        {saveActionMsg}
      </Button>
    </Form>
  );
};

export const EditListingPhotosForm = props => {
  const [imageUploadRequested, setImageUploadRequested] = useState(false);
  const pendingUploadRef = useRef(null);

  const onImageUploadHandler = (file, slotKey) => {
    const { listingImageConfig, onImageUpload } = props;
    if (file) {
      setImageUploadRequested(true);
      const tempId = `${file.name}_${Date.now()}`;
      pendingUploadRef.current = { slotKey, tempId };

      onImageUpload({ id: tempId, file }, listingImageConfig)
        .then(() => {
          setImageUploadRequested(false);
        })
        .catch(() => {
          setImageUploadRequested(false);
          pendingUploadRef.current = null;
        });
    }
  };

  return (
    <FinalForm
      {...props}
      render={formRenderProps => {
        return (
          <PhotosFormContent
            {...formRenderProps}
            allImages={props.images}
            onImageUploadHandler={onImageUploadHandler}
            imageUploadRequested={imageUploadRequested}
            pendingUploadRef={pendingUploadRef}
          />
        );
      }}
    />
  );
};

export default EditListingPhotosForm;
