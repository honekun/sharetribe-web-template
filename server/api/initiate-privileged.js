const sharetribeSdk = require('sharetribe-flex-sdk');
const { transactionLineItems } = require('../api-util/lineItems');
const { resolveBucketPrice } = require('../services/shippingQuoteService');
const {
  authoritativeShippingDestination,
  buildAvShippingProtectedData,
  ShippingQuoteRequiredError,
} = require('../api-util/avShipping');
const { isIntentionToMakeOffer } = require('../api-util/negotiation');
const {
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');

const { Money } = sharetribeSdk.types;

// Author relationship is part of the server-side quote binding and is required
// for a safe cache-miss re-quote.
const listingPromise = (sdk, id) => sdk.listings.show({ id, include: ['author'] });

const getFullOrderData = (orderData, bodyParams, currency) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams.transition;

  return isIntentionToMakeOffer(offerInSubunits, transitionName)
    ? {
        ...orderData,
        ...bodyParams.params,
        currency,
        offer: new Money(offerInSubunits, currency),
      }
    : { ...orderData, ...bodyParams.params };
};

const getMetadata = (orderData, transition) => {
  const { actor, offerInSubunits } = orderData || {};
  // NOTE: for now, the actor is always "provider".
  const hasActor = ['provider', 'customer'].includes(actor);
  const by = hasActor ? actor : null;

  return isIntentionToMakeOffer(offerInSubunits, transition)
    ? {
        metadata: {
          offers: [
            {
              offerInSubunits,
              by,
              transition,
            },
          ],
        },
      }
    : {};
};

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body || {};
  const transitionName = bodyParams.transition;
  const sdk = getSdk(req, res);
  let lineItems = null;
  let metadataMaybe = {};
  // AV: persist the chosen eShip rate so the label step + payout logic can read it.
  let avShippingProtectedData = {};

  Promise.all([listingPromise(sdk, bodyParams?.params?.listingId), fetchCommission(sdk)])
    .then(async ([showListingResponse, fetchAssetsResponse]) => {
      const listing = showListingResponse.data.data;
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const currency = listing.attributes.price?.currency || orderData.currency;
      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      const fullOrderData = getFullOrderData(orderData, bodyParams, currency);
      const isShipping = fullOrderData.deliveryMethod === 'shipping';
      const destination = isShipping
        ? authoritativeShippingDestination(fullOrderData, isSpeculative)
        : null;
      const resolvedRate =
        isShipping && fullOrderData.avShippingType
          ? await resolveBucketPrice({
              quoteToken: fullOrderData.avQuoteToken,
              avShippingType: fullOrderData.avShippingType,
              listing,
              destination,
              buyerEmail: fullOrderData.buyerEmail,
            })
          : null;

      if (!isSpeculative && isShipping && (!destination || !resolvedRate)) {
        throw new ShippingQuoteRequiredError();
      }

      lineItems = await transactionLineItems(
        listing,
        fullOrderData,
        providerCommission,
        customerCommission,
        { resolvedShippingRate: resolvedRate }
      );
      metadataMaybe = getMetadata(orderData, transitionName);

      if (isShipping) {
        avShippingProtectedData = buildAvShippingProtectedData(fullOrderData, resolvedRate);
      }

      return getTrustedSdk(req);
    })
    .then(trustedSdk => {
      const { params } = bodyParams;

      // Add lineItems to the body params
      const avShippingMaybe = Object.keys(avShippingProtectedData).length
        ? { protectedData: { ...params.protectedData, ...avShippingProtectedData } }
        : {};
      const body = {
        ...bodyParams,
        params: {
          ...params,
          lineItems,
          ...metadataMaybe,
          ...avShippingMaybe,
        },
      };

      if (isSpeculative) {
        return trustedSdk.transactions.initiateSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.initiate(body, queryParams);
    })
    .then(apiResponse => {
      const { status, statusText, data } = apiResponse;
      res
        .status(status)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status,
            statusText,
            data,
          })
        )
        .end();
    })
    .catch(e => {
      handleError(res, e);
    });
};
