import { getMyBalanceSummary, updateMarketingPreference, trackMarketingEngagement } from './api';

const jsonResponse = data => ({
  status: 200,
  headers: { get: () => 'application/json; charset=utf-8' },
  json: () => Promise.resolve(data),
});

describe('AV JSON api helpers', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    window.fetch = jest.fn(() => Promise.resolve(jsonResponse({ ok: true })));
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('updateMarketingPreference sends its JSON body', async () => {
    await updateMarketingPreference({ enabled: true, source: 'signup_email' });

    const [url, options] = window.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/brevo\/preference$/);
    expect(options.method).toBe('PUT');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ enabled: true, source: 'signup_email' });
  });

  it('trackMarketingEngagement sends its JSON body', async () => {
    await trackMarketingEngagement({ listingId: 'listing-1', action: 'view' });

    const [url, options] = window.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/brevo\/engagement$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ listingId: 'listing-1', action: 'view' });
  });

  it('getMyBalanceSummary reads the balance summary with the session cookie', async () => {
    window.fetch.mockResolvedValueOnce(jsonResponse({ ok: true, completedTotalAmount: 5 }));
    await expect(getMyBalanceSummary()).resolves.toEqual({ ok: true, completedTotalAmount: 5 });

    const [url, options] = window.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/my-balance\/summary$/);
    expect(options.method).toBe('GET');
    expect(options.credentials).toBe('include');
  });

  it('getMyBalanceSummary rejects with the server error body', async () => {
    window.fetch.mockResolvedValueOnce({
      ...jsonResponse({ ok: false, error: 'summary_failed' }),
      status: 502,
    });
    await expect(getMyBalanceSummary()).rejects.toMatchObject({ error: 'summary_failed' });
  });
});
