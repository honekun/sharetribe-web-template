'use strict';

const mockSetPreference = jest.fn();
const mockGetPreference = jest.fn();
const mockUpsertContact = jest.fn();
const mockRemoveContact = jest.fn();
const mockRecordEngagement = jest.fn();
const mockRecordWebhook = jest.fn();
const mockCurrentUserShow = jest.fn();
const mockUpdateProfile = jest.fn();
const mockListingShow = jest.fn();

jest.mock('../services/marketingConsent', () => ({
  DEFAULT_POLICY_VERSION: '2026-07-19',
  createMarketingConsentStore: () => ({
    setPreference: (...args) => mockSetPreference(...args),
    getPreference: (...args) => mockGetPreference(...args),
  }),
}));
jest.mock('../services/brevoContactService', () => ({
  upsertMarketingContact: (...args) => mockUpsertContact(...args),
  removeMarketingContact: (...args) => mockRemoveContact(...args),
}));
jest.mock('../services/brevoWebhookStore', () => ({
  createBrevoWebhookStore: () => ({ record: (...args) => mockRecordWebhook(...args) }),
}));
jest.mock('../services/notificationCampaignService', () => {
  const actual = jest.requireActual('../services/notificationCampaignService');
  return {
    ...actual,
    recordListingEngagement: (...args) => mockRecordEngagement(...args),
  };
});
jest.mock('../services/notificationConfig', () => ({
  getNotificationConfigReadiness: () => ({
    poller: { configured: true, enabled: true },
    brevo: { ready: true, enabled: true, missing: [] },
    campaigns: { ready: true, enabled: true, missing: [] },
  }),
}));
jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({
    currentUser: {
      show: (...args) => mockCurrentUserShow(...args),
      updateProfile: (...args) => mockUpdateProfile(...args),
    },
    listings: { show: (...args) => mockListingShow(...args) },
  }),
}));

process.env.BREVO_WEBHOOK_SECRET = 'webhook-test-secret';

const router = require('./brevo');

const currentUserResource = {
  id: { uuid: 'user-1' },
  type: 'user',
  attributes: {
    email: 'Person@Example.com',
    profile: { firstName: 'Ada', lastName: 'Lovelace' },
  },
};

function createReq(body = {}, options = {}) {
  return {
    body,
    ip: '203.0.113.4',
    query: options.query || {},
    get: jest.fn(name => options.headers?.[name.toLowerCase()] || null),
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function routeHandler(path, method) {
  const layer = router.stack.find(
    item => item.route?.path === path && item.route.methods?.[method]
  );
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BREVO_WEBHOOK_SECRET = 'webhook-test-secret';
  mockCurrentUserShow.mockResolvedValue({ data: { data: currentUserResource } });
  mockUpdateProfile.mockResolvedValue({});
  mockListingShow.mockResolvedValue({
    data: {
      data: {
        id: { uuid: 'listing-1' },
        type: 'listing',
        attributes: { title: 'Vestido', state: 'published', publicData: {} },
        relationships: { author: { data: { id: { uuid: 'seller-1' } } } },
      },
      included: [],
    },
  });
  mockSetPreference.mockResolvedValue({ enabled: true });
  mockGetPreference.mockResolvedValue({ enabled: true, suppressed: false });
  mockUpsertContact.mockResolvedValue();
  mockRemoveContact.mockResolvedValue();
  mockRecordEngagement.mockResolvedValue({ recorded: true });
  mockRecordWebhook.mockResolvedValue();
});

describe('POST /subscribe', () => {
  const handler = routeHandler('/subscribe', 'post');

  it('records consent before upserting the Brevo list contact', async () => {
    const req = createReq({
      email: ' New@Example.com ',
      hp: '',
      source: 'footer_newsletter',
      locale: 'es',
      policyVersion: '2026-07-19',
    });
    const res = createRes();
    await handler(req, res);

    expect(res.body).toEqual({ ok: true });
    expect(mockSetPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        enabled: true,
        source: 'footer_newsletter',
        sharetribeUserId: 'user-1',
        ip: '203.0.113.4',
      })
    );
    expect(mockUpsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com' })
    );
    expect(mockSetPreference.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpsertContact.mock.invocationCallOrder[0]
    );
  });

  it('rejects invalid email and silently accepts the honeypot', async () => {
    const invalidRes = createRes();
    await handler(createReq({ email: 'bad', hp: '' }), invalidRes);
    expect(invalidRes.statusCode).toBe(400);

    const botRes = createRes();
    await handler(createReq({ email: 'bot@example.com', hp: 'filled' }), botRes);
    expect(botRes.body).toEqual({ ok: true });
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('fails closed when consent persistence fails', async () => {
    mockSetPreference.mockRejectedValue(new Error('database unavailable'));
    const res = createRes();
    await handler(createReq({ email: 'person@example.com' }), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, error: 'consent_record_failed' });
    expect(mockUpsertContact).not.toHaveBeenCalled();
  });
});

