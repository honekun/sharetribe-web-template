import React from 'react';
import '@testing-library/jest-dom';
import { Form as FinalForm } from 'react-final-form';

import { fakeIntl } from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import MxAddressFields from './MxAddressFields';

const { screen } = testingLibrary;

const renderFields = (props = {}) =>
  render(
    <FinalForm
      onSubmit={() => {}}
      render={({ handleSubmit, form }) => (
        <form onSubmit={handleSubmit}>
          <MxAddressFields intl={fakeIntl} formApi={form} fieldId="address" {...props} />
        </form>
      )}
    />
  );

describe('MxAddressFields', () => {
  it('matches snapshot', () => {
    const { asFragment } = renderFields();
    expect(asFragment().firstChild).toMatchSnapshot();
  });

  it('uses the recipient prefix and shipping autocomplete tokens by default', () => {
    const { container } = renderFields();
    expect(container.querySelector('input[name="recipientAddressLine1"]')).toHaveAttribute(
      'autocomplete',
      'shipping address-line1'
    );
    expect(container.querySelector('select[name="recipientState"]')).toBeInTheDocument();
  });

  it('switches names and autocomplete tokens to billing with the billing prefix', () => {
    const { container } = renderFields({ fieldPrefix: 'billing' });
    expect(container.querySelector('input[name="billingPostal"]')).toHaveAttribute(
      'autocomplete',
      'billing postal-code'
    );
    expect(container.querySelector('[name^="recipient"]')).toBeNull();
  });

  it('can hide the heading and the phone field', () => {
    const { container } = renderFields({ showHeading: false, showPhone: false });
    expect(screen.queryByText('ShippingDetails.mxTitle')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="recipientPhoneNumber"]')).toBeNull();
  });

  it('lists the Mexican states after a disabled placeholder', () => {
    const { container } = renderFields();
    const options = container.querySelectorAll('select[name="recipientState"] option');
    expect(options[0]).toBeDisabled();
    expect(options.length).toBeGreaterThan(30);
  });
});
