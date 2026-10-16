import { storeData } from '../../containers/CheckoutPage/CheckoutPageSessionHelpers';
import { findRouteByRouteName } from '../../util/routes';

// Must equal STORAGE_KEY in CheckoutPage.js, which upstream does not export.
// checkoutSession.test.js fails if the two drift.
export const CHECKOUT_PAGE_SESSION_KEY = 'CheckoutPage';

/**
 * Persist the checkout seed (listing + orderData) to sessionStorage before
 * navigating to CheckoutPage, for every user.
 *
 * CheckoutPage stores this itself once it mounts, but nothing covers the gap
 * before that: a ChunkLoadError auto-reload while loading the checkout chunk,
 * or a full-page SSO redirect for a signed-out buyer. The route's
 * setInitialValues (CheckoutPage.duck) ignores its saveToSessionStorage flag
 * until upstream 52d708460 is synced, so AV seeds the storage here without
 * touching upstream checkout files. After that sync this is a harmless
 * duplicate write and can be removed.
 *
 * @param {Object} initialValues CheckoutPage initial values ({ listing, orderData })
 */
export const persistCheckoutSeed = initialValues => {
  if (typeof window === 'undefined') return;
  const { listing, orderData } = initialValues || {};
  storeData(orderData, listing, null, CHECKOUT_PAGE_SESSION_KEY);
};

/**
 * True when `setInitialValuesFn` is the CheckoutPage route's own setInitialValues,
 * so a shared callSetInitialValues only persists checkout seeds (not e.g. the
 * ListingPage inquiry-modal state it also dispatches).
 *
 * @param {Function} setInitialValuesFn
 * @param {Array} routes route configuration
 * @returns {boolean}
 */
export const isCheckoutPageSetInitialValues = (setInitialValuesFn, routes) => {
  if (!setInitialValuesFn || !routes) return false;
  try {
    return setInitialValuesFn === findRouteByRouteName('CheckoutPage', routes).setInitialValues;
  } catch (e) {
    return false;
  }
};
