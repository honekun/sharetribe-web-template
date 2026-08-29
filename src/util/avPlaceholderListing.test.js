import { types as sdkTypes } from './sdkLoader';
import { clearPlaceholderFlagMaybe } from './avPlaceholderListing';

const { UUID } = sdkTypes;

const PLACEHOLDER_ID = 'placeholder-image-uuid';

const flagged = (overrides = {}) => ({
  avPlaceholderImage: true,
  avPlaceholderImageId: PLACEHOLDER_ID,
  ...overrides,
});

describe('clearPlaceholderFlagMaybe', () => {
  it('clears the flag once the placeholder image is no longer among the listing images', () => {
    const result = clearPlaceholderFlagMaybe({
      existingPublicData: flagged(),
      imageIds: ['real-photo-1', 'real-photo-2', 'real-photo-3'],
    });

    expect(result).toEqual({ avPlaceholderImage: false, avPlaceholderImageId: null });
  });

  it('recognises the placeholder when image ids arrive as SDK UUID instances', () => {
    const result = clearPlaceholderFlagMaybe({
      existingPublicData: flagged(),
      imageIds: [new UUID(PLACEHOLDER_ID), new UUID('real-photo-1')],
    });

    expect(result).toBeNull();
  });

  it('keeps the flag while the placeholder is still one of the listing images', () => {
    const result = clearPlaceholderFlagMaybe({
      existingPublicData: flagged(),
      imageIds: [PLACEHOLDER_ID, 'real-photo-1'],
    });

    expect(result).toBeNull();
  });

  it('leaves a listing that was never flagged untouched', () => {
    const result = clearPlaceholderFlagMaybe({
      existingPublicData: { brand: 'zara' },
      imageIds: ['real-photo-1'],
    });

    expect(result).toBeNull();
  });

  it('leaves the flag alone when the update submits no images at all', () => {
    // Saving a non-photo tab (pricing, delivery, …) must not touch the flag.
    expect(clearPlaceholderFlagMaybe({ existingPublicData: flagged(), imageIds: null })).toBeNull();
    expect(
      clearPlaceholderFlagMaybe({ existingPublicData: flagged(), imageIds: undefined })
    ).toBeNull();
  });

  it('clears a flagged listing that stored no placeholder image id', () => {
    // Nothing to compare against, so a photo edit is taken at face value.
    const result = clearPlaceholderFlagMaybe({
      existingPublicData: { avPlaceholderImage: true },
      imageIds: ['real-photo-1'],
    });

    expect(result).toEqual({ avPlaceholderImage: false, avPlaceholderImageId: null });
  });

  it('tolerates a missing publicData', () => {
    expect(clearPlaceholderFlagMaybe({ imageIds: ['real-photo-1'] })).toBeNull();
  });
});
