const { transactionLineItems } = require('../api-util/lineItems');
const { getSdk, handleError, serialize, fetchCommission } = require('../api-util/sdk');
const { constructValidLineItems } = require('../api-util/lineItemHelpers');
const { findListingAuthor, resolveProviderCommission } = require('../api-util/providerCommission');

module.exports = (req, res) => {
  const { isOwnListing, listingId, orderData } = req.body || {};

  const sdk = getSdk(req, res);

  // AV: the author carries the per-seller commission override.
  const listingPromise = () =>
    isOwnListing
      ? sdk.ownListings.show({ id: listingId, include: ['author'] })
      : sdk.listings.show({ id: listingId, include: ['author'] });

  Promise.all([listingPromise(), fetchCommission(sdk)])
    .then(async ([showListingResponse, fetchAssetsResponse]) => {
      const listing = showListingResponse.data.data;
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      const author = findListingAuthor(listing, showListingResponse.data.included);
      const lineItems = await transactionLineItems(
        listing,
        orderData,
        resolveProviderCommission(providerCommission, author),
        customerCommission
      );

      // Because we are using returned lineItems directly in this template we need to use the helper function
      // to add some attributes like lineTotal and reversal that Marketplace API also adds to the response.
      const validLineItems = constructValidLineItems(lineItems);

      res
        .status(200)
        .set('Content-Type', 'application/transit+json')
        .send(serialize({ data: validLineItems }))
        .end();
    })
    .catch(e => {
      handleError(res, e);
    });
};
