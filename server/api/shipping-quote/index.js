'use strict';

const express = require('express');
const { getSdk } = require('../../api-util/sdk');
const svc = require('../../services/shippingQuoteService');

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
    // Surface the carrier's actual response (status + body) — without it, account/
    // config errors like "No couriers found for this account" are invisible.
    console.error(
      '[shipping/quote] error',
      e && e.name,
      e && e.status,
      e && e.message,
      e && e.body ? JSON.stringify(e.body) : ''
    );
    return res.status(502).json({ code: 'ESHIP_ERROR' });
  }
});

module.exports = router;
