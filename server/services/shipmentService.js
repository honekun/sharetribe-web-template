'use strict';

// Buy an eShip label only after payment, under a durable PostgreSQL claim.
// eShip does not expose an idempotency key for this operation, so processing
// and unknown claims fail closed until an operator reconciles the carrier
// dashboard. This prevents double charges across concurrent requests, dyno
// restarts, timeouts and metadata-write failures.

const {
  createShipment,
  describeEshipError,
  EshipApiError,
  EshipTimeoutError,
} = require('../api-util/eshipClient');
const { createShippingLabelStore } = require('./shippingLabelStore');
const { isShippingLabelsEnabled } = require('./notificationConfig');
// Which transactions and shipping records may buy a label. Shared with the sale
// page's "Generar guía" control so it never offers a label refused here.
const {
  LABEL_BUY_TRANSITION,
  isLabelPurchaseAllowed,
  resolveLabelShippingRecord,
  shippingChargeMatches,
} = require('../../src/config/configAVShippingLabel');

// Auto-buy the label on the event-poller path ONLY when explicitly opted in with
// ESHIP_LABEL_AUTOBUY=true. Default (unset or anything other than 'true') means
// the label is bought only when the seller clicks "Generar guía" (the manual
// POST /api/shipping/label endpoint) — never automatically after payment.
function isLabelAutobuyEnabled() {
  return String(process.env.ESHIP_LABEL_AUTOBUY).toLowerCase() === 'true';
}

class LabelNotAllowedError extends Error {
  constructor(
    message = 'Shipping labels can only be purchased after payment and before cancellation',
    reason = 'TRANSACTION_STATE'
  ) {
    super(message);
    this.name = 'LabelNotAllowedError';
    this.code = 'LABEL_NOT_ALLOWED';
    this.reason = reason;
  }
}

class LabelPurchaseUnknownError extends Error {
  constructor(message) {
    super(message || 'The carrier purchase outcome is unknown');
    this.name = 'LabelPurchaseUnknownError';
    this.code = 'LABEL_UNKNOWN';
  }
}

function validateShipment(shipment) {
  const isSuccess = String(shipment?.status || '').toUpperCase() === 'SUCCESS';
  const shipmentId = shipment?.object_id || shipment?.shipment_id;
  if (!isSuccess || !shipmentId || !shipment?.label_url) {
    throw new LabelPurchaseUnknownError('eShip returned an incomplete shipment success response');
  }
  return shipmentId;
}

function isUnknownCarrierOutcome(error) {
  if (error instanceof LabelPurchaseUnknownError || error instanceof EshipTimeoutError) return true;
  if (error instanceof EshipApiError) {
    return error.status >= 500 || [408, 425, 429].includes(error.status);
  }
  // A network error can happen after the carrier accepted the request.
  return true;
}

const transactionIdOf = tx => tx?.id?.uuid || tx?.id;

const labelFromStoreRow = (row, av) => {
  if (!row) return null;
  if (row.status === 'purchased' && row.shipment_data) return row.shipment_data;
  const timestamp = row.finished_at || row.updated_at || new Date().toISOString();
  return {
    status: row.status,
    error: row.last_error || null,
    rate_id: row.rate_id || av?.rate_id || null,
    ...(row.status === 'failed' ? { failedAt: timestamp } : {}),
    ...(row.status === 'unknown' ? { unknownAt: timestamp } : {}),
  };
};

async function syncLabelMetadata(sdk, tx, avLabel) {
  try {
    await sdk.transactions.updateMetadata({ id: tx.id, metadata: { avLabel } });
  } catch (error) {
    console.error('[shipmentService] label metadata sync failed:', error?.message || error);
  }
}

