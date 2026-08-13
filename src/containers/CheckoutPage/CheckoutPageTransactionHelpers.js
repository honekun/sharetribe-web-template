// Import contexts and util modules
import { findRouteByRouteName } from '../../util/routes';
import { ensureStripeCustomer, ensureTransaction } from '../../util/data';
import { formatMoney } from '../../util/currency';
import { NEGOTIATION_PROCESS_NAME, resolveLatestProcessName } from '../../transactions/transaction';
import { storeData } from './CheckoutPageSessionHelpers';

/**
 * Extract relevant transaction type data from listing type
 * Note: this is saved to protectedData of the transaction entity
 *       therefore, we don't need the process name (nor alias)
 *
 * @param {Object} listingType
 * @param {String} unitTypeInPublicData
 * @param {Object} config
 * @returns object containing unitType etc. - or an empty object.
 */
export const getTransactionTypeData = (listingType, unitTypeInPublicData, config) => {
  const listingTypeConfig = config.listing.listingTypes.find(lt => lt.listingType === listingType);
  const { process, alias, unitType, ...rest } = listingTypeConfig?.transactionType || {};
  // Note: we want to rely on unitType written in public data of the listing entity.
  //       The listingType configuration might have changed on the fly.
  return unitTypeInPublicData ? { unitType: unitTypeInPublicData, ...rest } : {};
};

/**
 * This just makes it easier to transfrom bookingDates object if needed
 * (or manibulate bookingStart and bookingEnd)
 *
 * @param {Object} bookingDates
 * @returns object containing bookingDates or an empty object.
 */
export const bookingDatesMaybe = bookingDates => {
  return bookingDates ? { bookingDates } : {};
};

/**
 * Construct billing details (JSON-like object) for the Stripe API.
 *
 * AV: the billing address uses the same MX field set as the shipping address
 * (the ShippingDetails component with the `billing` prefix), so we compose the
 * granular fields (Calle + Número Exterior [Int.] → line1, Colonia → line2) into
 * Stripe's flat address, country hardcoded to 'MX'.
 *
 * @param {Object} formValues - billingName/billingAddressLine1/billingExteriorNumber/
 *   billingInteriorNumber/billingColonia/billingPostal/billingCity/billingState
 * @param {Object} currentUser
 * @returns Object that contains name, email and potentially address data for the Stripe API
 */
export const getBillingDetails = (formValues, currentUser) => {
  const {
    billingName,
    billingAddressLine1,
    billingExteriorNumber,
    billingInteriorNumber,
    billingColonia,
    billingPostal,
    billingCity,
    billingState,
  } = formValues;

  const streetBase = [billingAddressLine1, billingExteriorNumber].filter(Boolean).join(' ');
  const line1 = billingInteriorNumber ? `${streetBase} Int. ${billingInteriorNumber}` : streetBase;

  // Billing address is recommended but optional — only include it once the buyer
  // has filled the minimum fields.
  const addressMaybe =
    billingAddressLine1 && billingPostal
      ? {
          address: {
            city: billingCity,
            country: 'MX',
            line1,
            line2: billingColonia,
            postal_code: billingPostal,
            state: billingState,
          },
        }
      : {};
  return {
    name: billingName,
    email: currentUser?.attributes?.email,
    ...addressMaybe,
  };
};

/**
 * Get formatted total price (payinTotal)
 *
 * @param {Object} transaction
 * @param {Object} intl
 * @returns formatted money as a string.
 */
export const getFormattedTotalPrice = (transaction, intl) => {
  const totalPrice = transaction.attributes.payinTotal;
  return formatMoney(intl, totalPrice);
};

