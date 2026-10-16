import { createListing } from '../../util/testData';
import { handlePageData } from '../../containers/CheckoutPage/CheckoutPageSessionHelpers';

import {
  CHECKOUT_PAGE_SESSION_KEY,
  isCheckoutPageSetInitialValues,
  persistCheckoutSeed,
} from './checkoutSession';

const fs = require('fs');
const path = require('path');

const checkoutSetInitialValues = jest.fn();
const listingSetInitialValues = jest.fn();
const routes = [
  { path: '/l/:slug/:id', name: 'ListingPage', setInitialValues: listingSetInitialValues },
  {
    path: '/l/:slug/:id/checkout',
    name: 'CheckoutPage',
    setInitialValues: checkoutSetInitialValues,
  },
];

describe('checkoutSession', () => {
  afterEach(() => window.sessionStorage.clear());

  it('uses the same storage key as CheckoutPage', () => {
    // CheckoutPage.js is upstream and does not export STORAGE_KEY.
    const source = fs.readFileSync(
      path.join(__dirname, '../../containers/CheckoutPage/CheckoutPage.js'),
      'utf8'
    );
    expect(source).toMatch(`const STORAGE_KEY = '${CHECKOUT_PAGE_SESSION_KEY}';`);
  });

  it('persists a seed that CheckoutPage restores after a full reload', () => {
    const listing = createListing('listing-1');
    const orderData = { quantity: 1, deliveryMethod: 'shipping' };

    persistCheckoutSeed({ listing, orderData, confirmPaymentError: null });

    // A reload is a POP navigation with nothing in Redux.
    const restored = handlePageData({}, CHECKOUT_PAGE_SESSION_KEY, { action: 'POP' });
    expect(restored.orderData).toEqual(orderData);
    expect(restored.listing.id.uuid).toBe('listing-1');
  });

  it('writes nothing for an incomplete seed', () => {
    persistCheckoutSeed({ listing: null, orderData: { quantity: 1 } });
    expect(window.sessionStorage.getItem(CHECKOUT_PAGE_SESSION_KEY)).toBeNull();
  });

  it('recognises only the CheckoutPage route setInitialValues', () => {
    expect(isCheckoutPageSetInitialValues(checkoutSetInitialValues, routes)).toBe(true);
    expect(isCheckoutPageSetInitialValues(listingSetInitialValues, routes)).toBe(false);
    expect(isCheckoutPageSetInitialValues(checkoutSetInitialValues, routes.slice(0, 1))).toBe(
      false
    );
    expect(isCheckoutPageSetInitialValues(undefined, routes)).toBe(false);
  });
});
