import React from 'react';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import '@testing-library/jest-dom';

import PaymentMethodsForm from './PaymentMethodsForm';

const { screen } = testingLibrary;
const noop = () => null;

describe('PaymentMethodsForm', () => {
  beforeEach(() => {
    window.Stripe = jest.fn(() => ({
      elements: () => ({
        create: () => ({
          mount: noop,
          unmount: noop,
          update: noop,
          on: noop,
          addEventListener: noop,
          removeEventListener: noop,
        }),
      }),
    }));
  });

  it('renders the MX billing address fields (MxAddressFields, billing prefix, no phone)', () => {
    render(<PaymentMethodsForm formId="test" onSubmit={noop} inProgress={false} />);
    expect(screen.getByText('ShippingDetails.mxNameLabel')).toBeInTheDocument();
    expect(screen.getByText('ShippingDetails.mxStreetLabel')).toBeInTheDocument();
    expect(screen.getByText('ShippingDetails.mxColoniaLabel')).toBeInTheDocument();
    // Billing omits the phone field.
    expect(screen.queryByText('ShippingDetails.mxPhoneLabel')).not.toBeInTheDocument();
  });
});
