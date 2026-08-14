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

// ---------------------------------------------------------------------------
// StripePaymentForm.changePaymentMethod, driven through the real UI.
//
// This path had no coverage: a refactor that deleted changePaymentMethod outright
// still left the whole suite green. It is worth testing at the UI level rather
// than by reaching for the class instance, because the class is not exported and
// exporting it purely for tests would add AV delta to an upstream file.
//
// The AV-specific part is the 'replaceCard' branch: it ticks "same address" and
// copies the MX shipping fields into their billing counterparts via
// copyShippingAddressToBilling (avMxAddress.js).
// ---------------------------------------------------------------------------
// eslint-disable-next-line import/first
import CheckoutPageWithPayment from './CheckoutPageWithPayment';

const { Money } = sdkTypes;
const { screen, userEvent, waitFor } = testingLibrary;
const noop = () => null;

describe('changePaymentMethod (saved card vs. new card)', () => {
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

  // A currentUser that satisfies hasDefaultPaymentMethod(), so the payment form
  // renders SavedCardDetails (the control wired to changePaymentMethod) rather
  // than the plain one-time card element.
  // Shape read by valuesFromShippingOrigin (name/zip/phone, not recipient*).
  const savedAddress = {
    name: 'Ana Torres',
    street1: 'Av. Reforma',
    exteriorNumber: '100',
    interiorNumber: '3B',
    colonia: 'Juárez',
    zip: '06600',
    city: 'CDMX',
    state: 'CMX',
    phone: '5555555555',
  };

  const currentUserWithCard = {
    ...createCurrentUser('currentUser', {
      profile: {
        firstName: 'Ana',
        lastName: 'Torres',
        displayName: 'Ana Torres',
        abbreviatedName: 'AT',
        protectedData: { shippingAddress: savedAddress },
      },
    }),
    stripeCustomer: {
      id: 'stripe-customer-1',
      type: 'stripeCustomer',
      attributes: { stripeCustomerId: 'cus_123' },
      defaultPaymentMethod: {
        id: 'pm_123',
        type: 'stripePaymentMethod',
        attributes: {
          type: 'stripe-payment-method/card',
          stripePaymentMethodId: 'pm_123',
          card: { brand: 'visa', last4Digits: '4242', expirationYear: 2030, expirationMonth: 12 },
        },
      },
    },
  };

  const baseProps = {
    dispatch: noop,
    history: { push: noop, action: 'PUSH' },
    intl: fakeIntl,
    currentUser: currentUserWithCard,
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
    onStripeInitialized: noop,
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

  const renderCheckout = () =>
    render(
      <CheckoutPageWithPayment
        {...baseProps}
        pageData={shippingPageData}
        setPageData={noop}
        fetchSpeculatedTransaction={noop}
      />
    );

  // The saved-card menu offers both options; pick one by its accessible name.
  const clickReplaceCard = async () => {
    const replaceCard = screen.getByRole('button', {
      name: /SavedCardDetails.replaceCardTitle|replace/i,
    });
    await userEvent.click(replaceCard);
  };

  const valueOf = (container, name) => container.querySelector(`input[name="${name}"]`)?.value;

  it('renders the saved-card selector when the buyer has a default payment method', () => {
    renderCheckout();
    expect(
      screen.getByRole('heading', { name: 'StripePaymentForm.payWithHeading' })
    ).toBeInTheDocument();
    // The saved card is identified by its expiry; fakeIntl leaves the "•••• 4242"
    // placeholder untranslated, so the digits themselves never reach the DOM.
    expect(screen.getAllByText('12/30').length).toBeGreaterThan(0);
  });

  it('switching to a new card copies the shipping address into the billing fields', async () => {
    const { container } = renderCheckout();

    // Shipping is prefilled from the buyer's saved address.
    expect(valueOf(container, 'recipientAddressLine1')).toBe('Av. Reforma');
    // No billing fields at all until a new card is chosen.
    expect(valueOf(container, 'billingAddressLine1')).toBeUndefined();

    await clickReplaceCard();

    await waitFor(() => {
      expect(valueOf(container, 'billingAddressLine1')).toBe('Av. Reforma');
    });
    expect(valueOf(container, 'billingExteriorNumber')).toBe('100');
    expect(valueOf(container, 'billingInteriorNumber')).toBe('3B');
    expect(valueOf(container, 'billingColonia')).toBe('Juárez');
    expect(valueOf(container, 'billingPostal')).toBe('06600');
    expect(valueOf(container, 'billingCity')).toBe('CDMX');
  });

  it('does not copy the phone number into billing', async () => {
    const { container } = renderCheckout();
    await clickReplaceCard();
    await waitFor(() => {
      expect(valueOf(container, 'billingAddressLine1')).toBe('Av. Reforma');
    });
    expect(valueOf(container, 'recipientPhoneNumber')).toBe('5555555555');
    expect(container.querySelector('input[name="billingPhoneNumber"]')).toBeNull();
  });

  it('shows the billing details section only after switching to a new card', async () => {
    renderCheckout();
    expect(screen.queryByRole('heading', { name: 'StripePaymentForm.billingDetails' })).toBeNull();

    await clickReplaceCard();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'StripePaymentForm.billingDetails' })
      ).toBeInTheDocument();
    });
  });

  it('switching back to the saved card clears the copied billing fields', async () => {
    const { container } = renderCheckout();
    await clickReplaceCard();
    await waitFor(() => {
      expect(valueOf(container, 'billingAddressLine1')).toBe('Av. Reforma');
    });

    const defaultCard = screen.getAllByRole('button').find(b => /12\/30/.test(b.textContent || ''));
    await userEvent.click(defaultCard);

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'StripePaymentForm.billingDetails' })
      ).toBeNull();
    });
    // Shipping is untouched by the switch.
    expect(valueOf(container, 'recipientAddressLine1')).toBe('Av. Reforma');
  });
});
