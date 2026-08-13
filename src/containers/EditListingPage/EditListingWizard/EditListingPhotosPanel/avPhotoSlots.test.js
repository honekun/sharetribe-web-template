import { SLOT_KEYS, getInitialValuesSlots, submitSlots } from './avPhotoSlots';

const img = uuid => ({ id: { uuid }, type: 'image' });

describe('getInitialValuesSlots', () => {
  it('maps each slot back to its recorded image', () => {
    const images = [img('a'), img('b'), img('c')];
    const listing = {
      attributes: { publicData: { imageSlots: { front: 'c', details: 'a' } } },
    };
    expect(getInitialValuesSlots({ images, listing })).toEqual({
      image_front: images[2],
      image_details: images[0],
    });
  });

  it('falls back to positional order for listings saved before imageSlots existed', () => {
    const images = [img('a'), img('b')];
    expect(getInitialValuesSlots({ images, listing: { attributes: { publicData: {} } } })).toEqual({
      image_front: images[0],
      image_back: images[1],
    });
  });

  it('skips slots whose recorded image is gone', () => {
    const listing = { attributes: { publicData: { imageSlots: { front: 'missing' } } } };
    expect(getInitialValuesSlots({ images: [img('a')], listing })).toEqual({});
  });

  it('handles an empty listing', () => {
    expect(getInitialValuesSlots({ images: [], listing: undefined })).toEqual({});
  });
});

describe('submitSlots', () => {
  it('submits ordered images plus the slot mapping', () => {
    const onSubmit = jest.fn();
    const front = img('a');
    const details = img('d');
    submitSlots({ image_front: front, image_details: details }, onSubmit);
    expect(onSubmit).toHaveBeenCalledWith({
      images: [front, details],
      publicData: { imageSlots: { front: 'a', details: 'd' } },
    });
  });

  it('keeps images in SLOT_KEYS order regardless of value order', () => {
    const onSubmit = jest.fn();
    submitSlots({ image_details: img('d'), image_front: img('a') }, onSubmit);
    expect(onSubmit.mock.calls[0][0].images.map(i => i.id.uuid)).toEqual(['a', 'd']);
    expect(SLOT_KEYS[0]).toBe('front');
  });

  it('submits empty collections when no slot is filled', () => {
    const onSubmit = jest.fn();
    submitSlots({}, onSubmit);
    expect(onSubmit).toHaveBeenCalledWith({ images: [], publicData: { imageSlots: {} } });
  });

  it('reads the uploaded-image imageId shape as well as id', () => {
    const onSubmit = jest.fn();
    submitSlots({ image_front: { imageId: { uuid: 'u1' } } }, onSubmit);
    expect(onSubmit.mock.calls[0][0].publicData.imageSlots).toEqual({ front: 'u1' });
  });
});
