import { types as sdkTypes } from '../../util/sdkLoader';
import { updateListingThunk } from './EditListingPage.duck';

const { UUID } = sdkTypes;

const LISTING_ID = 'listing-uuid-1';
const PLACEHOLDER_IMAGE_ID = 'placeholder-image-uuid';

const config = {
  layout: { listingImage: { aspectWidth: 1, aspectHeight: 1, variantPrefix: 'listing-card' } },
  localization: { firstDayOfWeek: 1 },
};

// Minimal state holding the listing as it is stored today.
const makeGetState = publicData => () => ({
  marketplaceData: {
    entities: {
      ownListing: {
        [LISTING_ID]: { id: new UUID(LISTING_ID), attributes: { publicData } },
      },
    },
  },
});

const makeSdk = () => ({
  ownListings: {
    update: jest.fn().mockResolvedValue({
      data: { data: { id: new UUID(LISTING_ID), attributes: {} } },
    }),
  },
});

// The RTK thunk is called the way redux-thunk calls it: (dispatch, getState, extra).
const runUpdate = ({ publicData, data }) => {
  const sdk = makeSdk();
  const getState = makeGetState(publicData);
  const dispatch = jest.fn(actionOrFn =>
    typeof actionOrFn === 'function' ? actionOrFn(dispatch, getState, sdk) : actionOrFn
  );

  return updateListingThunk({ tab: 'details', data, config })(dispatch, getState, sdk).then(() => ({
    updateValues: sdk.ownListings.update.mock.calls[0][0],
  }));
};

describe('updateListingThunk — bulk-import placeholder flag', () => {
  const placeholderPublicData = {
    avPlaceholderImage: true,
    avPlaceholderImageId: PLACEHOLDER_IMAGE_ID,
    brand: 'zara',
  };

  it('clears the flag when the seller replaces the placeholder with real photos', async () => {
    const { updateValues } = await runUpdate({
      publicData: placeholderPublicData,
      data: {
        id: new UUID(LISTING_ID),
        images: [{ id: new UUID('real-1') }, { id: new UUID('real-2') }],
        publicData: { brand: 'zara' },
      },
    });

    expect(updateValues.publicData).toEqual({
      brand: 'zara',
      avPlaceholderImage: false,
      avPlaceholderImageId: null,
    });
  });

  it('keeps the flag while the placeholder image is still attached', async () => {
    const { updateValues } = await runUpdate({
      publicData: placeholderPublicData,
      data: {
        id: new UUID(LISTING_ID),
        images: [{ id: new UUID(PLACEHOLDER_IMAGE_ID) }, { id: new UUID('real-1') }],
        publicData: { brand: 'zara' },
      },
    });

    expect(updateValues.publicData).toEqual({ brand: 'zara' });
  });

  it('does not touch the flag when the submitted tab carries no images', async () => {
    const { updateValues } = await runUpdate({
      publicData: placeholderPublicData,
      data: { id: new UUID(LISTING_ID), price: 100 },
    });

    expect(updateValues.publicData).toBeUndefined();
  });

  it('survives an update made before the listing entity is in the store', async () => {
    // The flag check runs before the API call, so it cannot assume the entity has
    // already been normalised into marketplaceData.
    const sdk = makeSdk();
    const getState = () => ({ marketplaceData: { entities: {} } });
    const dispatch = jest.fn(actionOrFn =>
      typeof actionOrFn === 'function' ? actionOrFn(dispatch, getState, sdk) : actionOrFn
    );
    const data = {
      id: new UUID(LISTING_ID),
      images: [{ id: new UUID('real-1') }],
      publicData: { brand: 'zara' },
    };

    await updateListingThunk({ tab: 'details', data, config })(dispatch, getState, sdk);

    expect(sdk.ownListings.update).toHaveBeenCalledTimes(1);
    expect(sdk.ownListings.update.mock.calls[0][0].publicData).toEqual({ brand: 'zara' });
  });

  it('leaves a listing that was never flagged untouched', async () => {
    const { updateValues } = await runUpdate({
      publicData: { brand: 'zara' },
      data: {
        id: new UUID(LISTING_ID),
        images: [{ id: new UUID('real-1') }],
        publicData: { brand: 'zara' },
      },
    });

    expect(updateValues.publicData).toEqual({ brand: 'zara' });
  });
});
