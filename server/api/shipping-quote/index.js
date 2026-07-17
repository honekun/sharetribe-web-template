'use strict';

const express = require('express');
const { getSdk } = require('../../api-util/sdk');
const svc = require('../../services/shippingQuoteService');
const { describeEshipError } = require('../../api-util/eshipClient');

const router = express.Router();

// POST /api/shipping/quote  { listingId, destination, buyerEmail? }
router.post('/quote', express.json(), async (req, res) => {
  const { listingId, destination } = req.body || {};
  if (!listingId || !destination) {
    return res
      .status(400)
      .json({ code: 'BAD_REQUEST', message: 'listingId and destination are required' });
  }
  try {
    const sdk = getSdk(req, res);
    // include:['author'] is required — without it the Marketplace API omits the
    // `relationships` object entirely, so the seller's author id (needed to resolve
    // their shipping origin) is unavailable and every quote falsely returns NO_ORIGIN.
    const showRes = await sdk.listings.show({ id: listingId, include: ['author'] });
    const listing = showRes?.data?.data;
    const buyerEmail = req.body.buyerEmail || destination.email;
    const quote = await svc.quoteForCheckout({ listing, destination, buyerEmail });
    return res.status(200).json(quote);
  } catch (e) {
    if (e instanceof svc.NoOriginError) return res.status(409).json({ code: 'NO_ORIGIN' });
    if (e instanceof svc.EspecialError) return res.status(422).json({ code: 'ESPECIAL' });
    // The seller-origin lookup (Sharetribe Integration API) failed — distinct
    // from a carrier failure. Reported separately so a 404/creds mismatch isn't
    // mistaken for an eShip problem (as it was before this branch existed).
    if (e instanceof svc.OriginLookupError) {
      console.error('[shipping/quote] seller-origin lookup failed (Integration API):', e.message);
      const debug = String(process.env.ESHIP_API_DEBUG).toLowerCase() === 'true';
      const detailMaybe = debug ? { detail: e.message, originStatus: e.status } : {};
      return res.status(502).json({ code: 'ORIGIN_LOOKUP', ...detailMaybe });
    }
    // Surface the carrier's actual response — without it, account/config errors
    // like "No couriers found for this account" are invisible.
    console.error(
      '[shipping/quote]',
      describeEshipError(e),
      e && e.body ? JSON.stringify(e.body) : ''
    );
    // ESHIP_API_DEBUG=true echoes the carrier's error in the response (for
    // staging/debugging). Default (unset/false) keeps the opaque live response.
    const debug = String(process.env.ESHIP_API_DEBUG).toLowerCase() === 'true';
    const detailMaybe = debug
      ? {
          detail: describeEshipError(e),
          eshipStatus: e && e.status,
          eshipBody: (e && (e.body || e.text)) || undefined,
        }
      : {};
    return res.status(502).json({ code: 'ESHIP_ERROR', ...detailMaybe });
  }
});

module.exports = router;
