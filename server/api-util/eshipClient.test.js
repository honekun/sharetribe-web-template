'use strict';

jest.mock('node-fetch');
const fetch = require('node-fetch');
const { quote, EshipApiError, EshipTimeoutError } = require('./eshipClient');

const okResponse = body => ({ ok: true, status: 200, json: async () => body });

describe('eshipClient.quote', () => {
  const args = {
    addressFrom: { zip: '06700', state: 'CDMX', country: 'MX' },
    addressTo: { zip: '64000', state: 'NL', country: 'MX' },
    parcels: [
      { length: 35, width: 30, height: 10, distance_unit: 'cm', weight: 1, mass_unit: 'kg' },
    ],
  };

  beforeEach(() => {
    fetch.mockReset();
    process.env.ESHIP_API_KEY = 'test-key';
  });

  it('POSTs to the quotation endpoint with a Bearer auth header', async () => {
    fetch.mockResolvedValue(okResponse({ quot_id: 'q1', rates: [] }));
    const res = await quote(args);
    expect(res).toEqual({ quot_id: 'q1', rates: [] });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toMatch(/\/quotation$/);
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(opts.body).parcels).toHaveLength(1);
  });

  it('throws EshipApiError on a non-2xx response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'bad' }) });
    await expect(quote(args)).rejects.toBeInstanceOf(EshipApiError);
  });

  it('throws EshipTimeoutError when the request aborts', async () => {
    fetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(quote(args)).rejects.toBeInstanceOf(EshipTimeoutError);
  });
});
