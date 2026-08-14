import React from 'react';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { formatMoney } from '../../../util/currency';
import { types as sdkTypes } from '../../../util/sdkLoader';
import { IconSpinner } from '../../../components';

import AVShippingNotice from './AVShippingNotice';
import css from './AVShippingSelector.module.css';

const { Money } = sdkTypes;

// Reads microcopy straight from the catalog instead of formatMessage, because a key set to an
// empty string makes react-intl fall through and return the id itself (a truthy string).
const microcopy = (intl, id) => {
  const raw = intl.messages?.[id];
  return typeof raw === 'string' && raw.trim() ? intl.formatMessage({ id }) : '';
};

const Price = ({ amountSubunits, currency, intl }) =>
  amountSubunits != null && currency ? (
    <span className={css.price}>{formatMoney(intl, new Money(amountSubunits, currency))}</span>
  ) : null;

const Bucket = ({ labelId, type, data, selectedType, onSelect, intl }) =>
  data ? (
    <button
      type="button"
      className={selectedType === type ? css.bucketSelected : css.bucket}
      onClick={() => onSelect(type)}
    >
      <span className={css.bucketName}>
        <FormattedMessage id={labelId} />
      </span>
      <Price amountSubunits={data.amountSubunits} currency={data.currency} intl={intl} />
      {data.days != null ? (
        <span className={css.days}>
          <FormattedMessage id="AVShippingSelector.days" values={{ days: data.days }} />
        </span>
      ) : null}
    </button>
  ) : null;

/**
 * Checkout shipping selector. Shows two buckets (Express / Estándar) sourced from
 * a live eShip quote, plus a transparency list of every raw rate returned.
 *
 * @param {Object} props
 * @param {'idle'|'quoting'|'quoted'|'error'} props.status
 * @param {string} [props.errorCode] - NO_ORIGIN | ESPECIAL | ORIGIN_LOOKUP | ESHIP_ERROR
 *   (only ESHIP_ERROR is transient/retryable; the rest show "Contactar AV")
 * @param {Object} [props.express] - { amountSubunits, currency, days }
 * @param {Object} [props.estandar]
 * @param {Array} [props.rawRates]
 * @param {string} [props.selectedType]
 * @param {Function} props.onSelect
 * @param {Function} props.onRetry
 * @param {Function} props.onContactSeller
 */
const AVShippingSelector = props => {
  const intl = useIntl();
  const {
    status,
    errorCode,
    express,
    estandar,
    rawRates = [],
    selectedType,
    onSelect,
    onRetry,
    onContactSeller,
  } = props;

  if (status === 'quoting') {
    return (
      <div className={css.loading}>
        <IconSpinner rootClassName={css.spinner} />
        <FormattedMessage id="AVShippingSelector.loading" />
      </div>
    );
  }

  if (status === 'error') {
    const transient = errorCode === 'ESHIP_ERROR';
    return (
      <div className={css.error}>
        <FormattedMessage
          id={transient ? 'AVShippingSelector.errorTransient' : 'AVShippingSelector.errorPermanent'}
        />
        {transient ? (
          <button type="button" className={css.retry} onClick={onRetry}>
            <FormattedMessage id="AVShippingSelector.retry" />
          </button>
        ) : (
          <button type="button" className={css.contact} onClick={onContactSeller}>
            <FormattedMessage id="AVShippingSelector.contactSeller" />
          </button>
        )}
      </div>
    );
  }

  if (status !== 'quoted') return null;

  if (!express && !estandar) {
    return (
      <button type="button" className={css.contact} onClick={onContactSeller}>
        <FormattedMessage id="AVShippingSelector.contactSeller" />
      </button>
    );
  }

  return (
    <div className={css.root}>
      <div className={css.buckets}>
        <Bucket
          labelId="AVShippingSelector.express"
          type="nacionalExpress"
          data={express}
          selectedType={selectedType}
          onSelect={onSelect}
          intl={intl}
        />
        <Bucket
          labelId="AVShippingSelector.estandar"
          type="nacionalEstandar"
          data={estandar}
          selectedType={selectedType}
          onSelect={onSelect}
          intl={intl}
        />
      </div>

      <AVShippingNotice
        title={microcopy(intl, 'AVShippingSelector.noticeTitle')}
        text={microcopy(intl, 'AVShippingSelector.noticeText')}
      />

      {rawRates.length > 0 ? (
        <div className={css.rawSection}>
          <p className={css.rawTitle}>
            <FormattedMessage id="AVShippingSelector.rawListTitle" />
          </p>
          <ul className={css.rawList}>
            {rawRates.map(r => (
              <li key={r.rate_id} className={css.rawRow}>
                <span className={css.rawProvider}>
                  {r.provider}
                  {r.servicelevel?.name ? ` · ${r.servicelevel.name}` : ''}
                </span>
                {r.days != null ? <span className={css.rawDays}>{r.days}d</span> : null}
                <Price amountSubunits={r.buyerAmountSubunits} currency={r.currency} intl={intl} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default AVShippingSelector;
