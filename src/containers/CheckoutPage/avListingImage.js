/**
 * AV: aspect ratio for the checkout page's listing image.
 *
 * Both checkout images — MobileListingImage (single-column, below 768px) and
 * DetailsSideCard (the side card, from 768px up) — use this 4:3 box, matching
 * the listing page gallery, which gives any portrait photo a 4:3 box (see
 * MAX_PORTRAIT_ASPECT_RATIO in ListingImageGallery.js).
 *
 * Upstream instead took the ratio from the hosted `layoutListingImageConfig`,
 * which renders a 3:4 portrait box on both. The variant served here is still
 * the cropped `listing-card` one, so it fills the box via `object-fit: cover`
 * (see .rootForImage in CheckoutPage.module.css) rather than letterboxing —
 * the listing page letterboxes only because it serves an uncropped variant.
 */
export const AV_LISTING_IMAGE_ASPECT_WIDTH = 4;
export const AV_LISTING_IMAGE_ASPECT_HEIGHT = 3;
