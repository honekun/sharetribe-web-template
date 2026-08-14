'use strict';

const { getShipment } = require('../api-util/eshipClient');
const { getIntegrationSdk } = require('./integrationSdk');
const { isEshipTrackingEmailsEnabled } = require('./notificationConfig');
const { createEshipTrackingStore, DEFAULT_MAX_ATTEMPTS } = require('./eshipTrackingStore');

const EVENT_TYPE_PICKED_UP = 'transit-picked-up';
const MAX_EVENTS_PER_RUN = 20;
const PICKED_UP_TRANSITIONS = {
  purchased: 'transition/eship-picked-up-from-purchased',
  delivered: 'transition/eship-picked-up-from-delivered',
};

const stringValue = value => (value == null ? '' : String(value).trim());
const normalizeStatus = value => stringValue(value).toLowerCase();
const transactionIdOf = tx => tx?.id?.uuid || tx?.id;
const transactionState = tx => normalizeStatus(tx?.attributes?.state).replace(/^state\//, '');
const transitionHistory = tx => {
  const attrs = tx?.attributes || {};
  const history = attrs.transitions || [];
  return attrs.lastTransition ? [...history, attrs.lastTransition] : history;
};

function hasPickedUpTransition(tx) {
  const transitionNames = transitionHistory(tx).map(item => item?.transition || item);
  return transitionNames.some(name => Object.values(PICKED_UP_TRANSITIONS).includes(name));
}

function trackingCheckpoints(shipment) {
  return [shipment?.tracking, ...(Array.isArray(shipment?.events) ? shipment.events : [])].filter(
    Boolean
  );
}

function isVerifiedPickedUp(shipment) {
  return trackingCheckpoints(shipment).some(checkpoint => {
    const status = normalizeStatus(checkpoint.status);
    const substatus = normalizeStatus(checkpoint.substatus || checkpoint.subestatus);
    return status === 'transit' && substatus === 'picked_up';
  });
}

function safeTrackingUrl(value) {
  try {
    const url = new URL(stringValue(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch (_) {
    return null;
  }
}

function verifiedTrackingData(shipment, claim) {
  const shipmentId = stringValue(shipment?.object_id || shipment?.shipment_id);
  if (!shipmentId || shipmentId !== claim.shipment_id) {
    throw new Error('eShip shipment verification returned a different shipment ID');
  }
  if (!isVerifiedPickedUp(shipment)) {
    throw new Error('eShip has not verified a TRANSIT/picked_up checkpoint yet');
  }

  const trackingNumber = stringValue(shipment?.tracking_number) || null;
  if (
    claim.webhook_tracking_number &&
    trackingNumber &&
    claim.webhook_tracking_number !== trackingNumber
  ) {
    throw new Error('eShip shipment verification returned a different tracking number');
  }

  const trackingUrl =
    safeTrackingUrl(shipment?.tracking_url_provider) ||
    safeTrackingUrl(shipment?.tracking_url_custom);
  if (!trackingUrl) throw new Error('eShip did not return a valid carrier tracking URL');

  const providerName = stringValue(shipment?.provider || shipment?.carrier);
  if (!providerName) throw new Error('eShip did not return a tracking provider name');

  return {
    shipmentId,
    trackingNumber,
    providerName,
    trackingUrl,
    status: 'TRANSIT',
    substatus: 'picked_up',
    pickedUpAt: claim.event_at ? new Date(claim.event_at).toISOString() : null,
    verifiedAt: new Date().toISOString(),
    notificationId: String(claim.id),
  };
}

function errorCodes(error) {
  const candidates = [
    error?.code,
    error?.data?.code,
    ...(Array.isArray(error?.data?.errors) ? error.data.errors.map(item => item?.code) : []),
    ...(Array.isArray(error?.data?.data?.errors)
      ? error.data.data.errors.map(item => item?.code)
      : []),
  ];
  return candidates.filter(Boolean);
}

function isInvalidTransition(error) {
  return (
    Number(error?.status) === 409 && errorCodes(error).includes('transaction-invalid-transition')
  );
}

function sanitizedError(error) {
  const value = stringValue(error?.message || error || 'unknown eShip tracking error');
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}

function retryDelaySeconds(attemptCount) {
  return Math.min(60 * 60, 30 * 2 ** Math.max(0, Math.min(attemptCount - 1, 7)));
}

async function showTransaction(sdk, transactionId) {
  const response = await sdk.transactions.show({ id: transactionId });
  return response?.data?.data || null;
}

async function executePickedUpTransition(sdk, tx) {
  const state = transactionState(tx);
  const transition = PICKED_UP_TRANSITIONS[state];
  if (!transition) return { ignored: `transaction_state_${state || 'unknown'}_not_eligible` };

  try {
    await sdk.transactions.transition({
      id: transactionIdOf(tx),
      transition,
      params: {},
    });
    return { transition };
  } catch (error) {
    if (!isInvalidTransition(error)) throw error;

    // The seller may mark the order delivered between our read and transition.
    // Re-read once and switch to the delivered self-transition when applicable.
    const refreshed = await showTransaction(sdk, transactionIdOf(tx));
    const refreshedState = transactionState(refreshed);
    const refreshedTransition = PICKED_UP_TRANSITIONS[refreshedState];
    if (refreshedTransition && refreshedState !== state) {
      await sdk.transactions.transition({
        id: transactionIdOf(refreshed),
        transition: refreshedTransition,
        params: {},
      });
      return { transition: refreshedTransition };
    }
    return { ignored: 'eship_picked_up_transition_unavailable_for_process_version' };
  }
}

async function processClaim({ claim, store, sdk, fetchShipment = getShipment }) {
  let transactionId = null;
  try {
    transactionId = await store.findTransactionByShipmentId(claim.shipment_id);
    if (!transactionId) {
      await store.markIgnored(claim.id, claim.claim_token, {
        reason: 'shipment_not_created_by_marketplace',
      });
      return { status: 'ignored' };
    }

    const shipment = await fetchShipment({ shipmentId: claim.shipment_id, eventList: true });
    const trackingData = verifiedTrackingData(shipment, claim);
    let tx = await showTransaction(sdk, transactionId);
    if (!tx) throw new Error('Sharetribe transaction was not found');

    if (normalizeStatus(tx.attributes?.processName) !== 'default-purchase') {
      await store.markIgnored(claim.id, claim.claim_token, {
        transactionId,
        reason: 'transaction_process_not_default_purchase',
      });
      return { status: 'ignored' };
    }

    // If Sharetribe accepted the transition but the database finalize failed,
    // reconcile from transition history instead of sending the email twice.
    const existingTracking = tx.attributes?.metadata?.avTracking;
    if (existingTracking?.shipmentId === claim.shipment_id && hasPickedUpTransition(tx)) {
      await store.markSent(claim.id, claim.claim_token, transactionId);
      return { status: 'sent', reconciled: true };
    }

    const state = transactionState(tx);
    if (!PICKED_UP_TRANSITIONS[state]) {
      await store.markIgnored(claim.id, claim.claim_token, {
        transactionId,
        reason: `transaction_state_${state || 'unknown'}_not_eligible`,
      });
      return { status: 'ignored' };
    }

    await sdk.transactions.updateMetadata({
      id: transactionId,
      metadata: { avTracking: trackingData },
    });

    // Refresh so the transition decision is based on the state after metadata
    // has been persisted and available to the email template.
    tx = await showTransaction(sdk, transactionId);
    const result = await executePickedUpTransition(sdk, tx);
    if (result.ignored) {
      await store.markIgnored(claim.id, claim.claim_token, {
        transactionId,
        reason: result.ignored,
      });
      return { status: 'ignored' };
    }

    await store.markSent(claim.id, claim.claim_token, transactionId);
    return { status: 'sent', transition: result.transition };
  } catch (error) {
    await store.markFailed(claim.id, claim.claim_token, {
      transactionId,
      error: sanitizedError(error),
      retryDelaySeconds: retryDelaySeconds(claim.attempt_count),
    });
    return { status: 'failed', error };
  }
}

async function processDueEshipTrackingNotifications(
  claimedBy,
  { store = null, sdk = null, fetchShipment = getShipment, maxEvents = MAX_EVENTS_PER_RUN } = {}
) {
  if (!isEshipTrackingEmailsEnabled()) return 0;
  const trackingStore = store || createEshipTrackingStore();
  const integrationSdk = sdk || getIntegrationSdk();
  let processed = 0;

  while (processed < maxEvents) {
    const claim = await trackingStore.claimNext({
      claimedBy,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    });
    if (!claim) break;
    await processClaim({ claim, store: trackingStore, sdk: integrationSdk, fetchShipment });
    processed += 1;
  }
  return processed;
}

module.exports = {
  EVENT_TYPE_PICKED_UP,
  MAX_EVENTS_PER_RUN,
  PICKED_UP_TRANSITIONS,
  executePickedUpTransition,
  isVerifiedPickedUp,
  processClaim,
  processDueEshipTrackingNotifications,
  retryDelaySeconds,
  safeTrackingUrl,
  verifiedTrackingData,
};
