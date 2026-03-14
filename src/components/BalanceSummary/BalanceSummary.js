import React from 'react';
import { useIntl } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { types as sdkTypes } from '../../util/sdkLoader';
import { IconSpinner } from '../../components';

import css from './BalanceSummary.module.css';

const { Money } = sdkTypes;

const SummaryCard = ({ label, children, className }) => (
  <div className={className || css.card}>
    <div className={css.cardLabel}>{label}</div>
    <div className={css.cardValue}>{children}</div>
  </div>
);

const BalanceSummary = props => {
  const {
    completedTotalAmount = 0,
    pendingTotalAmount = 0,
    cancelledCount = 0,
    currency,
    fetchInProgress,
  } = props;

  const intl = useIntl();

  if (fetchInProgress) {
    return (
      <div className={css.root}>
        <IconSpinner />
      </div>
    );
  }

  const completedMoney = currency
    ? formatMoney(intl, new Money(completedTotalAmount, currency))
    : '—';
  const pendingMoney = currency
    ? formatMoney(intl, new Money(pendingTotalAmount, currency))
    : '—';

  return (
    <div className={css.root}>
      <SummaryCard
        label={intl.formatMessage({ id: 'BalanceSummary.totalEarnings' })}
        className={css.cardEarnings}
      >
        {completedMoney}
      </SummaryCard>
      <SummaryCard
        label={intl.formatMessage({ id: 'BalanceSummary.pending' })}
        className={css.cardPending}
      >
        {pendingMoney}
      </SummaryCard>
      <SummaryCard
        label={intl.formatMessage({ id: 'BalanceSummary.cancelled' })}
        className={css.cardCancelled}
      >
        {cancelledCount}
      </SummaryCard>
    </div>
  );
};

export default BalanceSummary;
