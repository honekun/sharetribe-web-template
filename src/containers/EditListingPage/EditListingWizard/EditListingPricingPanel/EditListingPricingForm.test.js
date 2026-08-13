import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingPricingForm from './EditListingPricingForm';

const { screen, userEvent, fireEvent } = testingLibrary;

const noop = () => null;

describe('EditListingDeliveryForm', () => {
  it('Check that price can be given and submit button activates', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save price';
    render(
      <EditListingPricingForm
        intl={fakeIntl}
        dispatch={noop}
        onSubmit={v => v}
        marketplaceCurrency="USD"
        unitType="day"
        listingMinimumPriceSubUnits={0}
        saveActionMsg={saveActionMsg}
        updated={false}
        updateInProgress={false}
        disabled={false}
        ready={false}
      />
    );

    // Test that save button is disabled at first
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();

    // Fill mandatory attributes
    const price = 'EditListingPricingForm.pricePerProduct';
    await user.type(screen.getByRole('textbox', { name: price }), '10');

    // Test that save button is enabled
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeEnabled();
  });
});

describe('EditListingPricingForm original price', () => {
  const baseProps = {
    intl: fakeIntl,
    dispatch: noop,
    onSubmit: noop,
    marketplaceCurrency: 'MXN',
    unitType: 'day',
    listingMinimumPriceSubUnits: 0,
    saveActionMsg: 'Save',
    updated: false,
    updateInProgress: false,
    disabled: false,
    ready: false,
  };
  const originalPriceLabel = /EditListingPricingForm.originalPrice/i;

  it('renders the original price input when showOriginalPrice is true', () => {
    render(<EditListingPricingForm {...baseProps} showOriginalPrice={true} />);
    expect(screen.getByLabelText(originalPriceLabel)).toBeInTheDocument();
  });

  it('does not render the input when showOriginalPrice is false', () => {
    render(<EditListingPricingForm {...baseProps} showOriginalPrice={false} />);
    expect(screen.queryByLabelText(originalPriceLabel)).not.toBeInTheDocument();
  });

  it('does not render the input when showOriginalPrice is omitted', () => {
    render(<EditListingPricingForm {...baseProps} />);
    expect(screen.queryByLabelText(originalPriceLabel)).not.toBeInTheDocument();
  });

  it('blocks submission when the original price does not exceed the price', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save';
    render(
      <EditListingPricingForm
        {...baseProps}
        saveActionMsg={saveActionMsg}
        showOriginalPrice={true}
      />
    );

    await user.type(
      screen.getByRole('textbox', { name: 'EditListingPricingForm.pricePerProduct' }),
      '20'
    );
    await user.type(screen.getByLabelText(originalPriceLabel), '10');
    // The error only shows once the field has been touched, i.e. after blur.
    await user.tab();

    expect(screen.getByText('EditListingPricingForm.originalPriceTooLow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();
  });

  it('allows submission when the original price exceeds the price', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save';
    render(
      <EditListingPricingForm
        {...baseProps}
        saveActionMsg={saveActionMsg}
        showOriginalPrice={true}
      />
    );

    await user.type(
      screen.getByRole('textbox', { name: 'EditListingPricingForm.pricePerProduct' }),
      '10'
    );
    await user.type(screen.getByLabelText(originalPriceLabel), '20');

    expect(
      screen.queryByText('EditListingPricingForm.originalPriceTooLow')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeEnabled();
  });
});
