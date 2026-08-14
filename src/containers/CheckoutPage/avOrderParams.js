import { PURCHASE_PROCESS_NAME } from '../../transactions/transaction';

/**
 * AV: order-param helpers for the eShip shipping flow.
 *
 * Kept out of the upstream `CheckoutPageWithPayment.js` so that file stays as
 * close to `sharetribe/web-template` as possible and upstream merges stay cheap.
 */

/**
 * AV: every product ships. The Console listingType shipping setting is always
 * off, so OrderPanel emits deliveryMethod 'none' (or nothing). For purchases,
 * treat anything that isn't an explicit 'pickup' as 'shipping' so the server
 * computes the shipping fee and the delivery-type selector engages. An explicit
 * 'pickup' is still respected.
 *
 * Used both by `getOrderParams` (via the listing's transactionProcessAlias) and
 * by the checkout component (via its already-resolved `isPurchase`), so the two
 * can never disagree about whether the order ships.
 *
 * @param {string} rawDeliveryMethod - orderData.deliveryMethod
 * @param {boolean} isPurchaseProcess
 * @returns {string|undefined}
 */
export const avEffectiveDeliveryMethod = (rawDeliveryMethod, isPurchaseProcess) => {
  if (!isPurchaseProcess) {
    return rawDeliveryMethod;
  }
  return rawDeliveryMethod === 'pickup' ? 'pickup' : 'shipping';
};

/**
 * Same decision, resolved straight from pageData (the `getOrderParams` path,
 * which has no `isPurchase` flag to hand).
 *
 * @param {Object} pageData
 * @returns {string|undefined}
 */
export const avDeliveryMethodFromPageData = pageData => {
  const transactionProcessAlias =
    pageData?.listing?.attributes?.publicData?.transactionProcessAlias || '';
  const isPurchaseProcess = transactionProcessAlias.split('/')[0] === PURCHASE_PROCESS_NAME;
  return avEffectiveDeliveryMethod(pageData?.orderData?.deliveryMethod, isPurchaseProcess);
};

/**
 * AV shipping: the selected delivery type drives the server-side shipping fee and
 * is persisted into protectedData for later label generation (Spec B). The quote
 * token (cache key) + destination let the server resolve — or re-quote — the fee.
 *
 * @param {Object} orderData - pageData.orderData
 * @returns {{ avShippingType?: string, avQuoteToken?: string, avDestination?: Object, buyerEmail?: string }}
 */
export const avShippingOrderParams = orderData => {
  const { avShippingType, avQuoteToken, avDestination, buyerEmail } = orderData || {};
  return {
    ...(avShippingType ? { avShippingType } : {}),
    ...(avQuoteToken ? { avQuoteToken } : {}),
    ...(avDestination ? { avDestination } : {}),
    ...(buyerEmail ? { buyerEmail } : {}),
  };
};

/**
 * Only the chosen bucket is persisted on the transaction's protectedData — the
 * quote token and raw destination are request-scoped and stay out of it.
 *
 * @param {Object} orderData - pageData.orderData
 * @returns {{ avShippingType?: string }}
 */
export const avShippingProtectedData = orderData => {
  const avShippingType = orderData?.avShippingType;
  return avShippingType ? { avShippingType } : {};
};
