import { useEffect } from 'react';

import { trackMarketingEngagement } from '../../util/api';
import * as log from '../../util/log';

export const QUALIFIED_VIEW_DELAY_MS = 10 * 1000;

/**
 * A listing view becomes qualified after ten seconds on the listing page.
 * Owners are excluded. Anonymous views are recorded without buyer identity so
 * they count toward seller activity without scheduling buyer follow-up email.
 */
export const useListingEngagement = ({ listingId, isOwnListing }) => {
  useEffect(() => {
    if (!listingId || isOwnListing) return undefined;
    const timer = window.setTimeout(() => {
      trackMarketingEngagement({ listingId, action: 'view' }).catch(error =>
        log.error(error, 'marketing-qualified-view-failed', { listingId })
      );
    }, QUALIFIED_VIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [listingId, isOwnListing]);
};
