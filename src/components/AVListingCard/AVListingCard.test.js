import React from 'react';
import { renderToString } from 'react-dom/server';
import '@testing-library/jest-dom';

import { createListing, createUser } from '../../util/testData';
import { sanitizeEntity } from '../../util/sanitize';
import {
  TestProvider,
  getHostedConfiguration,
  renderWithProviders as render,
  testingLibrary,
} from '../../util/testHelpers';

import AVListingCard from './AVListingCard';

const { screen } = testingLibrary;

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

const renderCard = publicData => {
  const listing = createListing('av-listing-card-test', {
    publicData: {
      listingType: 'product-selling',
      transactionProcessAlias: 'default-purchase/release-1',
      unitType: 'item',
      ...publicData,
    },
  });

  return render(<AVListingCard listing={listing} showAuthorInfo={false} />, {
    config,
    messages: {
      'AVListingCard.sizeLabel': 'Size:',
      'ListingCard.price': '{priceValue}{pricePerUnit}',
      'ListingCard.perUnit': ' per {unitType}',
    },
  });
};

describe('AVListingCard', () => {
  it('matches snapshot', () => {
    const { asFragment } = renderCard({ all_sizes: ['m', 's'] });
    expect(asFragment().firstChild).toMatchSnapshot();
  });

  it('displays mapped all_sizes labels in stored order without a label', () => {
    renderCard({ all_sizes: ['m', 's'] });

    expect(screen.queryByText('Size:')).not.toBeInTheDocument();
    expect(screen.getByText('Medium, Small')).toBeInTheDocument();
  });

  it('hides size row when all_sizes is empty', () => {
    renderCard({ all_sizes: [] });

    expect(screen.queryByText('Medium, Small')).not.toBeInTheDocument();
  });

  it('hides size row when all_sizes is missing', () => {
    renderCard({});

    expect(screen.queryByText('Medium, Small')).not.toBeInTheDocument();
  });

  it('shows the original price struck through when higher than the price', () => {
    renderCard({ originalPrice: { amount: 8000, currency: 'USD' } });

    // Current price is $55.00 (5500); original is $80.00.
    expect(screen.getByText('$80.00').tagName).toBe('S');
  });

  it('hides the original price when not higher than the price', () => {
    renderCard({ originalPrice: { amount: 5000, currency: 'USD' } });

    expect(screen.queryByText('$50.00')).not.toBeInTheDocument();
  });

  describe('malformed original price (audit A03)', () => {
    const malformed = [
      { amount: 90000, currency: 'NO-SUCH-CURRENCY' },
      { amount: 90000 },
      { amount: 90000, currency: 'MXN' },
      { amount: '90000', currency: 'USD' },
      { amount: 900.5, currency: 'USD' },
      { amount: Number.MAX_SAFE_INTEGER + 1, currency: 'USD' },
      'NO-SUCH-CURRENCY 900',
    ];

    it.each(malformed)('renders without a comparison price for %p', originalPrice => {
      const { container } = renderCard({ originalPrice });
      expect(container.querySelector('s')).toBeNull();
      expect(screen.getByText('$55.00')).toBeInTheDocument();
    });

    it('cannot break a server-rendered result set that contains valid listings', () => {
      const listing = (id, originalPrice) =>
        sanitizeEntity(
          createListing(id, {
            title: `Listing ${id}`,
            publicData: {
              listingType: 'product-selling',
              transactionProcessAlias: 'default-purchase/release-1',
              unitType: 'item',
              originalPrice,
            },
          }),
          // The sanitizer reads the merged (array) listing-field config.
          { listingFields: config.listingFields.listingFields }
        );
      const results = [
        listing('valid-1', { amount: 8000, currency: 'USD' }),
        listing('malformed', { amount: 90000, currency: 'NO-SUCH-CURRENCY' }),
        listing('valid-2', null),
      ];

      const html = renderToString(
        <TestProvider
          config={config}
          messages={{
            'AVListingCard.sizeLabel': 'Size:',
            'ListingCard.price': '{priceValue}{pricePerUnit}',
            'ListingCard.perUnit': ' per {unitType}',
          }}
        >
          {results.map(l => (
            <AVListingCard key={l.id.uuid} listing={l} showAuthorInfo={false} />
          ))}
        </TestProvider>
      );

      // All three cards render; only the valid comparison price is shown.
      expect(html.match(/class="cardLink"/g)).toHaveLength(3);
      expect(html).toContain('/valid-1"');
      expect(html).toContain('/malformed"');
      expect(html).toContain('/valid-2"');
      expect(html.match(/<s[ >]/g)).toHaveLength(1);
      expect(html).toContain('$80.00');
    });
  });

  it('shows store-type tags for vendedor-tienda authors', () => {
    const listing = createListing(
      'av-store-card',
      {
        publicData: {
          listingType: 'product-selling',
          transactionProcessAlias: 'default-purchase/release-1',
          unitType: 'item',
        },
      },
      {
        author: createUser('store-1', {
          profile: {
            displayName: 'Store One',
            abbreviatedName: 'SO',
            publicData: { userType: 'vendedor-tienda', tipoTienda: ['trending', 'holiday'] },
          },
        }),
      }
    );

    render(<AVListingCard listing={listing} showAuthorInfo={false} />, {
      config,
      messages: {
        'ListingCard.price': '{priceValue}{pricePerUnit}',
        'ListingCard.perUnit': ' per {unitType}',
      },
    });

    expect(screen.getByText('trending')).toBeInTheDocument();
    expect(screen.getByText('holiday')).toBeInTheDocument();
  });
});
