import React from 'react';
import { render } from '@testing-library/react';

import { trackMarketingEngagement } from '../../util/api';
import { QUALIFIED_VIEW_DELAY_MS, useListingEngagement } from './useListingEngagement';

jest.mock('../../util/api', () => ({
  trackMarketingEngagement: jest.fn(),
}));
jest.mock('../../util/log', () => ({
  error: jest.fn(),
}));

const Harness = props => {
  useListingEngagement(props);
  return null;
};

describe('useListingEngagement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    trackMarketingEngagement.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('records a non-owner view after ten seconds', () => {
    render(<Harness listingId="listing-1" isOwnListing={false} />);
    jest.advanceTimersByTime(QUALIFIED_VIEW_DELAY_MS);

    expect(trackMarketingEngagement).toHaveBeenCalledWith({
      listingId: 'listing-1',
      action: 'view',
    });
  });

  test('records anonymous views but does not track listing owners', () => {
    const { rerender } = render(<Harness listingId="listing-1" isOwnListing={false} />);
    jest.advanceTimersByTime(QUALIFIED_VIEW_DELAY_MS);
    expect(trackMarketingEngagement).toHaveBeenCalledTimes(1);

    trackMarketingEngagement.mockClear();
    rerender(<Harness listingId="listing-1" isOwnListing />);
    jest.advanceTimersByTime(QUALIFIED_VIEW_DELAY_MS);

    expect(trackMarketingEngagement).not.toHaveBeenCalled();
  });
});
