'use strict';

// Shape the chosen eShip rate for persistence on the transaction. Read back by
// the label-generation step (Spec B) and seller surplus/payout logic.
function buildAvShippingProtectedData(orderData, resolvedRate) {
  if (!resolvedRate) return {};
  const rate = resolvedRate.rate || {};
  return {
    avShipping: {
      bucket: orderData?.avShippingType || null,
      quot_id: rate.quot_id || null,
      rate_id: rate.rate_id || null,
      carrier: rate.carrier || null,
      servicelevel: rate.servicelevel || null,
      amountSubunits: resolvedRate.amountSubunits,
      currency: resolvedRate.currency,
    },
  };
}

// The checkout UI sends avDestination to support speculative pricing, but the
// address trusted for a real transaction is the shippingDetails object that is
// persisted by Sharetribe. Keeping this conversion server-side prevents a
// client from quoting one destination and paying with another.
function destinationFromShippingDetails(shippingDetails) {
  const address = shippingDetails?.address;
  if (
    !shippingDetails?.name ||
    !address?.line1 ||
    !address?.city ||
    !address?.state ||
    !address?.postalCode
  ) {
    return null;
  }
  return {
    name: shippingDetails.name,
    street1: address.line1,
    street2: address.line2 || '',
    city: address.city,
    state: address.state,
    zip: address.postalCode,
    country: address.country || 'MX',
    phone: shippingDetails.phoneNumber || '',
  };
}

function authoritativeShippingDestination(fullOrderData, isSpeculative) {
  if (isSpeculative) return fullOrderData?.avDestination || null;
  return destinationFromShippingDetails(fullOrderData?.protectedData?.shippingDetails);
}

class ShippingQuoteRequiredError extends Error {
  constructor() {
    super('A valid shipping quote and destination are required before payment');
    this.name = 'ShippingQuoteRequiredError';
    this.status = 422;
    this.statusText = this.message;
    this.data = { code: 'SHIPPING_QUOTE_REQUIRED' };
  }
}

module.exports = {
  authoritativeShippingDestination,
  buildAvShippingProtectedData,
  destinationFromShippingDetails,
  ShippingQuoteRequiredError,
};
