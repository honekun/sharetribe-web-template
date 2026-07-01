import React from 'react';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import '@testing-library/jest-dom';

import { MyAddressesPageComponent } from './MyAddressesPage';

const { screen } = testingLibrary;

const props = {
  currentUser: {
    id: { uuid: 'u1' },
    attributes: { profile: { protectedData: {} } },
  },
  scrollingDisabled: false,
  saveInProgress: false,
  saveError: null,
  saveSuccess: false,
  onSubmit: () => {},
  onChange: () => {},
};

describe('MyAddressesPage', () => {
  it('renders the heading and the address form', () => {
    render(<MyAddressesPageComponent {...props} />);
    expect(screen.getByText('MyAddressesPage.heading')).toBeInTheDocument();
    expect(screen.getByText('MyAddressesPage.submit')).toBeInTheDocument();
    // Uses the shared MX address fields (phone included for buyer addresses).
    expect(screen.getByText('ShippingDetails.mxNameLabel')).toBeInTheDocument();
    expect(screen.getByText('ShippingDetails.mxPhoneLabel')).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<MyAddressesPageComponent {...props} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
