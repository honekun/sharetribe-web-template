'use strict';

// Audit A08: an operator retry of a promotional email must pass the same
// checks as normal campaign processing, and a sent retry must count toward the
// frequency cap. Essential mail keeps its stored-payload retry.

jest.mock('./notificationDelivery', () => {
  const actual = jest.requireActual('./notificationDelivery');
  return { ...actual, deliverNotification: jest.fn(), retryNotification: jest.fn() };
});
jest.mock('./notificationConfig', () => ({
  ...jest.requireActual('./notificationConfig'),
  isMarketingCampaignsEnabled: jest.fn(() => true),
}));

const {
  deliverNotification,
  notificationKey,
  retryNotification,
} = require('./notificationDelivery');
const { isMarketingCampaignsEnabled } = require('./notificationConfig');
const { buildCampaignEmail } = require('./marketingCampaigns');
const { retryDelivery } = require('./notificationRetry');

const listingResource = (state = 'published') => ({
  id: { uuid: 'listing-1' },
  type: 'listing',
  attributes: { title: 'Vestido rojo', state, price: { amount: 120000, currency: 'MXN' } },
  relationships: { author: { data: { id: { uuid: 'seller-1' } } } },
});

const job = {
  id: 7,
  job_key: 'viewed-listing:buyer-1:listing-1',
  campaign: 'viewed_listing',
  sharetribe_user_id: 'buyer-1',
  recipient_email: 'buyer@example.com',
  resource_id: 'listing-1',
  trigger_event_id: null,
  status: 'failed',
  payload: { firstName: 'Ada', viewedAt: '2026-07-18T12:00:00.000Z', listing: { id: 'listing-1' } },
};

// The stored delivery row exactly as normal processing would have written it.
const storedDelivery = () => {
  const payload = buildCampaignEmail({
    campaign: 'viewed_listing',
    recipientKey: 'buyer-1',
    email: 'buyer@example.com',
    firstName: 'Ada',
    payload: job.payload,
  });
  const delivery = {
    eventId: job.job_key,
    channel: 'brevo',
    templateName: payload.templateName,
    recipient: 'buyer@example.com',
  };
  return {
    notification_key: notificationKey(delivery),
    event_id: job.job_key,
    channel: 'brevo',
    template_name: payload.templateName,
    delivery_payload: payload,
    status: 'failed',
  };
};

const setup = ({
  delivery = storedDelivery(),
  email = 'buyer@example.com',
  consented = true,
  nextAvailableAt = null,
  listingState = 'published',
  jobs = [job],
} = {}) => {
  const deliveryStore = {
    get: jest.fn().mockResolvedValue(delivery),
    prepareRetry: jest.fn().mockResolvedValue({ ...delivery, status: 'pending' }),
  };
  const jobStore = {
    findForDelivery: jest.fn().mockResolvedValue(jobs),
    promotionalNextAvailableAt: jest.fn().mockResolvedValue(nextAvailableAt),
    recordRetryOutcome: jest.fn().mockResolvedValue(),
  };
  const consentStore = { isEligible: jest.fn().mockResolvedValue(consented) };
  const engagementStore = { hasActionSince: jest.fn().mockResolvedValue(false) };
  const sdk = {
    users: {
      show: jest.fn().mockResolvedValue({
        data: {
          data: { id: { uuid: 'buyer-1' }, attributes: { email, profile: { firstName: 'Ada' } } },
        },
      }),
    },
    listings: {
      show: jest
        .fn()
        .mockResolvedValue({ data: { data: listingResource(listingState), included: [] } }),
    },
  };
  return { deliveryStore, jobStore, consentStore, engagementStore, sdk, delivery };
};

const retry = (deps, opts = {}) =>
  retryDelivery(deps.delivery.notification_key, { claimedBy: 'operator:test', ...opts }, deps);

beforeEach(() => {
  jest.clearAllMocks();
  isMarketingCampaignsEnabled.mockReturnValue(true);
  process.env.BREVO_TEMPLATE_VIEWED_LISTING_A = '201';
  process.env.BREVO_TEMPLATE_VIEWED_LISTING_B = '202';
  deliverNotification.mockResolvedValue({ status: 'sent' });
});