describe('authenticated marketing preference', () => {
  it('returns the current local preference', async () => {
    const res = createRes();
    await routeHandler('/preference', 'get')(createReq(), res);

    expect(res.body).toEqual({
      ok: true,
      enabled: true,
      suppressed: false,
      email: 'person@example.com',
    });
  });

  it('opts in and mirrors the preference to Brevo and Sharetribe protected data', async () => {
    const res = createRes();
    await routeHandler('/preference', 'put')(
      createReq({ enabled: true, source: 'signup_email' }),
      res
    );

    expect(mockSetPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        source: 'signup_email',
        sharetribeUserId: 'user-1',
      })
    );
    expect(mockUpsertContact).toHaveBeenCalled();
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      protectedData: expect.objectContaining({ marketingConsent: true }),
    });
    expect(res.body).toEqual({ ok: true, enabled: true });
  });

  it('opts out, removes list membership, and persists withdrawal', async () => {
    const res = createRes();
    await routeHandler('/preference', 'put')(createReq({ enabled: false }), res);

    expect(mockRemoveContact).toHaveBeenCalledWith('person@example.com');
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      protectedData: expect.objectContaining({
        marketingConsent: false,
        marketingConsentAt: null,
      }),
    });
  });
});

describe('POST /engagement', () => {
  it('records an authenticated qualified view from server-loaded listing data', async () => {
    const res = createRes();
    await routeHandler('/engagement', 'post')(
      createReq({ listingId: 'listing-1', action: 'view' }),
      res
    );

    expect(mockListingShow).toHaveBeenCalledWith(expect.objectContaining({ id: 'listing-1' }));
    expect(mockRecordEngagement).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
        action: 'view',
      })
    );
    expect(res.body).toEqual({ ok: true, recorded: true });
  });

  it('records an anonymous qualified view without an authenticated user', async () => {
    mockCurrentUserShow.mockRejectedValue(new Error('not authenticated'));
    const res = createRes();
    await routeHandler('/engagement', 'post')(
      createReq({ listingId: 'listing-1', action: 'view' }),
      res
    );

    expect(mockRecordEngagement).toHaveBeenCalledWith(
      expect.objectContaining({
        user: {},
        action: 'view',
      })
    );
    expect(res.body).toEqual({ ok: true, recorded: true });
  });

  it('requires authentication for favorite tracking', async () => {
    mockCurrentUserShow.mockRejectedValue(new Error('not authenticated'));
    const res = createRes();
    await routeHandler('/engagement', 'post')(
      createReq({ listingId: 'listing-1', action: 'favorite' }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(mockListingShow).not.toHaveBeenCalled();
    expect(mockRecordEngagement).not.toHaveBeenCalled();
  });
});

describe('POST /webhook', () => {
  const handler = routeHandler('/webhook', 'post');

  it('rejects an invalid secret', async () => {
    const res = createRes();
    await handler(createReq({ event: 'delivered' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('records delivery events and suppresses future marketing after unsubscribe', async () => {
    const req = createReq(
      {
        event: 'unsubscribed',
        email: 'person@example.com',
        'message-id': 'brevo-message-1',
        date: '2026-07-19T12:00:00.000Z',
      },
      { query: { secret: 'webhook-test-secret' } }
    );
    const res = createRes();
    await handler(req, res);

    expect(mockRecordWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ providerMessageId: 'brevo-message-1' })
    );
    expect(mockSetPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        suppressed: true,
        source: 'brevo_webhook',
      })
    );
    expect(res.statusCode).toBe(204);
  });

  it('uses Brevo event timestamps and suppresses hard bounces', async () => {
    const req = createReq(
      {
        event: 'hard_bounce',
        email: 'person@example.com',
        'message-id': 'brevo-message-2',
        ts_event: 1784452800,
      },
      { query: { secret: 'webhook-test-secret' } }
    );
    const res = createRes();
    await handler(req, res);

    expect(mockRecordWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'hard_bounce',
        occurredAt: new Date(1784452800 * 1000).toISOString(),
      })
    );
    expect(mockSetPreference).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, suppressed: true })
    );
    expect(res.statusCode).toBe(204);
  });
});

describe('GET /health', () => {
  it('includes both transactional and campaign readiness', () => {
    const res = createRes();
    routeHandler('/health', 'get')({}, res);

    expect(res.body).toEqual({
      ready: true,
      enabled: true,
      intentionallyDisabled: false,
      missing: [],
    });
  });
});
