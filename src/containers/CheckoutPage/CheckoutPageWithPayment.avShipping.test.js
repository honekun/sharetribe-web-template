import React from 'react';
import '@testing-library/jest-dom';
import Decimal from 'decimal.js';

import { types as sdkTypes } from '../../util/sdkLoader';
import {
  createCurrentUser,
  createImage,
  createListing,
  createTransaction,
  createUser,
  fakeIntl,
} from '../../util/testData';
import {
  renderWithProviders as render,
  testingLibrary,
  getDefaultConfiguration,
} from '../../util/testHelpers';

import { getOrderParams } from './CheckoutPageWithPayment';

// ---------------------------------------------------------------------------
// Unit tests for the exported getOrderParams helper (deterministic part).
// ---------------------------------------------------------------------------
describe('getOrderParams avShipping fields', () => {
  const cfg = { listing: { listingTypes: [] } };
  const base = {
    listing: { id: { uuid: 'l1' }, attributes: { publicData: {} } },
    orderData: { deliveryMethod: 'shipping', avShippingType: 'nacionalEstandar', quantity: 1 },
  };

  test('puts avShippingType in both top-level and protectedData', () => {
    const params = getOrderParams(base, {}, {}, cfg);
    expect(params.avShippingType).toBe('nacionalEstandar');
    expect(params.protectedData.avShippingType).toBe('nacionalEstandar');
  });

  test('threads avQuoteToken, avDestination and buyerEmail to the top level when present', () => {
    const withQuote = {
      listing: { id: { uuid: 'l1' }, attributes: { publicData: {} } },
      orderData: {
        deliveryMethod: 'shipping',
        avShippingType: 'nacionalExpress',
        avQuoteToken: 'tok-123',
        avDestination: { zip: '64000', state: 'Nuevo León' },
        buyerEmail: 'b@x.com',
        quantity: 1,
      },
    };
    const params = getOrderParams(withQuote, {}, {}, cfg);
    expect(params.avQuoteToken).toBe('tok-123');
    expect(params.avDestination).toEqual({ zip: '64000', state: 'Nuevo León' });
    expect(params.buyerEmail).toBe('b@x.com');
  });

  test('omits the quote fields when not present (e.g. before a quote)', () => {
    const params = getOrderParams(base, {}, {}, cfg);
    expect(params.avQuoteToken).toBeUndefined();
    expect(params.avDestination).toBeUndefined();
  });

  test('omits avShippingType when not selected (pickup orders unaffected)', () => {
    const pickup = {
      listing: { id: { uuid: 'l1' }, attributes: { publicData: {} } },
      orderData: { deliveryMethod: 'pickup', quantity: 1 },
    };
    const params = getOrderParams(pickup, {}, {}, cfg);
    expect(params.avShippingType).toBeUndefined();
    expect(params.protectedData.avShippingType).toBeUndefined();
  });

  test("defaults deliveryMethod to 'shipping' for a purchase listing when unset", () => {
    const noDelivery = {
      listing: {
        id: { uuid: 'l1' },
        attributes: { publicData: { transactionProcessAlias: 'default-purchase/release-1' } },
      },
      orderData: { quantity: 1 },
    };
    const params = getOrderParams(noDelivery, {}, {}, cfg);
    expect(params.deliveryMethod).toBe('shipping');
    expect(params.protectedData.deliveryMethod).toBe('shipping');
  });

  test('keeps an explicit pickup deliveryMethod for a purchase listing', () => {
    const pickup = {
      listing: {
        id: { uuid: 'l1' },
        attributes: { publicData: { transactionProcessAlias: 'default-purchase/release-1' } },
      },
      orderData: { deliveryMethod: 'pickup', quantity: 1 },
    };
    const params = getOrderParams(pickup, {}, {}, cfg);
    expect(params.deliveryMethod).toBe('pickup');
  });
});

// ---------------------------------------------------------------------------
// Behavioral tests for the live-quote checkout structure. The address is now
// collected in the payment form (always rendered for shipping), the quote-driven
// AVShippingSelector renders inside it, and the Pay button is gated until a type
// is chosen. The selector's quoted/error states are unit-tested separately
// (AVShippingSelector.test.js); the quote starts 'idle' here, so no buckets show.
// ---------------------------------------------------------------------------
// eslint-disable-next-line import/first
import CheckoutPageWithPayment from './CheckoutPageWithPayment';

const { Money } = sdkTypes;
const { screen } = testingLibrary;
const noop = () => null;