async function buyLabelForTransaction(
  sdk,
  tx,
  { force = false, confirmUnknown = false, claimedBy = 'event-poller', store = null } = {}
) {
  const attrs = tx?.attributes || {};
  const existing = attrs.metadata?.avLabel;

  if (existing?.status === 'purchased') return existing;
  if (existing?.status === 'failed' && !force) return existing;
  if (existing?.status === 'unknown' && !confirmUnknown) return existing;

  const { record: av, source } = resolveLabelShippingRecord(tx);
  if (source === 'legacy_rewritable') {
    throw new LabelNotAllowedError(
      'The shipping record could have been rewritten after payment',
      'SHIPPING_RECORD_UNTRUSTED'
    );
  }
  if (!av?.rate_id) return null;
  if (!isLabelPurchaseAllowed(tx)) throw new LabelNotAllowedError();
  if (!shippingChargeMatches(attrs.lineItems, av)) {
    throw new LabelNotAllowedError(
      'The transaction does not charge the recorded shipping price',
      'SHIPPING_CHARGE_MISMATCH'
    );
  }
  if (source === 'legacy') {
    console.warn(
      `[shipmentService] transaction ${transactionIdOf(
        tx
      )} uses its legacy protectedData shipping record`
    );
  }

  const transactionId = transactionIdOf(tx);
  const labelStore = store || createShippingLabelStore();
  const claim = await labelStore.claim({
    transactionId,
    rateId: av.rate_id,
    claimedBy,
    force,
    confirmUnknown,
  });

  if (!claim) {
    const row = await labelStore.get(transactionId);
    const label = labelFromStoreRow(row, av) || existing;
    if (label?.status === 'purchased' && existing?.status !== 'purchased') {
      await syncLabelMetadata(sdk, tx, label);
    }
    return label;
  }

  let shipment;
  let shipmentId;
  try {
    shipment = await createShipment({ rateId: av.rate_id });
    shipmentId = validateShipment(shipment);
  } catch (error) {
    const unknown = isUnknownCarrierOutcome(error);
    const status = unknown ? 'unknown' : 'failed';
    const message = describeEshipError(error);
    const timestamp = new Date().toISOString();
    const avLabel = {
      status,
      error: message,
      rate_id: av.rate_id,
      ...(unknown ? { unknownAt: timestamp } : { failedAt: timestamp }),
    };

    try {
      await labelStore.finish(transactionId, claim.claim_token, { status, error: message });
    } catch (_) {
      throw new LabelPurchaseUnknownError(
        'The eShip outcome could not be finalized; verify the carrier before retrying'
      );
    }
    await syncLabelMetadata(sdk, tx, avLabel);
    return avLabel;
  }

  const avLabel = {
    status: 'purchased',
    shipmentId,
    trackingNumber: shipment.tracking_number || null,
    trackingUrlProvider: shipment.tracking_url_provider || null,
    trackingUrlCustom: shipment.tracking_url_custom || null,
    labelUrl: shipment.label_url,
    carrier: shipment.provider || av.carrier || null,
    servicelevel: av.servicelevel || null,
    purchasedAt: new Date().toISOString(),
  };

  // The durable outcome is committed before best-effort Sharetribe metadata.
  // If metadata fails, the next request reads this row and syncs without buying.
  try {
    await labelStore.finish(transactionId, claim.claim_token, {
      status: 'purchased',
      shipmentData: avLabel,
    });
  } catch (_) {
    throw new LabelPurchaseUnknownError(
      'eShip accepted the label but its durable purchase record could not be finalized'
    );
  }
  await syncLabelMetadata(sdk, tx, avLabel);
  return avLabel;
}

async function maybeBuyLabelForEvent(sdk, resource) {
  if (!isShippingLabelsEnabled()) return null;
  // Manual-only unless auto-buy is explicitly enabled.
  if (!isLabelAutobuyEnabled()) return null;
  const transition = resource?.attributes?.lastTransition || '';
  if (transition !== LABEL_BUY_TRANSITION) return null;
  const txId = resource?.id;
  if (!txId) return null;
  try {
    const res = await sdk.transactions.show({ id: txId });
    const tx = res?.data?.data;
    if (!tx) return null;
    return await buyLabelForTransaction(sdk, tx, {
      force: false,
      claimedBy: 'event-poller',
    });
  } catch (error) {
    console.error('[shipmentService] auto label buy failed:', error?.message || error);
    return null;
  }
}

module.exports = {
  LabelNotAllowedError,
  LabelPurchaseUnknownError,
  buyLabelForTransaction,
  isLabelAutobuyEnabled,
  isLabelPurchaseAllowed,
  maybeBuyLabelForEvent,
  resolveLabelShippingRecord,
  validateShipment,
};
