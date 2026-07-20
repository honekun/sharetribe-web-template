import React, { useState } from 'react';
import { apiBaseUrl } from '../../../util/api';
import AVShippingLabelMaybe from './AVShippingLabelMaybe';

const LABEL_BUY_TRANSITION = 'transition/confirm-payment';

export const canGenerateShippingLabel = transaction => {
  const attributes = transaction?.attributes || {};
  const transitions = (attributes.transitions || [])
    .map(item => item?.transition || item)
    .filter(Boolean);
  if (attributes.lastTransition) transitions.push(attributes.lastTransition);
  const paid = transitions.includes(LABEL_BUY_TRANSITION);
  const canceled = transitions.some(name => /(^|\/)(?:auto-|operator-)?cancel/.test(name));
  return paid && !canceled;
};

/**
 * Self-contained provider-side wrapper around AVShippingLabelMaybe.
 *
 * Reads the chosen rate + label marker off the transaction and, on a manual
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

  const avShipping = transaction?.attributes?.protectedData?.avShipping || null;
  const avLabel = freshLabel || transaction?.attributes?.metadata?.avLabel || null;
  const transactionId = transaction?.id?.uuid;
  const hasUncertainAttempt = ['processing', 'unknown'].includes(avLabel?.status);
  const canGenerate = canGenerateShippingLabel(transaction) && !hasUncertainAttempt;

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
