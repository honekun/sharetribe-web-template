// Module-load smoke test: ensures PaymentMethodsPage (and its getBillingDetails
// import from the checkout helpers) compiles and resolves. Full rendering is
// covered indirectly via PaymentMethodsForm.test.js.
import PaymentMethodsPage from './PaymentMethodsPage';

describe('PaymentMethodsPage module', () => {
  it('loads without throwing', () => {
    expect(PaymentMethodsPage).toBeDefined();
  });
});
