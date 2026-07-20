'use strict';

jest.mock('./notificationDelivery', () => ({
  deliverNotification: jest.fn(),
}));

const { deliverNotification } = require('./notificationDelivery');
const {
  INACTIVITY_DELAY_MS,
  VIEW_DELAY_MS,
  handleListingCampaignEvent,
  handleUserCreatedCampaigns,
  matchScore,
  nextDigestAt,
  processDueNotificationJobs,
  recordListingEngagement,
} = require('./notificationCampaignService');

const listingResource = {
  id: { uuid: 'listing-1' },
  type: 'listing',
  attributes: {
    title: 'Vestido rojo',
    state: 'published',
    price: { amount: 120000, currency: 'MXN' },
    publicData: {
      categoryLevel1: 'vestidos',
      brand: 'marca',
      all_sizes: ['m'],
      color: ['rojo'],
    },
  },
  relationships: { author: { data: { id: { uuid: 'seller-1' } } } },
};

const user = {
  id: 'buyer-1',
  email: 'buyer@example.com',
  firstName: 'Ada',
};

describe('notification campaign scheduling', () => {
  test('scores category as required and ranks brand, size, and color', () => {
    expect(
      matchScore(
        { category: 'vestidos', brand: 'marca', sizes: ['m'], colors: ['rojo'] },
        { category: 'vestidos', brand: 'marca', sizes: ['m'], colors: ['rojo'] }
      )
    ).toBe(16);
    expect(
      matchScore(
        { category: 'bolsas', brand: 'marca', sizes: [], colors: [] },
        { category: 'vestidos', brand: 'marca', sizes: [], colors: [] }
      )
    ).toBe(0);
  });

  test('calculates the next 09:00 America/Mexico_City digest', () => {
    expect(nextDigestAt(new Date('2026-07-19T13:00:00.000Z')).toISOString()).toBe(
      '2026-07-19T15:00:00.000Z'
    );
    expect(nextDigestAt(new Date('2026-07-19T16:00:00.000Z')).toISOString()).toBe(
      '2026-07-20T15:00:00.000Z'
    );
  });

  test('refreshes a viewed-listing job to 24 hours after the latest qualified view', async () => {
    const jobStore = { schedule: jest.fn(), cancel: jest.fn() };
    const engagementStore = { record: jest.fn().mockResolvedValue({ id: 1 }) };
    const occurredAt = '2026-07-19T12:00:00.000Z';

    await recordListingEngagement(
      { user, listingResource, action: 'view', occurredAt },
      { jobStore, engagementStore }
    );

    expect(jobStore.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        jobKey: 'viewed-listing:buyer-1:listing-1',
        dueAt: new Date(new Date(occurredAt).getTime() + VIEW_DELAY_MS),
        refreshDueAt: true,
      })
    );
  });

  test('a favorite cancels the viewed-without-action job', async () => {
    const jobStore = { schedule: jest.fn(), cancel: jest.fn() };
    const engagementStore = { record: jest.fn().mockResolvedValue({ id: 1 }) };

    await recordListingEngagement(
      { user, listingResource, action: 'favorite' },
      { jobStore, engagementStore }
    );

    expect(jobStore.cancel).toHaveBeenCalledWith({
      campaign: 'viewed_listing',
      sharetribeUserId: 'buyer-1',
      resourceId: 'listing-1',
    });
    expect(jobStore.schedule).not.toHaveBeenCalled();
  });

  test('records an anonymous qualified view without scheduling buyer email', async () => {
    const jobStore = { schedule: jest.fn(), cancel: jest.fn() };
    const engagementStore = { record: jest.fn().mockResolvedValue({ id: 1 }) };

    const result = await recordListingEngagement(
      { user: null, listingResource, action: 'view' },
      { jobStore, engagementStore }
    );

    expect(engagementStore.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sharetribeUserId: null,
        email: null,
        action: 'view',
      })
    );
    expect(jobStore.schedule).not.toHaveBeenCalled();
    expect(result).toEqual({ recorded: true, scheduled: false });
  });

  test('seller signup schedules activation and records supplied consent', async () => {
    const jobStore = { schedule: jest.fn() };
    const consentStore = { setPreference: jest.fn() };
    const resource = {
      id: { uuid: 'seller-1' },
      attributes: {
        email: 'seller@example.com',
        createdAt: '2026-07-19T12:00:00.000Z',
        profile: {
          firstName: 'Sofía',
          publicData: { userType: 'vendedor-tienda' },
          protectedData: {
            marketingConsent: true,
            marketingConsentSource: 'signup_email',
            marketingConsentPolicyVersion: '2026-07-19',
          },
        },
      },
    };

    await handleUserCreatedCampaigns('event-1', resource, { jobStore, consentStore });

    expect(consentStore.setPreference).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, sharetribeUserId: 'seller-1' })
    );
    expect(jobStore.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign: 'signup_no_listing',
        sharetribeUserId: 'seller-1',
      })
    );
  });

  test('starts listing inactivity timing when a draft is published, not when it was created', async () => {
    const publishedAt = '2026-07-19T12:00:00.000Z';
    const publishedListing = {
      ...listingResource,
      attributes: {
        ...listingResource.attributes,
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: publishedAt,
      },
    };
    const sellerResource = {
      id: { uuid: 'seller-1' },
      attributes: {
        email: 'seller@example.com',
        profile: {
          firstName: 'Sofía',
          publicData: { userType: 'vendedor' },
        },
      },
    };
    const sdk = {
      users: { show: jest.fn().mockResolvedValue({ data: { data: sellerResource } }) },
      listings: {
        show: jest.fn().mockResolvedValue({ data: { data: publishedListing, included: [] } }),
      },
    };
    const jobStore = {
      claimListingPublication: jest.fn().mockResolvedValue(true),
      cancel: jest.fn(),
      schedule: jest.fn(),
      appendMatchingListing: jest.fn(),
    };
    const engagementStore = { matchingUsers: jest.fn().mockResolvedValue([]) };

    await handleListingCampaignEvent('event-1', publishedListing, {
      sdk,
      jobStore,
      engagementStore,
    });

    expect(jobStore.claimListingPublication).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt })
    );
    expect(jobStore.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign: 'listing_no_activity',
        payload: expect.objectContaining({ publishedAt }),
        dueAt: new Date(new Date(publishedAt).getTime() + INACTIVITY_DELAY_MS),
      })
    );
  });
});

