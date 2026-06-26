import React from 'react';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import '@testing-library/jest-dom';

import { ShippingOriginPageComponent } from './ShippingOriginPage';

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

describe('ShippingOriginPage', () => {
  it('renders the heading and the origin form', () => {
    render(<ShippingOriginPageComponent {...props} />);
    expect(screen.getByText('ShippingOriginPage.heading')).toBeInTheDocument();
    expect(screen.getByText('ShippingOriginPage.submit')).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<ShippingOriginPageComponent {...props} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
