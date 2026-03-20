import React from 'react';

import { FormattedMessage } from '../../util/reactIntl';
import { types as sdkTypes } from '../../util/sdkLoader';
import { formatMoney } from '../../util/currency';
import { LINE_ITEM_PROVIDER_COMMISSION_FIXED } from '../../util/types';

import css from './OrderBreakdown.module.css';

const { Money } = sdkTypes;

const isValidCommission = commissionLineItem => {
  return commissionLineItem.lineTotal instanceof Money && commissionLineItem.lineTotal.amount <= 0;
};

const LineItemProviderCommissionFixedMaybe = props => {
  const { lineItems, isProvider, marketplaceName, intl } = props;

  const fixedCommissionLineItem = lineItems.find(
    item => item.code === LINE_ITEM_PROVIDER_COMMISSION_FIXED && !item.reversal
  );

  if (!isProvider || !fixedCommissionLineItem) {
    return null;
  }

  if (!isValidCommission(fixedCommissionLineItem)) {
    // eslint-disable-next-line no-console
    console.error('invalid fixed commission line item:', fixedCommissionLineItem);
    throw new Error('Fixed commission should be present and the value should be zero or negative');
  }

  const commission = fixedCommissionLineItem.lineTotal;
  const formattedCommission = commission ? formatMoney(intl, commission) : null;

  return (
    <div className={css.lineItem}>
      <span className={css.itemLabel}>
        <FormattedMessage
          id="OrderBreakdown.providerCommissionFixed"
          values={{ marketplaceName }}
        />
      </span>
      <span className={css.itemValue}>{formattedCommission}</span>
    </div>
  );
};

export default LineItemProviderCommissionFixedMaybe;
