'use strict';

// POST /api/shipping/label — manual "Generar guía" retry for a sale whose eShip
// label failed to buy automatically (see server/services/shipmentService.js).
//
// Unlike the auto path (event poller, trusted backend), a browser request must
// prove it's allowed to spend AV's money on a label. Authorization is enforced by
// reading the transaction through the CALLER's own SDK (403/404 if it isn't
// theirs), then verifying the caller is the transaction's provider (or a
// configured operator). The label is bought with force=true — an explicit retry
// ignores a prior `failed` marker but the `purchased` short-circuit still holds,
// so a double-click can't double-buy.

const express = require('express');
const { getSdk } = require('../../api-util/sdk');
const { getIntegrationSdk } = require('../../services/integrationSdk');
const { buyLabelForTransaction } = require('../../services/shipmentService');
const { describeEshipError } = require('../../api-util/eshipClient');
const { checkAndRecord } = require('./rateLimiter');

const router = express.Router();

const parseList = value =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

// Optional operators (e.g. support staff) allowed to retry any seller's label.
const getOperatorEmails = () =>
  new Set(parseList(process.env.SHIPPING_LABEL_OPERATOR_EMAILS).map(e => e.toLowerCase()));

const isOperator = email => {
  if (!email) return false;
  return getOperatorEmails().has(email.toLowerCase());
};

// POST /api/shipping/label  { transactionId }
router.post('/label', express.json(), async (req, res) => {
  const { transactionId } = req.body || {};
  if (!transactionId) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'transactionId is required' });
  }

  const sdk = getSdk(req, res);

  // 1. Identify the caller.
  let userId;
  let email;
  try {
    const me = await sdk.currentUser.show();
    const user = me?.data?.data;
    userId = user?.id?.uuid;
    email = user?.attributes?.email;
  } catch (e) {
    userId = null;
  }
  if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED' });

  // 2. Per-user hourly cap (before any carrier call).
  if (!checkAndRecord(userId)) {
    return res.status(429).json({ code: 'RATE_LIMITED', message: 'Demasiados intentos, espera.' });
  }

  // 3. Load the tx through the caller's SDK — enforces they may see it — and
  //    authorize: only the provider (or an operator) may buy the label.
  let providerId;
  try {
    const txRes = await sdk.transactions.show({ id: transactionId, include: ['provider'] });
    providerId = txRes?.data?.data?.relationships?.provider?.data?.id?.uuid;
  } catch (e) {
    return res.status(404).json({ code: 'NOT_FOUND' });
  }
  if (userId !== providerId && !isOperator(email)) {
    return res.status(403).json({ code: 'FORBIDDEN' });
  }

  // 4. Buy the label with the authoritative (Integration SDK) transaction.
  try {
    const integrationSdk = getIntegrationSdk();
    const fullRes = await integrationSdk.transactions.show({ id: transactionId });
    const fullTx = fullRes?.data?.data;
    const avLabel = await buyLabelForTransaction(integrationSdk, fullTx, { force: true });

    if (!avLabel) return res.status(422).json({ code: 'ESPECIAL' });
    if (avLabel.status === 'failed') {
      const debug = String(process.env.ESHIP_API_DEBUG).toLowerCase() === 'true';
      return res
        .status(502)
        .json({ code: 'LABEL_FAILED', avLabel, ...(debug ? { detail: avLabel.error } : {}) });
    }
    return res.status(200).json({ avLabel });
  } catch (e) {
    console.error('[shipping/label]', describeEshipError(e));
    return res.status(502).json({ code: 'LABEL_FAILED' });
  }
});

module.exports = router;
