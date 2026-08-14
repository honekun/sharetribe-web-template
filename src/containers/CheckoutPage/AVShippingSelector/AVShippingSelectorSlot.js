import React from 'react';

import AVShippingSelector from './AVShippingSelector';

/**
 * AV: renders the right shipping selector state for the checkout payment form,
 * driven entirely by the `useAvShippingQuote` hook's return value.
 *
 * Three states:
 * - quotable listing  → the live Express/Estándar selector,
 * - `especial` size   → a permanent "Contactar AV" prompt (no automatic quote),
 * - anything else     → nothing at all.
 *
 * Exists so `CheckoutPageWithPayment.js` only passes a single element to
 * StripePaymentForm and keeps its diff against upstream small.
 *
 * @param {Object} props
 * @param {Object} props.av - the object returned by `useAvShippingQuote`
 */
const AVShippingSelectorSlot = ({ av }) => {
  if (av.isAvShipping) {
    return (
      <AVShippingSelector
        status={av.shippingQuote?.status}
        errorCode={av.shippingQuote?.errorCode}
        express={av.shippingQuote?.express}
        estandar={av.shippingQuote?.estandar}
        rawRates={av.shippingQuote?.rawRates}
        selectedType={av.selectedShippingType}
        onSelect={av.handleSelectShippingType}
        onRetry={av.handleRetryQuote}
        onContactSeller={av.handleContactSeller}
      />
    );
  }

  if (av.isManualShipping) {
    return (
      <AVShippingSelector
        status="error"
        errorCode="ESPECIAL"
        express={null}
        estandar={null}
        rawRates={[]}
        selectedType={null}
        onSelect={() => {}}
        onRetry={() => {}}
        onContactSeller={av.handleContactSeller}
      />
    );
  }

  return null;
};

export default AVShippingSelectorSlot;
