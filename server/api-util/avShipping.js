'use strict';

const { types } = require('sharetribe-flex-sdk');
const { Money } = types;

// AV: shipping is NOT paid out to the provider. AV buys the eShip label centrally
// (the "Segmail" account is billed directly; see shipmentService.js), so the
// buyer's shipping payment is retained by the platform to cover the carrier cost
// and keep the markup. Provider commission is computed on ['order'] only, so this
// does not affect it (see lineItemHelpers.js getProviderCommissionMaybe).
// Rationale + payout reconciliation: docs/integrations/eship.md.
const AV_SHIPPING_FEE_INCLUDE_FOR = ['customer'];

/**
 * Resolve the server-authoritative shipping fee for an 'item' order line.
 *
 * The client-sent price is never trusted: a cache hit on `avQuoteToken` pins the
 * quoted rate, a miss re-quotes eShip from scratch.
 *
 * Only resolves once the buyer has actually chosen a delivery type — the initial
 * speculate (on checkout load) has no type/token/destination yet, and quoting then
 * would hit eShip with no address and fail the whole speculation.
 *
 * Callers that already resolved the rate (the privileged endpoints, via
 * `resolveAvShippingForOrder`) pass it through `options.resolvedShippingRate` so it
 * is not quoted twice — including an explicit `null`, which means "resolved to
 * nothing", not "not resolved yet".
 *
 * @param {Object} params
 * @param {Function} params.resolveBucketPrice - shippingQuoteService.resolveBucketPrice
 * @param {Object} params.orderData
 * @param {string} params.currency - listing currency, used when the rate omits one
 * @param {Object} params.listing
 * @param {Object} [params.options] - may carry a pre-resolved `resolvedShippingRate`
 * @returns {Promise<Money|null>} the shipping fee, or null when the order doesn't ship
 */
async function resolveAvShippingFee({ resolveBucketPrice, orderData, currency, listing, options }) {
  const isShipping = orderData?.deliveryMethod === 'shipping';
  if (!isShipping) {
    return null;
  }

  const opts = options || {};
  const hasPreResolvedRate = Object.prototype.hasOwnProperty.call(opts, 'resolvedShippingRate');
  const resolved = hasPreResolvedRate
    ? opts.resolvedShippingRate
    : orderData?.avShippingType
    ? await resolveBucketPrice({
        quoteToken: orderData.avQuoteToken,
        avShippingType: orderData.avShippingType,
        listing,
        destination: orderData.avDestination,
        buyerEmail: orderData.buyerEmail,
      })
    : null;

  return resolved ? new Money(resolved.amountSubunits, resolved.currency || currency) : null;
}

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

// Resolve the authoritative shipping rate for one privileged call.
//
// This is the whole AV shipping concern for `initiate-privileged` and
// `transition-privileged`, kept here so those two upstream files only need a
// single call each (they were carrying ~30 identical lines apiece).
//
// The client-sent price is never trusted: `resolveBucketPrice` either replays the
// cached quote for `quoteToken` or re-quotes eShip from scratch on a cache miss.
//
// Returns `{ resolvedRate, avShippingProtectedData }`. Throws
// `ShippingQuoteRequiredError` when a real (non-speculative) shipping order has
// no usable destination or rate, so the buyer can't pay without a priced label.
async function resolveAvShippingForOrder({
  resolveBucketPrice,
  listing,
  fullOrderData,
  isSpeculative,
}) {
  const isShipping = fullOrderData?.deliveryMethod === 'shipping';
  if (!isShipping) {
    return { resolvedRate: null, avShippingProtectedData: {} };
  }

  const destination = authoritativeShippingDestination(fullOrderData, isSpeculative);
  const resolvedRate = fullOrderData.avShippingType
    ? await resolveBucketPrice({
        quoteToken: fullOrderData.avQuoteToken,
        avShippingType: fullOrderData.avShippingType,
        listing,
        destination,
        buyerEmail: fullOrderData.buyerEmail,
      })
    : null;

  if (!isSpeculative && (!destination || !resolvedRate)) {
    throw new ShippingQuoteRequiredError();
  }

  return {
    resolvedRate,
    avShippingProtectedData: buildAvShippingProtectedData(fullOrderData, resolvedRate),
  };
}

// Merge the resolved eShip rate into the outgoing transaction params without
// clobbering protectedData the caller already set. No-op when nothing resolved.
function withAvShippingProtectedData(params, avShippingProtectedData) {
  if (!avShippingProtectedData || Object.keys(avShippingProtectedData).length === 0) {
    return {};
  }
  return { protectedData: { ...params?.protectedData, ...avShippingProtectedData } };
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
  AV_SHIPPING_FEE_INCLUDE_FOR,
  resolveAvShippingFee,
  authoritativeShippingDestination,
  buildAvShippingProtectedData,
  destinationFromShippingDetails,
  resolveAvShippingForOrder,
  withAvShippingProtectedData,
  ShippingQuoteRequiredError,
};