describe('promotional retries go through the campaign policy', () => {
  test.each([
    ['a withdrawn or suppressed recipient', { consented: false }, 'marketing_consent_missing'],
    ['a changed email address', { email: 'new@example.com' }, 'recipient_email_changed'],
    ['an unpublished listing', { listingState: 'closed' }, 'campaign_no_longer_eligible'],
  ])('refuses %s without contacting the provider', async (_label, options, reason) => {
    const deps = setup(options);
    await expect(retry(deps)).resolves.toEqual({ status: 'refused', reason });
    expect(deliverNotification).not.toHaveBeenCalled();
    expect(deps.deliveryStore.prepareRetry).not.toHaveBeenCalled();
    expect(deps.jobStore.recordRetryOutcome).not.toHaveBeenCalled();
  });

  test('respects the rolling frequency cap', async () => {
    const nextAvailableAt = new Date(Date.now() + 60 * 60 * 1000);
    const deps = setup({ nextAvailableAt });
    await expect(retry(deps)).resolves.toEqual({
      status: 'refused',
      reason: 'promotional_frequency_cap',
      retryAfter: nextAvailableAt,
    });
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  test('sends an eligible retry once and records it for future caps', async () => {
    const deps = setup();
    await expect(retry(deps)).resolves.toEqual({ status: 'sent' });

    expect(deps.consentStore.isEligible).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      sharetribeUserId: 'buyer-1',
    });
    expect(deps.deliveryStore.prepareRetry).toHaveBeenCalledWith(deps.delivery.notification_key, {
      confirmUnknown: false,
    });
    expect(deliverNotification).toHaveBeenCalledTimes(1);
    const [sentDelivery, claimedBy, store] = deliverNotification.mock.calls[0];
    expect(notificationKey(sentDelivery)).toBe(deps.delivery.notification_key);
    expect(claimedBy).toBe('operator:test');
    expect(store).toBe(deps.deliveryStore);
    expect(deps.jobStore.recordRetryOutcome).toHaveBeenCalledWith(7, 'sent', null, 'operator:test');
  });

  test('does not count a deduplicated retry as a send', async () => {
    deliverNotification.mockResolvedValue({ status: 'deduplicated' });
    const deps = setup();
    await expect(retry(deps)).resolves.toEqual({ status: 'deduplicated' });
    expect(deps.jobStore.recordRetryOutcome).not.toHaveBeenCalled();
  });

  test('records a failed or unknown provider outcome on the job', async () => {
    const error = Object.assign(new Error('Brevo timed out'), {
      notificationOutcome: 'unknown',
      notificationOutcomeRecorded: true,
    });
    deliverNotification.mockRejectedValue(error);
    const deps = setup();
    await expect(retry(deps)).rejects.toBe(error);
    expect(deps.jobStore.recordRetryOutcome).toHaveBeenCalledWith(
      7,
      'unknown',
      'Brevo timed out',
      'operator:test'
    );
  });

  test('still requires confirmation for an unknown outcome', async () => {
    const deps = setup({ delivery: { ...storedDelivery(), status: 'unknown' } });
    await expect(retry(deps)).resolves.toEqual({
      status: 'refused',
      reason: 'confirmation_required',
    });
    await expect(retry(deps, { confirmUnknown: true })).resolves.toEqual({ status: 'sent' });
    expect(deps.deliveryStore.prepareRetry).toHaveBeenCalledWith(deps.delivery.notification_key, {
      confirmUnknown: true,
    });
  });

  test('retries a crashed send whose job the stale-claim recovery marked sent', async () => {
    // The worker died mid-send: the delivery row stayed `processing`, and the
    // recovery's replay was deduplicated, finishing the job as `sent`.
    const deps = setup({
      delivery: { ...storedDelivery(), status: 'processing' },
      jobs: [{ ...job, status: 'sent', last_error: 'deduplicated' }],
    });
    await expect(retry(deps)).resolves.toEqual({
      status: 'refused',
      reason: 'confirmation_required',
    });
    await expect(retry(deps, { confirmUnknown: true })).resolves.toEqual({ status: 'sent' });

    // The job's own unconfirmed `sent` is kept out of its frequency cap.
    expect(deps.jobStore.promotionalNextAvailableAt).toHaveBeenCalledWith('buyer-1', {
      excludeJobId: 7,
    });
    expect(deliverNotification).toHaveBeenCalledTimes(1);
    expect(deps.jobStore.recordRetryOutcome).toHaveBeenCalledWith(7, 'sent', null, 'operator:test');
  });

  test('refuses while campaigns are switched off', async () => {
    isMarketingCampaignsEnabled.mockReturnValue(false);
    const deps = setup();
    await expect(retry(deps)).resolves.toEqual({ status: 'refused', reason: 'campaigns_disabled' });
    expect(deps.jobStore.findForDelivery).not.toHaveBeenCalled();
  });

  test('refuses when the campaign job cannot be identified', async () => {
    await expect(retry(setup({ jobs: [] }))).resolves.toEqual({
      status: 'refused',
      reason: 'campaign_job_not_found',
    });
    await expect(retry(setup({ jobs: [job, { ...job, id: 8 }] }))).resolves.toEqual({
      status: 'refused',
      reason: 'ambiguous_campaign_job',
    });
  });

  test('refuses when the template id is not configured', async () => {
    delete process.env.BREVO_TEMPLATE_VIEWED_LISTING_A;
    delete process.env.BREVO_TEMPLATE_VIEWED_LISTING_B;
    await expect(retry(setup())).resolves.toEqual({
      status: 'refused',
      reason: 'template_not_configured',
    });
    expect(deliverNotification).not.toHaveBeenCalled();
  });

  test('looks the job up by campaign, recipient and delivery event', async () => {
    const deps = setup();
    await retry(deps);
    expect(deps.jobStore.findForDelivery).toHaveBeenCalledWith({
      campaign: 'viewed_listing',
      recipientEmail: 'buyer@example.com',
      eventId: job.job_key,
    });
  });
});

describe('essential retries keep the stored payload', () => {
  test('routes a seller welcome through retryNotification', async () => {
    const delivery = {
      notification_key: 'welcome-key',
      template_name: 'seller_welcome',
      delivery_payload: {
        email: 'seller@example.com',
        tags: ['archivo-vintach', 'seller_welcome'],
      },
      status: 'failed',
    };
    const deliveryStore = { get: jest.fn().mockResolvedValue(delivery) };
    retryNotification.mockResolvedValue({ status: 'sent' });

    await expect(
      retryDelivery('welcome-key', { claimedBy: 'operator:test' }, { deliveryStore })
    ).resolves.toEqual({ status: 'sent' });
    expect(retryNotification).toHaveBeenCalledWith(
      'welcome-key',
      { confirmUnknown: false, claimedBy: 'operator:test' },
      deliveryStore
    );
  });

  test('reports a missing delivery', async () => {
    const deliveryStore = { get: jest.fn().mockResolvedValue(null) };
    await expect(retryDelivery('nope', {}, { deliveryStore })).resolves.toEqual({
      status: 'not_found',
    });
  });
});
