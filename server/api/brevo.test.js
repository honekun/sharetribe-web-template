'use strict';

jest.mock('node-fetch');

// Consent evidence is written to PostgreSQL; mock the store so the endpoint tests
// stay unit-level. `mock`-prefixed names are allowed inside jest.mock factories.
const mockConsentRecord = jest.fn();
jest.mock('../services/newsletterConsent', () => ({
  createNewsletterConsentStore: () => ({ record: (...args) => mockConsentRecord(...args) }),
}));

// The endpoint derives the signed-in user id from the session; mock the SDK so we
// can simulate anonymous and logged-in signups without a real Sharetribe session.
const mockCurrentUserShow = jest.fn();
jest.mock('../api-util/sdk', () => ({
  getSdk: () => ({ currentUser: { show: (...args) => mockCurrentUserShow(...args) } }),
}));

const ORIGINAL_ENV = process.env;
process.env = {
  ...ORIGINAL_ENV,
  AV_NOTIFICATIONS_ENABLED: 'true',
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'true',
  AV_WHATSAPP_NOTIFICATIONS_ENABLED: 'false',
  BREVO_API_KEY: 'test-api-key',
  BREVO_LIST_ID: '9',
  BREVO_SENDER_EMAIL: 'sender@example.com',
  BREVO_SENDER_NAME: 'Sender',
  DATABASE_URL: 'postgresql://localhost/database',
  SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
  SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
};

const fetch = require('node-fetch');
const router = require('./brevo');

// ─── helpers ────────────────────────────────────────────────────────────────

function brevoOk(status = 201) {
  return { status, json: jest.fn().mockResolvedValue({}) };
}

function brevoErr(status, body) {
  return { status, json: jest.fn().mockResolvedValue(body) };
}

function createReq(body) {
  return { body };
}

function createRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function getSubscribeHandler() {
  const layer = router.stack.find(l => l.route?.path === '/subscribe' && l.route.methods?.post);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function getHealthHandler() {
  const layer = router.stack.find(l => l.route?.path === '/health' && l.route.methods?.get);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: consent record succeeds, signup is anonymous (no session user).
  mockConsentRecord.mockResolvedValue({ id: '1', consentAt: '2026-07-17T00:00:00.000Z' });
  mockCurrentUserShow.mockRejectedValue(new Error('anonymous'));
  process.env = {
    ...ORIGINAL_ENV,
    AV_NOTIFICATIONS_ENABLED: 'true',
    AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'true',
    AV_WHATSAPP_NOTIFICATIONS_ENABLED: 'false',
    BREVO_API_KEY: 'test-api-key',
    BREVO_LIST_ID: '9',
    BREVO_SENDER_EMAIL: 'sender@example.com',
    BREVO_SENDER_NAME: 'Sender',
    DATABASE_URL: 'postgresql://localhost/database',
    SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
    SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ─── /subscribe POST ─────────────────────────────────────────────────────────

describe('POST /subscribe', () => {
  const handler = getSubscribeHandler();

  it('returns ok:true for a valid new subscriber', async () => {
    fetch
      .mockResolvedValueOnce(brevoOk(201)) // contact upsert
      .mockResolvedValueOnce(brevoOk(201)); // add to list

    const req = createReq({ email: 'new@example.com', hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns ok:true when contact already existed (step-1 returns 204)', async () => {
    fetch
      .mockResolvedValueOnce(brevoOk(204)) // updated, no body
      .mockResolvedValueOnce(brevoOk(201));

    const req = createReq({ email: 'existing@example.com', hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns ok:true when contact is already in the list (step-2 returns 400 invalid_parameter)', async () => {
    // This is the main bug fix: Brevo returns 400 for already-subscribed contacts.
    fetch
      .mockResolvedValueOnce(brevoOk(204))
      .mockResolvedValueOnce(
        brevoErr(400, { message: 'Contact already in list', code: 'invalid_parameter' })
      );

    const req = createReq({ email: 'already@example.com', hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 400 for an invalid email', async () => {
    const req = createReq({ email: 'not-an-email', hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'Invalid email' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing email', async () => {
    const req = createReq({ hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'Invalid email' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('silently accepts honeypot-triggered requests (bot detection)', async () => {
    const req = createReq({ email: 'bot@example.com', hp: 'filled' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('records consent evidence (server-derived user id + ip) before subscribing', async () => {
    mockCurrentUserShow.mockResolvedValue({ data: { data: { id: { uuid: 'user-9' } } } });
    fetch.mockResolvedValueOnce(brevoOk(201)).mockResolvedValueOnce(brevoOk(201));

    const req = {
      body: {
        email: 'New@Example.com',
        hp: '',
        source: 'footer_newsletter',
        locale: 'es',
        policyVersion: '2026-07-17',
      },
      ip: '203.0.113.9',
    };
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockConsentRecord).toHaveBeenCalledTimes(1);
    const evidence = mockConsentRecord.mock.calls[0][0];
    expect(evidence).toEqual(
      expect.objectContaining({
        email: 'New@Example.com',
        source: 'footer_newsletter',
        locale: 'es',
        policyVersion: '2026-07-17',
        sharetribeUserId: 'user-9', // derived from the session, not the client
        ip: '203.0.113.9', // derived from the request, not the client
      })
    );
    expect(typeof evidence.consentAt).toBe('string');
  });

  it('falls back to a default policy version and null user id for anonymous signups', async () => {
    fetch.mockResolvedValueOnce(brevoOk(201)).mockResolvedValueOnce(brevoOk(201));

    const req = { body: { email: 'anon@example.com', hp: '' }, ip: '203.0.113.2' };
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.body).toEqual({ ok: true });
    const evidence = mockConsentRecord.mock.calls[0][0];
    expect(evidence.sharetribeUserId).toBeNull();
    expect(typeof evidence.policyVersion).toBe('string');
    expect(evidence.policyVersion.length).toBeGreaterThan(0);
  });

  it('aborts with 503 and makes no Brevo call when consent cannot be recorded', async () => {
    mockConsentRecord.mockRejectedValue(new Error('db down'));

    const req = {
      body: { email: 'user@example.com', hp: '', policyVersion: '1' },
      ip: '203.0.113.1',
    };
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, error: 'consent_record_failed' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not record consent for a honeypot-flagged request', async () => {
    const req = { body: { email: 'bot@example.com', hp: 'filled' }, ip: '203.0.113.3' };
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.body).toEqual({ ok: true });
    expect(mockConsentRecord).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when Brevo rejects the contact upsert (step 1)', async () => {
    fetch.mockResolvedValueOnce(
      brevoErr(400, { message: 'Invalid API key', code: 'unauthorized' })
    );

    const req = createReq({ email: 'user@example.com', hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'brevo_create_failed' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when Brevo rejects add-to-list with a real error (not already-in-list)', async () => {
    fetch
      .mockResolvedValueOnce(brevoOk(201))
      .mockResolvedValueOnce(
        brevoErr(404, { message: 'List not found', code: 'document_not_found' })
      );

    const req = createReq({ email: 'user@example.com', hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'brevo_add_to_list_failed' });
  });

  it('returns 500 when fetch throws (network error)', async () => {
    fetch.mockRejectedValueOnce(new Error('Network failure'));

    const req = createReq({ email: 'user@example.com', hp: '' });
    const res = createRes();
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'server_error' });
  });
});

describe('GET /health', () => {
  const handler = getHealthHandler();

  it('reports enabled Brevo configuration as ready', () => {
    const res = createRes();

    handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ready: true,
      enabled: true,
      intentionallyDisabled: false,
      missing: [],
    });
  });

  it('returns 503 and names missing configuration', () => {
    delete process.env.BREVO_API_KEY;
    const res = createRes();

    handler({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        ready: false,
        enabled: true,
        missing: expect.arrayContaining(['BREVO_API_KEY']),
      })
    );
  });
});