/**
 * Construct shipping details (JSON-like object)
 *
 * AV: Mexico-only shipping form. The MX-specific fields (Número Exterior/Interior,
 * Colonia) are composed into the standard `line1`/`line2` so the seller's transaction
 * panel (DeliveryInfoMaybe) renders a complete address with no changes, and are also
 * stored as structured keys (exteriorNumber/interiorNumber/colonia) so the data stays
 * lossless for shipping labels / bulk export. Country is hardcoded to 'MX'.
 *
 * @param {Object} formValues object containing saveAfterOnetimePayment, recipientName,
 * recipientPhoneNumber, recipientAddressLine1 (Calle), recipientExteriorNumber,
 * recipientInteriorNumber, recipientColonia, recipientPostal, recipientCity, and
 * recipientState.
 * @returns shippingDetails object containing name, phoneNumber and address
 */
export const getShippingDetailsMaybe = formValues => {
  const {
    saveAfterOnetimePayment: saveAfterOnetimePaymentRaw,
    recipientName,
    recipientPhoneNumber,
    recipientAddressLine1,
    recipientExteriorNumber,
    recipientInteriorNumber,
    recipientColonia,
    recipientPostal,
    recipientCity,
    recipientState,
  } = formValues;

  // Compose the human-readable street line: "Calle Ext [Int. X]".
  const street = [recipientAddressLine1, recipientExteriorNumber].filter(Boolean).join(' ');
  const line1 = recipientInteriorNumber ? `${street} Int. ${recipientInteriorNumber}` : street;

  return recipientName && recipientAddressLine1 && recipientPostal
    ? {
        shippingDetails: {
          name: recipientName,
          phoneNumber: recipientPhoneNumber,
          address: {
            city: recipientCity,
            country: 'MX',
            line1,
            line2: recipientColonia,
            postalCode: recipientPostal,
            state: recipientState,
            // Structured MX fields (lossless; not displayed by DeliveryInfoMaybe).
            exteriorNumber: recipientExteriorNumber,
            interiorNumber: recipientInteriorNumber,
            colonia: recipientColonia,
          },
        },
      }
    : {};
};

/**
 * Build the eShip destination address from the MX shipping form values. Mirrors
 * the composition in `getShippingDetailsMaybe` (street1 = Calle + Ext [Int.], line2
 * = Colonia) so the live quote and the persisted order agree. Returns `null` until
 * the minimum quotable fields (street1 + postal + state + city) are present.
 *
 * @param {Object} formValues - the StripePaymentForm values (recipient* fields)
 * @returns {Object|null} { name, street1, street2, city, state, zip, country, phone }
 */
export const getEshipDestinationFromValues = formValues => {
  const {
    recipientName,
    recipientPhoneNumber,
    recipientAddressLine1,
    recipientExteriorNumber,
    recipientInteriorNumber,
    recipientColonia,
    recipientPostal,
    recipientCity,
    recipientState,
  } = formValues || {};

  const streetBase = [recipientAddressLine1, recipientExteriorNumber].filter(Boolean).join(' ');
  const street1 = recipientInteriorNumber
    ? `${streetBase} Int. ${recipientInteriorNumber}`
    : streetBase;

  const complete =
    recipientAddressLine1 && recipientPostal && recipientState && recipientCity && recipientName;

  return complete
    ? {
        name: recipientName,
        street1,
        street2: recipientColonia || '',
        city: recipientCity,
        state: recipientState,
        zip: recipientPostal,
        country: 'MX',
        phone: recipientPhoneNumber || '',
      }
    : null;
};

/**
 * Check if the default payment method exists for the currentUser
 * @param {Boolean} stripeCustomerFetched
 * @param {Object} currentUser
 * @returns true if default payment method has been set
 */
export const hasDefaultPaymentMethod = (stripeCustomerFetched, currentUser) =>
  !!(
    stripeCustomerFetched &&
    currentUser?.stripeCustomer?.attributes?.stripeCustomerId &&
    currentUser?.stripeCustomer?.defaultPaymentMethod?.id
  );

/**
 * Check if payment is expired (PAYMENT_EXPIRED state).
 *
 * @param {Object} existingTransaction
 * @param {Object} process
 * @returns true if payment has expired.
 */
