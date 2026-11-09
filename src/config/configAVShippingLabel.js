'use strict';

// AV shipping-label eligibility (audit A01) — CommonJS so BOTH the label
// purchase (server/services/shipmentService.js, plain Node) and the sale page's
// "Generar guía" control (TransactionPage/AVShippingLabelMaybe, via webpack
// interop) apply one rule. The control therefore never offers a label that the
// server would refuse. Current behavior: docs/integrations/eship.md §5.2.

const LABEL_BUY_TRANSITION = 'transition/confirm-payment';
const SHIPPING_FEE_LINE_ITEM = 'line-item/shipping-fee';
// The only post-payment transition in default-purchase that lets the customer
// rewrite protectedData (`action/update-protected-data`).
const CUSTOMER_PROTECTED_DATA_REWRITES = ['transition/dispute'];
const CANCEL_TRANSITION = /(^|\/)(?:auto-|operator-)?cancel/;

// Every transition the transaction has been through, oldest first.
const transitionNames = tx => {
  const attrs = tx?.attributes || {};
  const history = (attrs.transitions || []).map(item => item?.transition || item).filter(Boolean);
  return attrs.lastTransition ? [...history, attrs.lastTransition] : history;
};

// Paid and never cancelled.
function isLabelPurchaseAllowed(tx) {
  const transitions = transitionNames(tx);
  const hasPaid = transitions.includes(LABEL_BUY_TRANSITION);
  const hasCancellation = transitions.some(name => CANCEL_TRANSITION.test(name));
  return hasPaid && !hasCancellation;
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

/**
 * The shipping record a label purchase may trust.
 *
 * `metadata.avShipping` is written by the privileged server after initiation
 * and cannot be changed by either party. Transactions created before that
 * record existed (or whose metadata write failed) fall back to the
 * protectedData copy, which the privileged request-payment call overwrites for
 * shipping orders — but only while no customer transition could have rewritten
 * it since. Either way a purchase still requires a matching shipping charge.
 *
 * @returns {{ record: Object|null, source: 'metadata'|'legacy'|'legacy_rewritable'|null }}
 */
function resolveLabelShippingRecord(tx) {
  const attrs = tx?.attributes || {};
  if (attrs.metadata?.avShipping) {
    return { record: attrs.metadata.avShipping, source: 'metadata' };
  }
  const legacy = attrs.protectedData?.avShipping;
  if (!legacy) return { record: null, source: null };
  const rewritable = transitionNames(tx).some(name =>
    CUSTOMER_PROTECTED_DATA_REWRITES.includes(name)
  );
  return rewritable
    ? { record: null, source: 'legacy_rewritable' }
    : { record: legacy, source: 'legacy' };
}

// The record a label may be bought with — trusted and matching what the buyer
// was charged — or null.
function labelShippingRecord(tx) {
  const { record } = resolveLabelShippingRecord(tx);
  return record && shippingChargeMatches(tx?.attributes?.lineItems, record) ? record : null;
}

module.exports = {
  LABEL_BUY_TRANSITION,
  SHIPPING_FEE_LINE_ITEM,
  findShippingFeeLineItem,
  isLabelPurchaseAllowed,
  labelShippingRecord,
  resolveLabelShippingRecord,
  shippingChargeMatches,
  transitionNames,
};
