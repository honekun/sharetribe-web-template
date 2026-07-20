import React from 'react';
import { FormattedMessage } from '../../../util/reactIntl';
import { PrimaryButton, ExternalLink } from '../../../components';

import css from './AVShippingLabelMaybe.module.css';

/**
 * Provider-facing eShip shipping-label control on the sale detail page.
 *
 * Three states, keyed off the transaction's persisted shipping data:
 *  - purchased (`avLabel.status === 'purchased'`) → "Descargar guía" download link
 *  - buyable rate but no label yet / failed         → "Generar guía" retry button
 *  - no shippable rate (especial / Contactar AV)    → renders nothing
 *
 * Logic lives in TransactionPage; this component is presentational.
 *
 * @param {Object} props
 * @param {Object|null} props.avShipping - transaction.protectedData.avShipping (the chosen rate)
 * @param {Object|null} props.avLabel    - transaction.metadata.avLabel (the label marker)
 * @param {Function} props.onGenerate    - trigger a manual label purchase
 * @param {boolean} props.inProgress     - a generation request is in flight
 * @param {boolean} props.canGenerate    - payment is confirmed and transaction is active
 * @param {string} [props.error]         - error code from the last generation attempt
 */
const AVShippingLabelMaybe = props => {
  const { avShipping, avLabel, onGenerate, inProgress = false, canGenerate = true, error } = props;

  // Nothing to ship through eShip (especial / non-shipping / Contactar AV).
  if (!avShipping?.rate_id) return null;

  const isPurchased = avLabel?.status === 'purchased' && avLabel?.labelUrl;
  const hasUncertainAttempt = ['processing', 'unknown'].includes(avLabel?.status);
  if (!isPurchased && !canGenerate && !hasUncertainAttempt) return null;

  return (
    <div className={css.root}>
      <h3 className={css.heading}>
        <FormattedMessage id="AVShippingLabel.heading" />
      </h3>

      {isPurchased ? (
        <ExternalLink href={avLabel.labelUrl} className={css.downloadLink}>
          <FormattedMessage id="AVShippingLabel.download" />
        </ExternalLink>
      ) : hasUncertainAttempt ? (
        <p className={css.error}>
          <FormattedMessage id="AVShippingLabel.error" />
        </p>
      ) : (
        <>
          <PrimaryButton
            type="button"
            className={css.generateButton}
            inProgress={inProgress}
            disabled={inProgress}
            onClick={onGenerate}
          >
            <FormattedMessage
              id={inProgress ? 'AVShippingLabel.generating' : 'AVShippingLabel.generate'}
            />
          </PrimaryButton>
          {error ? (
            <p className={css.error}>
              <FormattedMessage id="AVShippingLabel.error" />
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default AVShippingLabelMaybe;