export const hasPaymentExpired = (existingTransaction, process) => {
  return process.getState(existingTransaction) === process.states.PAYMENT_EXPIRED;
};

/**
 * Check if the transaction has passed PENDING_PAYMENT state (assumes that process has that state)
 * @param {Object} tx
 * @param {Object} process
 * @returns true if the transaction has passed that state
 */
export const hasTransactionPassedPendingPayment = (tx, process) => {
  return process.hasPassedState(process.states.PENDING_PAYMENT, tx);
};

const persistTransaction = (order, pageData, storeData, setPageData, sessionStorageKey) => {
  // Store the returned transaction (order)
  if (order?.id) {
    // Store order.
    const { orderData, listing } = pageData;
    storeData(orderData, listing, order, sessionStorageKey);
    setPageData({ ...pageData, transaction: order });
  }
};

/**
 * Create call sequence for checkout with Stripe PaymentIntents.
 *
 * @param {Object} orderParams contains params for the initial order itself
 * @param {Object} extraPaymentParams contains extra params needed by one of the following calls in the checkout sequence
 * @returns Promise that goes through each step in the checkout sequence.
 */
export const processCheckoutWithPayment = (orderParams, extraPaymentParams) => {
  const {
    hasPaymentIntentUserActionsDone,
    isPaymentFlowUseSavedCard,
    isPaymentFlowPayAndSaveCard,
    onConfirmCardPayment,
    onConfirmPayment,
    onInitiateOrder,
    onSavePaymentMethod,
    pageData,
    paymentIntent,
    process,
    setPageData,
    sessionStorageKey,
    stripeCustomer,
    stripePaymentMethodId,
  } = extraPaymentParams;
  const storedTx = ensureTransaction(pageData.transaction);

  const ensuredStripeCustomer = ensureStripeCustomer(stripeCustomer);
  const processAlias = pageData?.listing?.attributes?.publicData?.transactionProcessAlias;

  let createdPaymentIntent = null;

  ////////////////////////////////////////////////
  // Step 1: initiate order                     //
  // by requesting payment from Marketplace API //
  ////////////////////////////////////////////////
  const fnRequestPayment = fnParams => {
    // fnParams should be { listingId, deliveryMethod?, quantity?, bookingDates?, paymentMethod?.setupPaymentMethodForSaving?, protectedData }
    const hasPaymentIntents = storedTx.attributes.protectedData?.stripePaymentIntents;

    const isOfferPendingInNegotiationProcess =
      resolveLatestProcessName(processAlias.split('/')[0]) === NEGOTIATION_PROCESS_NAME &&
      storedTx.attributes.state === `state/${process.states.OFFER_PENDING}`;

    const requestTransition =
      storedTx?.attributes?.lastTransition === process.transitions.INQUIRE
        ? process.transitions.REQUEST_PAYMENT_AFTER_INQUIRY
        : isOfferPendingInNegotiationProcess
        ? process.transitions.REQUEST_PAYMENT_TO_ACCEPT_OFFER
        : process.transitions.REQUEST_PAYMENT;
    const isPrivileged = process.isPrivileged(requestTransition);

    // If paymentIntent exists, order has been initiated previously.
    const orderPromise = hasPaymentIntents
      ? Promise.resolve(storedTx)
      : onInitiateOrder(fnParams, processAlias, storedTx.id, requestTransition, isPrivileged);

    return orderPromise.then(order => {
      // Store the returned transaction (order)
      persistTransaction(order, pageData, storeData, setPageData, sessionStorageKey);
      return order;
    });
  };

  //////////////////////////////////
  // Step 2: pay using Stripe SDK //
  //////////////////////////////////
  const fnConfirmCardPayment = fnParams => {
    // fnParams should be returned transaction entity
    const order = fnParams;

    const hasPaymentIntents = order?.attributes?.protectedData?.stripePaymentIntents;
    if (!hasPaymentIntents) {
      throw new Error(
        `Missing StripePaymentIntents key in transaction's protectedData. Check that your transaction process is configured to use payment intents.`
      );
    }

    const { stripePaymentIntentClientSecret } = hasPaymentIntents
      ? order.attributes.protectedData.stripePaymentIntents.default
      : null;

    const { stripe, card, billingDetails, paymentIntent } = extraPaymentParams;
    const stripeElementMaybe = !isPaymentFlowUseSavedCard ? { card } : {};

    // Note: For basic USE_SAVED_CARD scenario, we have set it already on API side, when PaymentIntent was created.
    // However, the payment_method is save here for USE_SAVED_CARD flow if customer first attempted onetime payment
    const paymentParams = !isPaymentFlowUseSavedCard
      ? {
          payment_method: {
            billing_details: billingDetails,
            card: card,
          },
        }
      : { payment_method: stripePaymentMethodId };

    const params = {
      stripePaymentIntentClientSecret,
      orderId: order?.id,
      stripe,
      ...stripeElementMaybe,
      paymentParams,
    };

    return hasPaymentIntentUserActionsDone
      ? Promise.resolve({ transactionId: order?.id, paymentIntent })
      : onConfirmCardPayment(params);
  };

  ///////////////////////////////////////////////////
  // Step 3: complete order                        //
  // by confirming payment against Marketplace API //
  ///////////////////////////////////////////////////
  const fnConfirmPayment = fnParams => {
    // fnParams should contain { paymentIntent, transactionId } returned in step 2
    // Remember the created PaymentIntent for step 5
    createdPaymentIntent = fnParams.paymentIntent;
    const transactionId = fnParams.transactionId;
    const transitionName = process.transitions.CONFIRM_PAYMENT;
    const isTransitionedAlready = storedTx?.attributes?.lastTransition === transitionName;
    const orderPromise = isTransitionedAlready
      ? Promise.resolve(storedTx)
      : onConfirmPayment(transactionId, transitionName, {});

    return orderPromise.then(order => {
      // Store the returned transaction (order)
      persistTransaction(order, pageData, storeData, setPageData, sessionStorageKey);
      return order;
    });
  };

  //////////////////////////////////////////////////////////
  // Step 4: optionally save card as defaultPaymentMethod //
  //////////////////////////////////////////////////////////
  const fnSavePaymentMethod = fnParams => {
    const pi = createdPaymentIntent || paymentIntent;
    const orderId = fnParams?.id;

    if (isPaymentFlowPayAndSaveCard) {
      return onSavePaymentMethod(ensuredStripeCustomer, pi.payment_method)
        .then(response => {
          if (response.errors) {
            return { orderId, paymentMethodSaved: false };
          }
          return { orderId, paymentMethodSaved: true };
        })
        .catch(e => {
          // Real error cases are catched already in paymentMethods page.
          return { orderId, paymentMethodSaved: false };
        });
    } else {
      return Promise.resolve({ orderId, paymentMethodSaved: true });
    }
  };

  // Here we create promise calls in sequence
  // This is pretty much the same as:
  // fnRequestPayment({...initialParams})
  //   .then(result => fnConfirmCardPayment({...result}))
  //   .then(result => fnConfirmPayment({...result}))
  const applyAsync = (acc, val) => acc.then(val);
  const composeAsync = (...funcs) => x => funcs.reduce(applyAsync, Promise.resolve(x));
  const handlePaymentIntentCreation = composeAsync(
    fnRequestPayment,
    fnConfirmCardPayment,
    fnConfirmPayment,
    fnSavePaymentMethod
  );

  return handlePaymentIntentCreation(orderParams);
};

/**
 * Initialize OrderDetailsPage with given initialValues.
 *
 * @param {Object} initialValues
 * @param {Object} routes
 * @param {Function} dispatch
 */
export const setOrderPageInitialValues = (initialValues, routes, dispatch) => {
  const OrderPage = findRouteByRouteName('OrderDetailsPage', routes);

  // Transaction is already created
  dispatch(OrderPage.setInitialValues(initialValues));
};
