import React from 'react';

import { FormattedMessage, intlShape } from '../../util/reactIntl';
import { types as sdkTypes } from '../../util/sdkLoader';
import { formatMoney } from '../../util/currency';
import {
  LINE_ITEM_PROVIDER_COMMISSION,
  LINE_ITEM_PROVIDER_COMMISSION_FIXED,
  propTypes,
} from '../../util/types';

import css from './OrderBreakdown.module.css';

const { Money } = sdkTypes;

// Validate the assumption that the commission exists and the amount
// is zero or negative.
const isValidCommission = commissionLineItem => {
  return commissionLineItem.lineTotal instanceof Money && commissionLineItem.lineTotal.amount <= 0;
};

const getCombinedProviderCommission = commissionLineItems => {
  const currencies = [...new Set(commissionLineItems.map(item => item.lineTotal.currency))];

  if (currencies.length > 1) {
    throw new Error('Provider commission line items must use the same currency');
  }

  const amount = commissionLineItems.reduce((total, item) => total + item.lineTotal.amount, 0);
  return new Money(amount, currencies[0]);
};

/**
 * A component that renders all provider commission charges as a single line item.
 *
 * @component
 * @param {Object} props
 * @param {Array<propTypes.lineItem>} props.lineItems - The line items to render
 * @param {boolean} props.isProvider - Whether the provider is the one receiving the commission
 * @param {string} props.marketplaceName - The name of the marketplace
 * @param {intlShape} props.intl - The intl object
 * @returns {JSX.Element}
 */
const LineItemProviderCommissionMaybe = props => {
  const { lineItems, isProvider, marketplaceName, intl } = props;

  const providerCommissionLineItems = lineItems.filter(
    item =>
      [LINE_ITEM_PROVIDER_COMMISSION, LINE_ITEM_PROVIDER_COMMISSION_FIXED].includes(item.code) &&
      !item.reversal
  );

  // If commission is passed it will be shown as a fee that already reduces the total price.
  let commissionItem = null;

  // Sharetribe Web Template is using the default-booking and default-purchase transaction processes.
  // They contain provider commissions, so by default, a provider commission line item should exist.
  // If you are not using provider commission you might want to remove this whole component from OrderBreakdown.js.
  // https://www.sharetribe.com/docs/concepts/transaction-process/
  if (isProvider && providerCommissionLineItems.length > 0) {
    const invalidCommissionLineItem = providerCommissionLineItems.find(
      item => !isValidCommission(item)
    );

    if (invalidCommissionLineItem) {
      console.error('invalid commission line item:', invalidCommissionLineItem);
      throw new Error('Commission should be present and the value should be zero or negative');
    }

    const commission = getCombinedProviderCommission(providerCommissionLineItems);
    const formattedCommission = commission ? formatMoney(intl, commission) : null;

    commissionItem = (
      <div className={css.lineItem}>
        <span className={css.itemLabel}>
          <FormattedMessage
            id="OrderBreakdown.commission"
            values={{ marketplaceName, role: 'provider' }}
          />
        </span>
        <span className={css.itemValue}>{formattedCommission}</span>
      </div>
    );
  }

  return commissionItem;
};

export default LineItemProviderCommissionMaybe;
