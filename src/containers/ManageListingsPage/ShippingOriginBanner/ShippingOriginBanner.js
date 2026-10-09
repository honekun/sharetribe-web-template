import React, { useState } from 'react';

import { FormattedMessage } from '../../../util/reactIntl';
import { hasCompleteShippingOrigin } from '../../../util/shippingOrigin';

import { NamedLink } from '../../../components';

import css from './ShippingOriginBanner.module.css';

/**
 * Dismissible nudge shown on the seller dashboard when the seller has no
 * complete shipping-origin address. Without it their listings can't quote
 * shipping at checkout (buyer sees "Contact AV"). Links to the settings page.
 */
const ShippingOriginBanner = ({ currentUser }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || hasCompleteShippingOrigin(currentUser)) return null;

  return (
    <div className={css.root} role="status">
      <span className={css.message}>
        <FormattedMessage id="ShippingOriginBanner.message" />
      </span>
      <NamedLink name="ShippingOriginPage" className={css.cta}>
        <FormattedMessage id="ShippingOriginBanner.cta" />
      </NamedLink>
      <button
        type="button"
        className={css.dismiss}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export default ShippingOriginBanner;
