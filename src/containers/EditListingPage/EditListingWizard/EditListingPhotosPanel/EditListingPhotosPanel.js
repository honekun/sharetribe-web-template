import React, { useRef } from 'react';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage } from '../../../../util/reactIntl';
import { LISTING_STATE_DRAFT } from '../../../../util/types';

// Import shared components
import { H3, ListingLink } from '../../../../components';

// Import modules from this directory
import EditListingPhotosForm from './EditListingPhotosForm';
import css from './EditListingPhotosPanel.module.css';

const SLOT_KEYS = ['front', 'back', 'horizontal', 'details'];

const getInitialValues = params => {
  const { images = [], listing } = params;
  const publicData = listing?.attributes?.publicData || {};
  const imageSlots = publicData.imageSlots || {};

  const initialValues = {};

  // Try to populate slots from imageSlots mapping first
  const hasSlotMapping = Object.keys(imageSlots).length > 0;

  if (hasSlotMapping) {
    SLOT_KEYS.forEach(slotKey => {
      const imageUuid = imageSlots[slotKey];
      if (imageUuid) {
        const matchedImage = images.find(img => {
          const uuid = img?.imageId?.uuid || img?.id?.uuid;
          return uuid === imageUuid;
        });
        if (matchedImage) {
          initialValues[`image_${slotKey}`] = matchedImage;
        }
      }
    });
  } else {
    // Positional fallback for existing listings without imageSlots
    SLOT_KEYS.forEach((slotKey, index) => {
      if (images[index]) {
        initialValues[`image_${slotKey}`] = images[index];
      }
    });
  }

  return initialValues;
};

const EditListingPhotosPanel = props => {
  const {
    className,
    rootClassName,
    errors,
    disabled,
    ready,
    listing,
    onImageUpload,
    submitButtonText,
    panelUpdated,
    updateInProgress,
    onSubmit,
    onRemoveImage,
    listingImageConfig,
    updatePageTitle: UpdatePageTitle,
    intl,
  } = props;

  // Stabilize initialValues so React Final Form never reinitializes.
  // RFF uses reference equality (===) on initialValues — a new object every render triggers
  // reinitialization, which resets unregistered form fields (managed via form.change) back to
  // initialValues, breaking both remove and upload-then-remove flows.
  // We recompute only when the listing ID changes (different listing or first mount).
  const stableInitialValuesRef = useRef(null);
  const trackedListingIdRef = useRef(undefined);
  const currentListingId = listing?.id?.uuid;
  if (currentListingId !== trackedListingIdRef.current) {
    trackedListingIdRef.current = currentListingId;
    stableInitialValuesRef.current = getInitialValues({ images: listing?.images || [], listing });
  }

  const rootClass = rootClassName || css.root;
  const classes = classNames(rootClass, className);
  const isPublished = listing?.id && listing?.attributes?.state !== LISTING_STATE_DRAFT;

  const panelHeadingProps = isPublished
    ? {
        id: 'EditListingPhotosPanel.title',
        values: { listingTitle: <ListingLink listing={listing} />, lineBreak: <br /> },
        messageProps: { listingTitle: listing.attributes.title },
      }
    : {
        id: 'EditListingPhotosPanel.createListingTitle',
        values: { lineBreak: <br /> },
        messageProps: {},
      };

  return (
    <main className={classes}>
      <UpdatePageTitle
        panelHeading={intl.formatMessage(
          { id: panelHeadingProps.id },
          { ...panelHeadingProps.messageProps }
        )}
      />
      <H3 as="h1">
        <FormattedMessage id={panelHeadingProps.id} values={{ ...panelHeadingProps.values }} />
      </H3>
      <EditListingPhotosForm
        className={css.form}
        disabled={disabled}
        ready={ready}
        fetchErrors={errors}
        images={props.images}
        initialValues={stableInitialValuesRef.current}
        onImageUpload={onImageUpload}
        onSubmit={values => {
          // Collect slot images into ordered images array
          const images = SLOT_KEYS.map(k => values[`image_${k}`]).filter(Boolean);

          // Build imageSlots publicData mapping
          const imageSlots = {};
          SLOT_KEYS.forEach(k => {
            const img = values[`image_${k}`];
            if (img) {
              imageSlots[k] = img.imageId?.uuid || img.id?.uuid;
            }
          });

          onSubmit({ images, publicData: { imageSlots } });
        }}
        onRemoveImage={onRemoveImage}
        saveActionMsg={submitButtonText}
        updated={panelUpdated}
        updateInProgress={updateInProgress}
        listingImageConfig={listingImageConfig}
      />
    </main>
  );
};

export default EditListingPhotosPanel;
