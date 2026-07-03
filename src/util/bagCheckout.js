import { createSlug } from './urlHelpers';
import { createResourceLocatorString, findRouteByRouteName } from './routes';

/**
 * Navigate into the normal buy flow for one bag item. Mirrors handleSubmit in
 * ListingPage.shared.js: when the delivery method is unambiguous we go straight
 * to CheckoutPage; otherwise the user picks it on the listing page OrderPanel.
 *
 * callSetInitialValues dispatches CheckoutPage's OWN setInitialValues fn
 * (resolved here via findRouteByRouteName), seeding checkout state the same way
 * the normal buy flow does — so callers must NOT import CheckoutPage.duck.
 */
export const checkoutBagItem = ({
  listing,
  history,
  routes,
  currentUser,
  callSetInitialValues,
  onInitializeCardPaymentData,
}) => {
  const { shippingEnabled, pickupEnabled } = listing.attributes.publicData || {};
  const onlyMethod =
    shippingEnabled && !pickupEnabled
      ? 'shipping'
      : pickupEnabled && !shippingEnabled
      ? 'pickup'
      : null;

  const slug = createSlug(listing.attributes.title);

  if (!onlyMethod) {
    history.push(
      createResourceLocatorString('ListingPage', routes, { id: listing.id.uuid, slug }, {})
    );
    return;
  }

  const initialValues = {
    listing,
    orderData: { quantity: 1, deliveryMethod: onlyMethod },
    confirmPaymentError: null,
  };
  // Match ListingPage.shared.js: only persist to sessionStorage for logged-out users.
  const saveToSessionStorage = !currentUser;
  const { setInitialValues } = findRouteByRouteName('CheckoutPage', routes);
  callSetInitialValues(setInitialValues, initialValues, saveToSessionStorage);
  onInitializeCardPaymentData();
  history.push(
    createResourceLocatorString('CheckoutPage', routes, { id: listing.id.uuid, slug }, {})
  );
};
