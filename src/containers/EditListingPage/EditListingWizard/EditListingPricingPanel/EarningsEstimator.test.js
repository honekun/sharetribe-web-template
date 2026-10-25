import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';
import { createCurrentUser } from '../../../../util/testData';
import { types as sdkTypes } from '../../../../util/sdkLoader';

import EarningsEstimator from './EarningsEstimator';

const { screen } = testingLibrary;
const { Money } = sdkTypes;

// The production commission: 22 % from Console plus the $15.00 fixed fee, which
// comes from an env var that is unset in tests.
jest.mock('../../../../context/configurationContext', () => {
  const actual = jest.requireActual('../../../../context/configurationContext');
  return {
    ...actual,
    useConfiguration: () => ({
      earningsEstimate: {
        providerCommissionPercentage: 22,
        providerCommissionFixedAmountInSubunits: 1500,
        stripeFeePercentage: 2.9,
        stripeFeeFixedAmountInSubunits: 30,
      },
    }),
  };
});

const messages = {
  'EarningsEstimator.title': 'Estimated Earnings',
  'EarningsEstimator.listingPrice': 'Listing price',
  'EarningsEstimator.marketplaceFeeLabel': 'Marketplace fee',
  'EarningsEstimator.stripeFee': 'Payment processing',
  'EarningsEstimator.yourEarnings': 'Your earnings',
  'EarningsEstimator.enterPrice': 'Enter a price to see estimated earnings.',
  'EarningsEstimator.disclaimer': 'This is an estimate. Actual fees may vary.',
};

const price = new Money(50000, 'MXN');

const renderFor = metadata => {
  const currentUser = createCurrentUser('seller-1', {
    profile: { displayName: 'Seller', abbreviatedName: 'S', metadata },
  });
  return render(<EarningsEstimator price={price} marketplaceCurrency="MXN" />, {
    messages,
    initialState: { user: { currentUser } },
  });
};

describe('EarningsEstimator', () => {
  it('uses the marketplace rate for a seller without an override', () => {
    renderFor({});
    expect(screen.getByText('Marketplace fee (22% + $15.00)')).toBeInTheDocument();
    expect(screen.getByText('-$125.00')).toBeInTheDocument();
    expect(screen.getByText('$375.00')).toBeInTheDocument();
  });

  it("uses the seller's override", () => {
    renderFor({ avCommissionPercentage: 15 });
    expect(screen.getByText('Marketplace fee (15% + $15.00)')).toBeInTheDocument();
    expect(screen.getByText('-$90.00')).toBeInTheDocument();
    expect(screen.getByText('$410.00')).toBeInTheDocument();
  });

  it('still charges the fixed fee at an override of zero', () => {
    renderFor({ avCommissionPercentage: 0 });
    expect(screen.getByText('Marketplace fee (0% + $15.00)')).toBeInTheDocument();
    expect(screen.getByText('-$15.00')).toBeInTheDocument();
    expect(screen.getByText('$485.00')).toBeInTheDocument();
  });

  it('uses the marketplace rate for an invalid override, as checkout does', () => {
    renderFor({ avCommissionPercentage: 40 });
    expect(screen.getByText('Marketplace fee (22% + $15.00)')).toBeInTheDocument();
  });

  it('uses the marketplace rate when no user is signed in', () => {
    render(<EarningsEstimator price={price} marketplaceCurrency="MXN" />, { messages });
    expect(screen.getByText('Marketplace fee (22% + $15.00)')).toBeInTheDocument();
  });
});
