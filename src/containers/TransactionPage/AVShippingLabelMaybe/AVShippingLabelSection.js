import React, { useState } from 'react';
import { apiBaseUrl } from '../../../util/api';
import { isLabelPurchaseAllowed, labelShippingRecord } from '../../../config/configAVShippingLabel';
import AVShippingLabelMaybe from './AVShippingLabelMaybe';

/**
 * Self-contained provider-side wrapper around AVShippingLabelMaybe.
 *
 * Reads the chosen rate (`labelShippingRecord`, shared with the server) + label
 * marker off the transaction and, on a manual
 * retry, POSTs to /api/shipping/label. Progress/error live in local state and
 * the endpoint's returned `avLabel` is preferred over the (now stale) persisted
 * one on success — so the button flips to "Descargar guía" without a page reload
 * and without touching the TransactionPage Redux duck.
 *
 * @param {Object} props
 * @param {Object} props.transaction - the current transaction entity
 */
const AVShippingLabelSection = props => {
  const { transaction } = props;
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState(null);
  const [freshLabel, setFreshLabel] = useState(null);

  // The same rule the label endpoint applies (audit A01): the server-written
  // metadata record, or a legacy protectedData copy no dispute could have
  // rewritten, charged to the buyer at that price. Anything else — a pickup
  // order, a stale or forged rate — shows no control, because the server would
  // refuse the label.
  const avShipping = labelShippingRecord(transaction);
  const avLabel = freshLabel || transaction?.attributes?.metadata?.avLabel || null;
  const transactionId = transaction?.id?.uuid;
  const hasUncertainAttempt = ['processing', 'unknown'].includes(avLabel?.status);
  const canGenerate = isLabelPurchaseAllowed(transaction) && !hasUncertainAttempt;

  const handleGenerate = () => {
    if (!transactionId) return;
    setInProgress(true);
    setError(null);
    window
      .fetch(`${apiBaseUrl()}/api/shipping/label`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      })
      .then(res =>
        res.json().then(data => {
          if (!res.ok) {
            setError(data?.code || 'LABEL_FAILED');
            return;
          }
          if (data?.avLabel) setFreshLabel(data.avLabel);
        })
      )
      .catch(() => setError('LABEL_FAILED'))
      .finally(() => setInProgress(false));
  };

  return (
    <AVShippingLabelMaybe
      avShipping={avShipping}
      avLabel={avLabel}
      canGenerate={canGenerate}
      onGenerate={handleGenerate}
      inProgress={inProgress}
      error={error}
    />
  );
};

export default AVShippingLabelSection;
