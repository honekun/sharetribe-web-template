import { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import debounce from 'lodash/debounce';

import { pathByRouteName } from '../../util/routes';
import { createSlug } from '../../util/urlHelpers';
import { resolvePackageSize, isEspecialSize } from '../../config/configAVShipping';
// AV shipping: "contact the seller" reuses the ListingPage inquiry-modal flow
import { setInitialValues as setListingPageInitialValues } from '../ListingPage/ListingPage.duck';
import { fetchShippingQuote } from './shippingQuote.duck';
import { getEshipDestinationFromValues } from './avMxAddress';
import { hasTransactionPassedPendingPayment } from './CheckoutPageTransactionHelpers.js';

/**
 * AV: how long to wait after the last shipping-address edit before quoting eShip,
 * so typing an already-complete address doesn't fire one request per keystroke.
 */
const QUOTE_DEBOUNCE_MS = 600;

/**
 * AV shipping: live eShip quote for the checkout page.
 *
 * The buyer enters their destination in the payment form; we quote once it is
 * complete and offer Express/Estándar plus the raw rate list. `especial`-sized
 * listings have no automatic quote and fall back to "Contactar AV".
 *
 * All of this lives here rather than inside the upstream
 * `CheckoutPageWithPayment.js` so that file stays close to
 * `sharetribe/web-template` and merges cheaply.
 *
 * @param {Object} params
 * @param {boolean} params.isPurchase
 * @param {string} params.effectiveDeliveryMethod - from `avEffectiveDeliveryMethod`
 * @param {Object} params.listing
 * @param {string} params.listingTitle
 * @param {Object} params.currentUser
 * @param {Object} params.pageData
 * @param {Object} params.existingTransaction
 * @param {Object} params.process
 * @param {Object} params.history
 * @param {Array} params.routeConfiguration
 * @param {Function} params.onSelectShippingType - called with the next pageData when
 *   the buyer picks a bucket; the caller persists it and re-speculates so the
 *   "Shipping fee" row updates before payment.
 * @returns {Object} quote state + handlers for StripePaymentForm
 */
export const useAvShippingQuote = ({
  isPurchase,
  effectiveDeliveryMethod,
  listing,
  listingTitle,
  currentUser,
  pageData,
  existingTransaction,
  process,
  history,
  routeConfiguration,
  onSelectShippingType,
}) => {
  const dispatch = useDispatch();

  // The buyer must choose a delivery type before paying. The choice is persisted
  // into pageData.orderData.avShippingType (flows through getOrderParams →
  // speculate/initiate) so the server recomputes the shipping fee.
  const [selectedShippingType, setSelectedShippingType] = useState(
    pageData?.orderData?.avShippingType || null
  );
  // { status, quoteToken, express, estandar, rawRates, errorCode }
  const shippingQuote = useSelector(state => state.shippingQuote);

  const avPackageSize = resolvePackageSize(listing?.attributes?.publicData);
  const isShippingStage =
    isPurchase &&
    effectiveDeliveryMethod === 'shipping' &&
    !hasTransactionPassedPendingPayment(existingTransaction, process);
  const isAvShipping = isShippingStage && !isEspecialSize(avPackageSize);
  const isManualShipping = isShippingStage && isEspecialSize(avPackageSize);

  const buyerEmail = currentUser?.attributes?.email || null;
  const listingId = listing?.id?.uuid;
  const lastDestinationRef = useRef(null);

  // Debounced quote dispatch. FormSpy fires handleShippingValuesChange on every
  // keystroke, so while the buyer edits an already-complete address each change
  // would otherwise hit the eShip API. Coalesce rapid edits into a single fetch
  // once typing settles. Built once (stable dispatch ref); the latest args win
  // because lodash debounce invokes with the most recent call's args.
  const debouncedQuoteRef = useRef(null);
  if (debouncedQuoteRef.current === null) {
    debouncedQuoteRef.current = debounce(args => {
      dispatch(fetchShippingQuote(args));
    }, QUOTE_DEBOUNCE_MS);
  }
  const debouncedQuote = debouncedQuoteRef.current;
  // Cancel any pending quote if the buyer leaves checkout mid-type.
  useEffect(() => () => debouncedQuote.cancel(), [debouncedQuote]);

  // Quote (or re-quote) whenever the buyer's destination changes to a new complete
  // value. Clears any prior delivery-type selection immediately (so a stale pick
  // can't be paid mid-edit) and debounces the actual fetch. Driven by
  // StripePaymentForm's FormSpy via onShippingValuesChange.
  const handleShippingValuesChange = useCallback(
    formValues => {
      if (!isAvShipping) return;
      const destination = getEshipDestinationFromValues(formValues);
      const key = destination ? JSON.stringify(destination) : null;
      const prevKey = lastDestinationRef.current
        ? JSON.stringify(lastDestinationRef.current)
        : null;
      if (!key || key === prevKey) return;
      lastDestinationRef.current = destination;
      setSelectedShippingType(null);
      debouncedQuote({ listingId, destination, buyerEmail });
    },
    [isAvShipping, debouncedQuote, listingId, buyerEmail]
  );

  const handleRetryQuote = useCallback(() => {
    if (lastDestinationRef.current) {
      dispatch(
        fetchShippingQuote({
          listingId,
          destination: lastDestinationRef.current,
          buyerEmail,
        })
      );
    }
  }, [dispatch, listingId, buyerEmail]);

  const handleSelectShippingType = useCallback(
    type => {
      setSelectedShippingType(type);
      onSelectShippingType({
        ...pageData,
        orderData: {
          ...pageData.orderData,
          avShippingType: type,
          avQuoteToken: shippingQuote?.quoteToken || null,
          avDestination: lastDestinationRef.current || null,
          buyerEmail,
        },
      });
    },
    [onSelectShippingType, pageData, shippingQuote, buyerEmail]
  );

  // Let the buyer message the seller to confirm the shipping date. Reuses the
  // ListingPage inquiry-modal flow — pre-set the modal flag, then navigate to the
  // listing page where the inquiry modal opens automatically.
  const handleContactSeller =
    listingId && history && routeConfiguration
      ? () => {
          dispatch(setListingPageInitialValues({ inquiryModalOpenForListingId: listingId }));
          history.push(
            pathByRouteName('ListingPage', routeConfiguration, {
              id: listingId,
              slug: createSlug(listingTitle),
            })
          );
        }
      : null;

  return {
    isAvShipping,
    isManualShipping,
    selectedShippingType,
    shippingQuote,
    handleShippingValuesChange,
    handleRetryQuote,
    handleSelectShippingType,
    handleContactSeller,
    // The Pay button stays disabled until a bucket is chosen (or forever, for
    // `especial` listings, which have to be arranged by hand).
    submitDisabled: isManualShipping || (isAvShipping && !selectedShippingType),
  };
};
