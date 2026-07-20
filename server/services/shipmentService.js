'use strict';

// Spec B — buy the eShip shipping label after a purchase is paid.
//
// The chosen rate is persisted at checkout to `protectedData.avShipping`
// (see server/api-util/avShipping.js). Once payment is confirmed, this service
// exchanges that rate for an actual label via `POST /rest/shipment` and records
// the result on the transaction's `metadata.avLabel`:
//
//   { status: 'purchased', shipmentId, trackingNumber, labelUrl, carrier,
//     servicelevel, purchasedAt }
//   { status: 'failed', error, rate_id, failedAt }
//
// Buying a label is money-moving and NOT idempotent on eShip's side, so this is
// the single guarded entry point shared by both the auto path (event poller,
// force=false) and the manual retry endpoint (force=true):
//   - already `purchased`  -> return existing, never re-buy (both paths)
//   - already `failed`     -> auto path skips; force path retries
//   - no rate to buy       -> return null (especial / Contactar AV)

const { createShipment, describeEshipError } = require('../api-util/eshipClient');

// The single transition that means "payment captured, arrange shipping" in
// default-purchase (the inquiry path funnels through it too). A Set so booking/
// negotiation processes can add their equivalent later without touching callers.
const LABEL_BUY_TRANSITIONS = new Set(['transition/confirm-payment']);

async function buyLabelForTransaction(sdk, tx, { force = false } = {}) {
  const attrs = tx?.attributes || {};
  const existing = attrs.metadata?.avLabel;

  // Idempotent short-circuit: a bought label is never re-bought, on any path.
  if (existing?.status === 'purchased') return existing;
  // Auto path leaves a failed marker alone; only an explicit retry re-attempts.
  if (existing?.status === 'failed' && !force) return existing;

  const av = attrs.protectedData?.avShipping;
  if (!av?.rate_id) return null; // especial / Contactar AV: nothing to buy.

  let avLabel;
  try {
    const shipment = await createShipment({ rateId: av.rate_id, quotId: av.quot_id });
    avLabel = {
      status: 'purchased',
      shipmentId: shipment.shipment_id || null,
      trackingNumber: shipment.tracking_number || null,
      labelUrl: shipment.label_url || null,
      carrier: av.carrier || null,
      servicelevel: av.servicelevel || null,
      purchasedAt: new Date().toISOString(),
    };
  } catch (e) {
    // A carrier failure must not wedge the transaction; record it so the seller
    // sees a "Generar guía" retry and an operator can investigate.
    avLabel = {
      status: 'failed',
      error: describeEshipError(e),
      rate_id: av.rate_id,
      failedAt: new Date().toISOString(),
    };
  }

  await sdk.transactions.updateMetadata({ id: tx.id, metadata: { avLabel } });
  return avLabel;
}

// Auto path: called from the event poller for every transaction event. Gates on
// the confirm-payment transition, fetches the FRESH transaction (so the metadata
// idempotency marker is authoritative across dyno restarts / replayed events),
// and delegates. Resilient by design: a label failure is recorded inside
// buyLabelForTransaction, and any infra error (SDK fetch/write) is logged and
// swallowed so it never blocks the poll loop or cursor advancement.
async function maybeBuyLabelForEvent(sdk, resource) {
  const transition = resource?.attributes?.lastTransition || '';
  if (!LABEL_BUY_TRANSITIONS.has(transition)) return null;
  const txId = resource?.id;
  if (!txId) return null;
  try {
    const res = await sdk.transactions.show({ id: txId });
    const tx = res?.data?.data;
    if (!tx) return null;
    return await buyLabelForTransaction(sdk, tx, { force: false });
  } catch (e) {
    console.error('[shipmentService] auto label buy failed:', e && (e.message || e));
    return null;
  }
}

module.exports = { buyLabelForTransaction, maybeBuyLabelForEvent };
