'use strict';

const { types } = require('sharetribe-flex-sdk');
const integrationSdkTypes = require('sharetribe-flex-integration-sdk').types;
const { withRetry } = require('../services/retry');

const { Money } = types;

// The transaction key that carries the chosen eShip rate. Clients may never
// author it: the protectedData copy is informational, and the label step trusts
// the server-written `metadata.avShipping` record (see recordAvShippingMetadata).
const AV_SHIPPING_KEY = 'avShipping';
const SHIPPING_FEE_LINE_ITEM = 'line-item/shipping-fee';

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

// Shape the chosen eShip rate for persistence on the transaction. The
// protectedData copy is display-only; the label step reads the server-written
// metadata record built by buildAvShippingRecord.
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

// The authoritative shipping record written to transaction metadata after a
// successful privileged initiate/transition. Same fields as the protectedData
// copy plus when it was recorded.
function buildAvShippingRecord(orderData, resolvedRate, now = new Date()) {
  const { avShipping } = buildAvShippingProtectedData(orderData, resolvedRate);
  return avShipping ? { ...avShipping, recordedAt: now.toISOString() } : null;
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
// Returns `{ resolvedRate, avShippingProtectedData, avShippingRecord }`; the
// record is only built for a real (non-speculative) shipping order. Throws
// `ShippingQuoteRequiredError` when a real shipping order has no usable
// destination or rate, so the buyer can't pay without a priced label.
async function resolveAvShippingForOrder({
  resolveBucketPrice,
  listing,
  fullOrderData,
  isSpeculative,
}) {
  const isShipping = fullOrderData?.deliveryMethod === 'shipping';
  if (!isShipping) {
    return { resolvedRate: null, avShippingProtectedData: {}, avShippingRecord: null };
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
    avShippingRecord: isSpeculative ? null : buildAvShippingRecord(fullOrderData, resolvedRate),
  };
}

// Merge the resolved eShip rate into the outgoing transaction params without
// clobbering the rest of the caller's protectedData. A caller-supplied
// `avShipping` is always dropped, even when nothing resolved (pickup orders):
// the key is reserved for the server.
function withAvShippingProtectedData(params, avShippingProtectedData) {
  const clientProtectedData = params?.protectedData;
  const hasClientCopy =
    !!clientProtectedData &&
    Object.prototype.hasOwnProperty.call(clientProtectedData, AV_SHIPPING_KEY);
  const hasPatch = !!avShippingProtectedData && Object.keys(avShippingProtectedData).length > 0;
  if (!hasClientCopy && !hasPatch) {
    return {};
  }
  const { [AV_SHIPPING_KEY]: _ignoredClientCopy, ...rest } = clientProtectedData || {};
  return { protectedData: { ...rest, ...(hasPatch ? avShippingProtectedData : {}) } };
}

const toIntegrationUuid = id => {
  const uuid = typeof id === 'string' ? id : id?.uuid;
  return uuid ? new integrationSdkTypes.UUID(uuid) : null;
};

/**
 * Write the authoritative shipping record to `metadata.avShipping`. Metadata is
 * operator-only, so neither party can replace it later (protectedData can be
 * rewritten by customer transitions such as `transition/dispute`).
 *
 * Never throws: the transaction already exists, so a failed write is logged and
 * the label step falls back to its stricter legacy checks.
 *
 * @returns {Promise<boolean>} whether the record was written
 */
async function recordAvShippingMetadata(integrationSdk, transactionId, record) {
  const id = toIntegrationUuid(transactionId);
  if (!record || !id) return false;
  try {
    await withRetry(
      () => integrationSdk.transactions.updateMetadata({ id, metadata: { avShipping: record } }),
      {
        label: 'avShipping metadata',
        // A 4xx will not succeed on a second try; network errors, 5xx and 429 may.
        shouldRetry: error => !error?.status || error.status >= 500 || error.status === 429,
      }
    );
    return true;
  } catch (error) {
    console.error(
      `[avShipping] could not record the shipping rate for transaction ${id.uuid}:`,
      error?.message || error
    );
    return false;
  }
}

// One-call seam for the privileged endpoints: after a real initiate/transition,
// record the rate and hand the API response back unchanged. Never rejects.
async function persistAvShippingRecord(apiResponse, record, transactionId) {
  if (record) {
    try {
      const { getIntegrationSdk } = require('../services/integrationSdk');
      await recordAvShippingMetadata(
        getIntegrationSdk(),
        transactionId || apiResponse?.data?.data?.id,
        record
      );
    } catch (error) {
      console.error('[avShipping] shipping record not written:', error?.message || error);
    }
  }
  return apiResponse;
}

// The buyer's shipping charge as set by the privileged line-item calculation:
// a non-reversal `line-item/shipping-fee` that the customer pays.
function findShippingFeeLineItem(lineItems) {
  return (
    (lineItems || []).find(
      item =>
        item?.code === SHIPPING_FEE_LINE_ITEM &&
        !item.reversal &&
        (item.includeFor || []).includes('customer')
    ) || null
  );
}

// Does the transaction actually charge the buyer the recorded shipping price?
// Line items are only ever set by the privileged server, so this binds a label
// purchase to money that was collected.
function shippingChargeMatches(lineItems, record) {
  const fee = findShippingFeeLineItem(lineItems);
  const total = fee?.lineTotal || fee?.unitPrice;
  if (!total || !record) return false;
  return (
    Number.isSafeInteger(record.amountSubunits) &&
    total.amount === record.amountSubunits &&
    total.currency === record.currency
  );
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
  AV_SHIPPING_KEY,
  resolveAvShippingFee,
  authoritativeShippingDestination,
  buildAvShippingProtectedData,
  buildAvShippingRecord,
  destinationFromShippingDetails,
  findShippingFeeLineItem,
  persistAvShippingRecord,
  recordAvShippingMetadata,
  resolveAvShippingForOrder,
  shippingChargeMatches,
  withAvShippingProtectedData,
  ShippingQuoteRequiredError,
};
