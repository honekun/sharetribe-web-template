import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render } from '../../../../util/testHelpers';

import EditListingPhotosForm from './EditListingPhotosForm';

const noop = () => null;

describe('EditListingPhotosForm', () => {
  it('matches snapshot', () => {
    const saveActionMsg = 'Save photos';
    const tree = render(
      <EditListingPhotosForm
        initialValues={{ country: 'US' }}
        intl={fakeIntl}
        dispatch={noop}
        images={[]}
        onImageUpload={v => Promise.reject(v)}
        onSubmit={v => v}
        saveActionMsg={saveActionMsg}
        stripeConnected={false}
        updated={false}
        ready={false}
        updateInProgress={false}
        disabled={false}
        onRemoveImage={noop}
        listingImageConfig={{ aspectWidth: 1, aspectHeight: 1, variantPrefix: 'listing-card' }}
      />
    );
    expect(tree.asFragment()).toMatchSnapshot();
  });
});
