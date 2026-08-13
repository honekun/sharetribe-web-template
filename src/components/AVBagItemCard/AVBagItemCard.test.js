import React from 'react';
import '@testing-library/jest-dom';
import { types as sdkTypes } from '../../util/sdkLoader';

import { createListing, createUser } from '../../util/testData';
import {
  getHostedConfiguration,
  renderWithProviders as render,
  testingLibrary,
} from '../../util/testHelpers';

import AVBagItemCard from './AVBagItemCard';

const { Money } = sdkTypes;
const { screen, fireEvent } = testingLibrary;

const config = {
  ...getHostedConfiguration(),
  listingFields: {
    listingFields: [
      {
        key: 'all_sizes',
        scope: 'public',
        schemaType: 'multi-enum',
        enumOptions: [{ option: 's', label: 'Small' }, { option: 'm', label: 'Medium' }],
      },
    ],
  },
};

const messages = {
  'ListingCard.author': '{authorName}',
  'AVBagItemCard.items': 'Item(s)',
  'AVBagItemCard.total': 'Total',
  'AVBagItemCard.shippingNote': 'Shipping calculated at checkout',
  'AVBagItemCard.checkout': 'Checkout {count} item',
  'BagPage.remove': 'Remove',
};

const makeListing = (publicData = {}) =>
  createListing(
    'bag-item-1',
    {
      title: 'Vintage jacket',
      price: new Money(7700, 'USD'),
      publicData: {
        listingType: 'product-selling',
        transactionProcessAlias: 'default-purchase/release-1',
        unitType: 'item',
        ...publicData,
      },
    },
    { author: createUser('author-1') }
  );

const renderCard = (props = {}, publicData = {}) =>
  render(
    <AVBagItemCard
      listing={makeListing(publicData)}
      onRemove={() => {}}
      onCheckout={() => {}}
      {...props}
    />,
    { config, messages }
  );

describe('AVBagItemCard', () => {
  it('renders title, price, size and totals', () => {
    renderCard({}, { all_sizes: ['m'] });
    expect(screen.getByText('Vintage jacket')).toBeInTheDocument();
    // Price appears in the details column and both totals rows.
    expect(screen.getAllByText('$77.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Item(s)')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Shipping calculated at checkout')).toBeInTheDocument();
    expect(screen.getByText('Checkout 1 item')).toBeInTheDocument();
  });

  it('shows the original price struck through when higher than current', () => {
    renderCard({}, { originalPrice: { amount: 11000, currency: 'USD' } });
    expect(screen.getByText('$110.00')).toBeInTheDocument();
  });

  it('fires onRemove and onCheckout callbacks', () => {
    const onRemove = jest.fn();
    const onCheckout = jest.fn();
    renderCard({ onRemove, onCheckout });

    fireEvent.click(screen.getByText('Remove'));
    expect(onRemove).toHaveBeenCalledWith('bag-item-1');

    fireEvent.click(screen.getByText('Checkout 1 item'));
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('matches snapshot', () => {
    const { asFragment } = renderCard({}, { all_sizes: ['m'] });
    expect(asFragment()).toMatchSnapshot();
  });
});
