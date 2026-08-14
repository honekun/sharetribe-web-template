'use strict';

// Declared out here so they survive the jest.resetModules() below: the route
// re-requires its dependencies, and a mock created inside the factory would be a
// different function each time.
const mockFetch = jest.fn();
const mockGetAccessToken = jest.fn();

jest.mock('node-fetch', () => (...args) => mockFetch(...args));
jest.mock('../services/instagramTokenService', () => ({
  getInstagramTokenService: () => ({ getAccessToken: mockGetAccessToken }),
}));

const expiredTokenBody = JSON.stringify({
  error: {
    message:
      'Error validating access token: Session has expired on Friday, 26-Jun-26 15:48:19 PDT.',
    type: 'OAuthException',
    code: 190,
  },
});

function createReq() {
  return { body: {}, ip: '203.0.113.4', query: {}, get: jest.fn(() => null) };
}

function createRes() {
  return {
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
}

// The route caches a successful feed in a module-level TTL cache, so each test
// needs its own copy of the module.
function feedHandler() {
  jest.resetModules();
  const router = require('./instagram');
  const layer = router.stack.find(item => item.route?.path === '/feed' && item.route.methods?.get);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

const useToken = token => {
  mockGetAccessToken.mockResolvedValue(token);
};

const callFeed = async () => {
  const handler = feedHandler();
  const res = createRes();
  await handler(createReq(), res);
  return res;
};

describe('GET /api/instagram/feed', () => {
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => errorSpy.mockRestore());

  it('answers 503 not_configured when no token exists anywhere', async () => {
    useToken(null);

    const res = await callFeed();

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, error: 'not_configured' });
  });

  it('reports an expired token distinctly, not as a generic fetch failure', async () => {
    useToken('dead-token');
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => expiredTokenBody });

    const res = await callFeed();

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, error: 'token_expired' });
  });

  it('names the remedy in the log so the outage cannot stay silent', async () => {
    useToken('dead-token');
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => expiredTokenBody });

    await callFeed();

    const logged = errorSpy.mock.calls.map(args => args.join(' ')).join('\n');
    expect(logged).toContain('INSTAGRAM_ACCESS_TOKEN');
    expect(logged).toContain('Session has expired');
  });

  it('still reports a non-auth upstream error as fetch_failed', async () => {
    useToken('good-token');
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'upstream boom' });

    const res = await callFeed();

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ ok: false, error: 'fetch_failed' });
  });

  it('returns the feed using the token the service resolved', async () => {
    useToken('stored-token');
    mockFetch.mockImplementation(async url => ({
      ok: true,
      json: async () =>
        url.includes('/me/media')
          ? {
              data: [
                {
                  id: '1',
                  media_type: 'IMAGE',
                  media_url: 'https://cdn.test/1.jpg',
                  permalink: 'https://instagram.test/p/1',
                  caption: 'hello',
                },
              ],
            }
          : { name: 'Archivo Vintach', username: 'archivovintach' },
    }));

    const res = await callFeed();

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].mediaUrl).toBe('https://cdn.test/1.jpg');
    // The refreshed token, not the raw env var, is what reaches Instagram.
    expect(mockFetch.mock.calls.every(([url]) => url.includes('stored-token'))).toBe(true);
  });
});
