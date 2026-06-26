import React from 'react';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import '@testing-library/jest-dom';

import ShippingOriginBanner from './ShippingOriginBanner';

const { screen } = testingLibrary;

const userWith = origin => ({
  attributes: { profile: { protectedData: origin ? { shippingOrigin: origin } : {} } },
});

describe('ShippingOriginBanner', () => {
  it('renders the banner when origin is missing', () => {
    render(<ShippingOriginBanner currentUser={userWith(null)} />);
    expect(screen.getByText('ShippingOriginBanner.message')).toBeInTheDocument();
    expect(screen.getByText('ShippingOriginBanner.cta')).toBeInTheDocument();
  });

  it('renders nothing when origin is complete', () => {
    const complete = { street1: 'A', city: 'C', state: 'NL', zip: '64000' };
    const { container } = render(<ShippingOriginBanner currentUser={userWith(complete)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
