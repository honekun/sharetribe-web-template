import { AV_LISTING_IMAGE_ASPECT_WIDTH, AV_LISTING_IMAGE_ASPECT_HEIGHT } from './avListingImage';

describe('avListingImage', () => {
  it('exports a 4:3 aspect ratio', () => {
    expect(AV_LISTING_IMAGE_ASPECT_WIDTH).toEqual(4);
    expect(AV_LISTING_IMAGE_ASPECT_HEIGHT).toEqual(3);
  });

  it('matches the listing page gallery MAX_PORTRAIT_ASPECT_RATIO (4/3)', () => {
    // ListingImageGallery gives any photo at or below 4/3 a 4:3 box; the
    // checkout images mirror that so both pages frame the photo identically.
    expect(AV_LISTING_IMAGE_ASPECT_WIDTH / AV_LISTING_IMAGE_ASPECT_HEIGHT).toEqual(4 / 3);
  });
});
