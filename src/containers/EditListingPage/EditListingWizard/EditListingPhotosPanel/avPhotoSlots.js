import { useRef } from 'react';

/**
 * AV: the labeled-slot photo mode for the Edit Listing wizard.
 *
 * Instead of upstream's free-form image gallery, AV offers four fixed, labeled
 * slots and records which image landed in which slot under
 * `publicData.imageSlots`, so `ListingImageGallery` can caption them.
 *
 * Kept out of the upstream `EditListingPhotosPanel.js` so that file stays close to
 * `sharetribe/web-template` and merges cheaply. Slot mode is selected by
 * `photoMode: 'slots'` in `configListing.js`.
 */

export const SLOT_KEYS = ['front', 'back', 'horizontal', 'details'];

const imageUuid = image => image?.imageId?.uuid || image?.id?.uuid;

/**
 * Map each labeled slot back to its image, falling back to positional order for
 * older listings saved before `imageSlots` metadata existed.
 *
 * @param {Object} params
 * @param {Array} params.images
 * @param {Object} params.listing
 * @returns {Object} form initial values keyed `image_<slot>`
 */
export const getInitialValuesSlots = ({ images = [], listing }) => {
  const imageSlots = listing?.attributes?.publicData?.imageSlots || {};
  const hasSlotMapping = Object.keys(imageSlots).length > 0;
  const initialValues = {};

  if (hasSlotMapping) {
    SLOT_KEYS.forEach(slotKey => {
      const uuid = imageSlots[slotKey];
      const matchedImage = uuid ? images.find(img => imageUuid(img) === uuid) : null;
      if (matchedImage) {
        initialValues[`image_${slotKey}`] = matchedImage;
      }
    });
  } else {
    SLOT_KEYS.forEach((slotKey, index) => {
      if (images[index]) {
        initialValues[`image_${slotKey}`] = images[index];
      }
    });
  }

  return initialValues;
};

/**
 * Collect the ordered images and build the `publicData.imageSlots` mapping.
 *
 * @param {Object} values - form values keyed `image_<slot>`
 * @param {Function} onSubmit
 */
export const submitSlots = (values, onSubmit) => {
  const images = SLOT_KEYS.map(k => values[`image_${k}`]).filter(Boolean);
  const imageSlots = {};
  SLOT_KEYS.forEach(k => {
    const img = values[`image_${k}`];
    if (img) {
      imageSlots[k] = imageUuid(img);
    }
  });
  onSubmit({ images, publicData: { imageSlots } });
};

/**
 * Stabilize the slot-mode initial values so React Final Form never reinitializes.
 *
 * RFF compares `initialValues` by identity — handing it a fresh object each render
 * triggers a re-init, which resets fields managed through `form.change` back to
 * their initial values and breaks the upload-then-remove flow. Recompute only when
 * the listing itself changes.
 *
 * @param {Object} listing
 * @returns {Object} stable initial values
 */
export const useStableSlotInitialValues = listing => {
  const stableInitialValuesRef = useRef(null);
  const trackedListingIdRef = useRef(undefined);
  const currentListingId = listing?.id?.uuid;

  if (currentListingId !== trackedListingIdRef.current) {
    trackedListingIdRef.current = currentListingId;
    stableInitialValuesRef.current = getInitialValuesSlots({
      images: listing?.images || [],
      listing,
    });
  }

  return stableInitialValuesRef.current;
};
