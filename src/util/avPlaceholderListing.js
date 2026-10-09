/**
 * AV: lifecycle of the bulk-import placeholder flag.
 *
 * Listings imported without photos are published with a bundled placeholder image
 * and stamped `publicData.avPlaceholderImage: true` plus `avPlaceholderImageId`
 * (the placeholder's image UUID) — see `server/api/bulk-import/importWorker.js`.
 * The flag is indexed as a search schema (`flex-cli search set --key
 * avPlaceholderImage --scope public --type boolean`) so listings still awaiting
 * real photos can be found with `pub_avPlaceholderImage=true`. It is deliberately
 * NOT a listing field: nobody edits it by hand, in Console or in the wizard.
 *
 * Keeping it true forever would make that query worthless, so it is cleared here
 * the moment the placeholder image leaves the listing.
 */

const idString = id => (id && typeof id === 'object' ? id.uuid : id);

/**
 * Decide whether a listing update should clear the placeholder flag.
 *
 * @param {object} params
 * @param {object} [params.existingPublicData] - publicData of the listing as stored today.
 * @param {Array|null} [params.imageIds] - image ids the update submits (UUID instances
 *   or strings). Null/undefined means the update carries no images at all — saving a
 *   non-photo tab must never touch the flag.
 * @returns {object|null} publicData patch to merge into the update, or null to leave
 *   the listing alone.
 */
export const clearPlaceholderFlagMaybe = ({ existingPublicData, imageIds } = {}) => {
  if (existingPublicData?.avPlaceholderImage !== true) return null;
  if (!Array.isArray(imageIds)) return null;

  const placeholderId = existingPublicData.avPlaceholderImageId;
  // Listings flagged before the id was recorded can't be compared, so a photo edit
  // is taken at face value.
  const placeholderStillAttached =
    !!placeholderId && imageIds.some(id => idString(id) === placeholderId);
  if (placeholderStillAttached) return null;

  return { avPlaceholderImage: false, avPlaceholderImageId: null };
};
