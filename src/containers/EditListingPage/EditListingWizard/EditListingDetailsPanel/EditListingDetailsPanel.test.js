import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingDetailsPanel from './EditListingDetailsPanel';

const { screen, userEvent, waitFor } = testingLibrary;

const noop = () => null;
const SAVE_LABEL = 'Save details';

const listingTypeConfig = {
  listingType: 'sell-bicycles',
  transactionType: {
    process: 'default-purchase',
    alias: 'default-purchase/release-1',
    unitType: 'item',
  },
  // Images are required unless this is explicitly false, which is what puts the
  // photo gallery in the Details panel.
  defaultListingFields: { images: true },
};

const config = {
  currency: 'MXN',
  marketplaceName: 'Archivo Vintach',
  listing: { listingTypes: [listingTypeConfig], listingFields: [] },
  categoryConfiguration: { key: 'categoryLevel', categories: [] },
};

const uploadedImage = id => ({
  id: { uuid: id },
  imageId: { uuid: id },
  type: 'image',
  attributes: {
    variants: {
      'listing-card': { url: `https://cdn.test/${id}.jpg`, width: 400, height: 400 },
    },
  },
});

// An image still being uploaded has a local file and no imageId yet.
const pendingImage = id => ({ id, file: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }) });

const listing = {
  id: { uuid: 'listing-id' },
  attributes: {
    state: 'draft',
    title: 'The listing',
    description: 'Lorem ipsum',
    publicData: {
      listingType: 'sell-bicycles',
      transactionProcessAlias: 'default-purchase/release-1',
      unitType: 'item',
    },
  },
};

const renderPanel = (props = {}) =>
  render(
    <EditListingDetailsPanel
      intl={fakeIntl}
      config={config}
      listing={listing}
      params={{ id: 'listing-id', slug: 'slug', type: 'edit' }}
      onSubmit={noop}
      onListingTypeChange={noop}
      onImageUpload={noop}
      onRemoveImage={noop}
      listingImageConfig={{ aspectWidth: 1, aspectHeight: 1, variantPrefix: 'listing-card' }}
      submitButtonText={SAVE_LABEL}
      updatePageTitle={() => null}
      panelUpdated={false}
      updateInProgress={false}
      disabled={false}
      ready={false}
      errors={{}}
      {...props}
    />
  );

const submit = async user => {
  const button = screen.getByRole('button', { name: SAVE_LABEL });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
};

describe('EditListingDetailsPanel photo requirements', () => {
  it('blocks submission with fewer than three photos', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    renderPanel({ images: [uploadedImage('a'), uploadedImage('b')], onSubmit });

    await submit(user);

    expect(screen.getByText('EditListingDetailsPanel.photosMinRequired')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission while a photo is still uploading', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    renderPanel({
      images: [uploadedImage('a'), uploadedImage('b'), pendingImage('pending')],
      onSubmit,
    });

    await submit(user);

    expect(screen.getByText('EditListingDetailsPanel.photosUploadInProgress')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the photos along with the details once three are uploaded', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const images = [uploadedImage('a'), uploadedImage('b'), uploadedImage('c')];
    renderPanel({ images, onSubmit });

    await submit(user);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.images.map(img => img.id.uuid)).toEqual(['a', 'b', 'c']);
    expect(submitted.title).toBe('The listing');
    expect(screen.queryByText('EditListingDetailsPanel.photosMinRequired')).not.toBeInTheDocument();
  });

  it('hides the gallery when the listing type does not require images', () => {
    const noImageConfig = {
      ...config,
      listing: {
        ...config.listing,
        listingTypes: [{ ...listingTypeConfig, defaultListingFields: { images: false } }],
      },
    };
    renderPanel({ images: [], config: noImageConfig });

    expect(screen.queryByText('EditListingDetailsPanel.photosTitle')).not.toBeInTheDocument();
  });
});