describe('CheckoutPageWithPayment live-quote shipping', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: noop,
      removeEventListener: noop,
    }));
    window.Stripe = jest.fn(() => ({
      elements: () => ({
        create: () => ({
          mount: noop,
          unmount: noop,
          update: noop,
          addEventListener: noop,
          removeEventListener: noop,
        }),
      }),
    }));
  });

  const lineItems = [
    {
      code: 'line-item/item',
      includeFor: ['customer', 'provider'],
      quantity: new Decimal(1),
      unitPrice: new Money(1000, 'USD'),
      lineTotal: new Money(1000, 'USD'),
      reversal: false,
    },
  ];

  const listing = createListing(
    'listing1',
    {
      publicData: {
        transactionProcessAlias: 'default-purchase/release-1',
        unitType: 'item',
        avPackageSize: 'M',
      },
    },
    { author: createUser('author'), images: [createImage('first-image')] }
  );

  const baseProps = {
    dispatch: noop,
    history: { push: noop, action: 'PUSH' },
    intl: fakeIntl,
    currentUser: createCurrentUser('currentUser'),
    params: { id: 'listing1', slug: 'listing1' },
    fetchStripeCustomer: noop,
    stripeCustomerFetched: true,
    speculateTransactionInProgress: false,
    scrollingDisabled: false,
    onConfirmPayment: noop,
    onConfirmCardPayment: noop,
    onInitiateOrder: noop,
    onRetrievePaymentIntent: noop,
    onSavePaymentMethod: noop,
    config: getDefaultConfiguration(),
    routeConfiguration: [{ path: '/', name: 'LandingPage', component: () => <div /> }],
    processName: 'default-purchase',
    listingTitle: listing.attributes.title,
    title: 'CheckoutPage.default-purchase.title',
    speculatedTransaction: createTransaction({
      id: 'tx1',
      lineItems,
      total: new Money(1000, 'USD'),
    }),
  };

  const shippingPageData = { orderData: { quantity: 1, deliveryMethod: 'shipping' }, listing };

  it('renders the payment form and shipping address fields for a shipping purchase', () => {
    render(
      <CheckoutPageWithPayment
        {...baseProps}
        pageData={shippingPageData}
        setPageData={noop}
        fetchSpeculatedTransaction={noop}
      />
    );
    // Address is collected inside the payment form (no longer gated by type choice).
    // The shipping section is identified by its heading (billing reuses the same
    // MX field labels, so mxNameLabel alone is ambiguous).
    expect(screen.getByRole('heading', { name: 'ShippingDetails.mxTitle' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'StripePaymentForm.paymentHeading' })
    ).toBeInTheDocument();
  });

  it('disables the Pay button before a delivery type is chosen (shipping purchase)', () => {
    render(
      <CheckoutPageWithPayment
        {...baseProps}
        pageData={shippingPageData}
        setPageData={noop}
        fetchSpeculatedTransaction={noop}
      />
    );
    const payButton = screen.getByRole('button', { name: /StripePaymentForm.submitPaymentInfo/ });
    expect(payButton).toBeDisabled();
  });

  it('prefills the shipping fields from the buyer saved address', () => {
    const currentUser = {
      ...createCurrentUser('currentUser'),
      attributes: {
        ...createCurrentUser('currentUser').attributes,
        profile: {
          ...createCurrentUser('currentUser').attributes.profile,
          protectedData: {
            shippingAddress: {
              name: 'Saved Buyer',
              calle: 'Av. Reforma',
              exteriorNumber: '222',
              colonia: 'Juárez',
              city: 'Ciudad de México',
              state: 'Ciudad de México',
              zip: '06600',
              phone: '5512345678',
              street1: 'Av. Reforma 222',
            },
          },
        },
      },
    };
    render(
      <CheckoutPageWithPayment
        {...baseProps}
        currentUser={currentUser}
        pageData={shippingPageData}
        setPageData={noop}
        fetchSpeculatedTransaction={noop}
      />
    );
    // Saved address values are pre-filled into the (editable) shipping fields.
    expect(screen.getByDisplayValue('Av. Reforma')).toBeInTheDocument();
    expect(screen.getByDisplayValue('06600')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Juárez')).toBeInTheDocument();
  });

  it('does not render shipping address fields for pickup orders', () => {
    render(
      <CheckoutPageWithPayment
        {...baseProps}
        pageData={{ orderData: { quantity: 1, deliveryMethod: 'pickup' }, listing }}
        setPageData={noop}
        fetchSpeculatedTransaction={noop}
      />
    );
    // No shipping address form for pickup (identified by the shipping heading).
    // Billing still renders with the same MX fields, so we check the heading.
    expect(
      screen.queryByRole('heading', { name: 'ShippingDetails.mxTitle' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'StripePaymentForm.paymentHeading' })
    ).toBeInTheDocument();
  });
});