describe('send-time campaign safeguards', () => {
  const job = {
    id: 1,
    job_key: 'viewed-listing:buyer-1:listing-1',
    campaign: 'viewed_listing',
    sharetribe_user_id: 'buyer-1',
    recipient_email: 'buyer@example.com',
    resource_id: 'listing-1',
    trigger_event_id: 'event-1',
    payload: {
      firstName: 'Ada',
      viewedAt: '2026-07-18T12:00:00.000Z',
      listing: { id: 'listing-1', title: 'Vestido' },
    },
  };
  const sdk = {
    users: {
      show: jest.fn().mockResolvedValue({
        data: {
          data: {
            id: { uuid: 'buyer-1' },
            attributes: {
              email: 'buyer@example.com',
              profile: { firstName: 'Ada' },
            },
          },
        },
      }),
    },
    listings: {
      show: jest.fn().mockResolvedValue({ data: { data: listingResource, included: [] } }),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREVO_TEMPLATE_VIEWED_LISTING_A = '201';
    process.env.BREVO_TEMPLATE_VIEWED_LISTING_B = '202';
    deliverNotification.mockResolvedValue({ status: 'sent' });
  });

  test('skips a due marketing job when consent is absent', async () => {
    const jobStore = {
      claimDue: jest.fn().mockResolvedValue([job]),
      finish: jest.fn(),
      promotionalNextAvailableAt: jest.fn(),
    };
    const consentStore = { isEligible: jest.fn().mockResolvedValue(false) };
    const engagementStore = { hasActionSince: jest.fn() };

    await processDueNotificationJobs('worker-1', {
      sdk,
      jobStore,
      consentStore,
      engagementStore,
    });

    expect(jobStore.finish).toHaveBeenCalledWith(1, 'skipped', 'marketing_consent_missing');
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  test('defers a third promotional message until the rolling weekly cap clears', async () => {
    const nextAllowed = new Date(Date.now() + 60 * 60 * 1000);
    const jobStore = {
      claimDue: jest.fn().mockResolvedValue([job]),
      finish: jest.fn(),
      defer: jest.fn(),
      promotionalNextAvailableAt: jest.fn().mockResolvedValue(nextAllowed),
    };
    const consentStore = { isEligible: jest.fn().mockResolvedValue(true) };
    const engagementStore = { hasActionSince: jest.fn() };

    await processDueNotificationJobs('worker-1', {
      sdk,
      jobStore,
      consentStore,
      engagementStore,
    });

    expect(jobStore.defer).toHaveBeenCalledWith(1, nextAllowed, 'promotional_frequency_cap');
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  test('delivers an eligible job through the generic Brevo payload', async () => {
    const jobStore = {
      claimDue: jest.fn().mockResolvedValue([job]),
      finish: jest.fn(),
      promotionalNextAvailableAt: jest.fn().mockResolvedValue(null),
    };
    const consentStore = { isEligible: jest.fn().mockResolvedValue(true) };
    const engagementStore = { hasActionSince: jest.fn().mockResolvedValue(false) };

    await processDueNotificationJobs('worker-1', {
      sdk,
      jobStore,
      consentStore,
      engagementStore,
    });

    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'brevo',
        recipient: 'buyer@example.com',
        payload: expect.objectContaining({ templateId: expect.any(String) }),
      }),
      'worker-1'
    );
    expect(jobStore.finish).toHaveBeenCalledWith(1, 'sent', null);
  });

  test('processes one user sequentially so concurrent due jobs respect the weekly cap', async () => {
    const nextAllowed = new Date(Date.now() + 60 * 60 * 1000);
    const secondJob = {
      ...job,
      id: 2,
      job_key: 'viewed-listing:buyer-1:listing-2',
      resource_id: 'listing-2',
    };
    const jobStore = {
      claimDue: jest.fn().mockResolvedValue([job, secondJob]),
      finish: jest.fn(),
      defer: jest.fn(),
      promotionalNextAvailableAt: jest.fn(async () =>
        jobStore.finish.mock.calls.some(([, status]) => status === 'sent') ? nextAllowed : null
      ),
    };
    const consentStore = { isEligible: jest.fn().mockResolvedValue(true) };
    const engagementStore = { hasActionSince: jest.fn().mockResolvedValue(false) };

    await processDueNotificationJobs('worker-1', {
      sdk,
      jobStore,
      consentStore,
      engagementStore,
    });

    expect(deliverNotification).toHaveBeenCalledTimes(1);
    expect(jobStore.finish).toHaveBeenCalledWith(1, 'sent', null);
    expect(jobStore.defer).toHaveBeenCalledWith(2, nextAllowed, 'promotional_frequency_cap');
  });
});
