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

module.exports = { buildAvShippingProtectedData };
