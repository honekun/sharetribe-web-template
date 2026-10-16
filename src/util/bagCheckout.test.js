import { createListing } from './testData';
import { checkoutBagItem } from './bagCheckout';

const setInitialValues = jest.fn();
const routes = [
  { path: '/l/:slug/:id', name: 'ListingPage' },
  { path: '/l/:slug/:id/checkout', name: 'CheckoutPage', setInitialValues },
];

const setup = publicData => {
  const listing = createListing('listing-1', { title: 'Vintage jacket', publicData });
  const history = { push: jest.fn() };
  const callSetInitialValues = jest.fn();
  const onInitializeCardPaymentData = jest.fn();
  checkoutBagItem({ listing, history, routes, callSetInitialValues, onInitializeCardPaymentData });
  return { listing, history, callSetInitialValues, onInitializeCardPaymentData };
};

describe('checkoutBagItem', () => {
  afterEach(() => window.sessionStorage.clear());

  it('seeds checkout and persists it to sessionStorage when shipping is the only method', () => {
    const { listing, history, callSetInitialValues, onInitializeCardPaymentData } = setup({
      shippingEnabled: true,
      pickupEnabled: false,
    });

    // Persisted for every user (signed in or not) so a reload can resume checkout.
    expect(callSetInitialValues).toHaveBeenCalledWith(
      setInitialValues,
      {
        listing,
        orderData: { quantity: 1, deliveryMethod: 'shipping' },
        confirmPaymentError: null,
      },
      true
    );
    // Written to CheckoutPage's sessionStorage key before navigating, so a reload resumes it.
    expect(JSON.parse(window.sessionStorage.getItem('CheckoutPage')).orderData).toEqual({
      quantity: 1,
      deliveryMethod: 'shipping',
    });
    expect(onInitializeCardPaymentData).toHaveBeenCalledTimes(1);
    expect(history.push).toHaveBeenCalledWith('/l/vintage-jacket/listing-1/checkout');
  });

  it('picks pickup when it is the only method', () => {
    const { callSetInitialValues } = setup({ shippingEnabled: false, pickupEnabled: true });

    expect(callSetInitialValues.mock.calls[0][1].orderData.deliveryMethod).toBe('pickup');
  });

  it('sends the user to the listing page when the delivery method is ambiguous', () => {
    const { history, callSetInitialValues } = setup({ shippingEnabled: true, pickupEnabled: true });

    expect(callSetInitialValues).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('CheckoutPage')).toBeNull();
    expect(history.push).toHaveBeenCalledWith('/l/vintage-jacket/listing-1');
  });
});
