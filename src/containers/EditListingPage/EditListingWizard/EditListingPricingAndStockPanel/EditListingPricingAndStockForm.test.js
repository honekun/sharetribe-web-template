import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingPricingAndStockForm from './EditListingPricingAndStockForm';

const { screen, userEvent, fireEvent } = testingLibrary;

const noop = () => null;

describe('EditListingDeliveryForm', () => {
  it('Check that price can be given and submit button activates', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save price';
    render(
      <EditListingPricingAndStockForm
        intl={fakeIntl}
        dispatch={noop}
        onSubmit={v => v}
        marketplaceCurrency="USD"
        listingMinimumPriceSubUnits={0}
        unitType="item"
        listingType={{ listingType: 'sell-bikes', stockType: 'multipleItems' }}
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
    const price = 'EditListingPricingAndStockForm.pricePerProduct';
    await user.type(screen.getByRole('textbox', { name: price }), '10');
    const stock = 'EditListingPricingAndStockForm.stockLabel';
    await user.type(screen.getByRole('spinbutton', { name: stock }), '10');

    // Test that save button is enabled
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeEnabled();
  });
});

describe('EditListingPricingAndStockForm package size', () => {
  const baseProps = {
    intl: fakeIntl,
    onSubmit: noop,
    marketplaceCurrency: 'MXN',
    listingMinimumPriceSubUnits: 0,
    unitType: 'item',
    listingType: { listingType: 'sell-bikes', stockType: 'multipleItems' },
    saveActionMsg: 'Save',
    updated: false,
    updateInProgress: false,
    disabled: false,
    ready: false,
  };

  it('renders the package size select when showPackageSize is true', () => {
    render(<EditListingPricingAndStockForm {...baseProps} showPackageSize={true} />);
    expect(screen.getByLabelText(/EditListingPricingForm.packageSizeLabel/i)).toBeInTheDocument();
  });

  it('does not render the select when showPackageSize is false', () => {
    render(<EditListingPricingAndStockForm {...baseProps} showPackageSize={false} />);
    expect(
      screen.queryByLabelText(/EditListingPricingForm.packageSizeLabel/i)
    ).not.toBeInTheDocument();
  });

  const originalPriceLabel = /EditListingPricingAndStockForm.originalPrice/i;

  it('renders the original price input when showOriginalPrice is true', () => {
    render(<EditListingPricingAndStockForm {...baseProps} showOriginalPrice={true} />);
    expect(screen.getByLabelText(originalPriceLabel)).toBeInTheDocument();
  });

  it('does not render the input when showOriginalPrice is false', () => {
    render(<EditListingPricingAndStockForm {...baseProps} showOriginalPrice={false} />);
    expect(screen.queryByLabelText(originalPriceLabel)).not.toBeInTheDocument();
  });

  it('does not render the input when showOriginalPrice is omitted', () => {
    render(<EditListingPricingAndStockForm {...baseProps} />);
    expect(screen.queryByLabelText(originalPriceLabel)).not.toBeInTheDocument();
  });

  it('blocks submission when the original price does not exceed the price', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save';
    render(
      <EditListingPricingAndStockForm
        {...baseProps}
        saveActionMsg={saveActionMsg}
        showOriginalPrice={true}
      />
    );

    await user.type(
      screen.getByRole('textbox', { name: 'EditListingPricingAndStockForm.pricePerProduct' }),
      '20'
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'EditListingPricingAndStockForm.stockLabel' }),
      '10'
    );
    await user.type(screen.getByLabelText(originalPriceLabel), '10');
    // The error only shows once the field has been touched, i.e. after blur.
    await user.tab();

    expect(
      screen.getByText('EditListingPricingAndStockForm.originalPriceTooLow')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeDisabled();
  });

  it('allows submission when the original price exceeds the price', async () => {
    const user = userEvent.setup();
    const saveActionMsg = 'Save';
    render(
      <EditListingPricingAndStockForm
        {...baseProps}
        saveActionMsg={saveActionMsg}
        showOriginalPrice={true}
      />
    );

    await user.type(
      screen.getByRole('textbox', { name: 'EditListingPricingAndStockForm.pricePerProduct' }),
      '10'
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'EditListingPricingAndStockForm.stockLabel' }),
      '10'
    );
    await user.type(screen.getByLabelText(originalPriceLabel), '20');
    await user.tab();

    expect(
      screen.queryByText('EditListingPricingAndStockForm.originalPriceTooLow')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: saveActionMsg })).toBeEnabled();
  });
});
