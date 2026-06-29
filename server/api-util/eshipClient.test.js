'use strict';

jest.mock('node-fetch');
const fetch = require('node-fetch');
const { quote, EshipApiError, EshipTimeoutError, describeEshipError } = require('./eshipClient');

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

  it('throws EshipApiError on a non-2xx response and captures status + body + detail', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ status: 'ERROR', message: 'No couriers found for this account.' }),
    });
    await expect(quote(args)).rejects.toMatchObject({
      name: 'EshipApiError',
      status: 400,
      body: { status: 'ERROR', message: 'No couriers found for this account.' },
      detail: 'No couriers found for this account.',
    });
  });

  it('captures the raw text when the eShip error body is not JSON', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>Bad Gateway</html>',
    });
    try {
      await quote(args);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(EshipApiError);
      expect(e.text).toBe('<html>Bad Gateway</html>');
      expect(e.detail).toBe('<html>Bad Gateway</html>');
    }
  });

  it('throws EshipTimeoutError when the request aborts', async () => {
    fetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(quote(args)).rejects.toBeInstanceOf(EshipTimeoutError);
  });
});

describe('describeEshipError', () => {
  it('describes an EshipApiError with name, status and detail', () => {
    const e = new EshipApiError(400, { message: 'No couriers found for this account.' }, '');
    expect(describeEshipError(e)).toBe('EshipApiError [400]: No couriers found for this account.');
  });

  it('joins an errors array', () => {
    const e = new EshipApiError(
      422,
      { errors: [{ message: 'zip required' }, { message: 'bad state' }] },
      ''
    );
    expect(describeEshipError(e)).toBe('EshipApiError [422]: zip required; bad state');
  });

  it('falls back to the message for non-eShip errors', () => {
    expect(describeEshipError(new Error('connect ETIMEDOUT'))).toBe('Error: connect ETIMEDOUT');
  });
});
