'use strict';

jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');
const { FetchTimeoutError, isFetchTimeout, requestWithTimeout } = require('./fetchWithTimeout');

const never = () => new Promise(() => {});
const responseWith = ({ ok = true, status = 200, json, text } = {}) => ({
  ok,
  status,
  json: json || (() => Promise.resolve({})),
  text: text || (() => Promise.resolve('')),
});

describe('requestWithTimeout', () => {
  beforeEach(() => {
    fetch.mockReset();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('passes an AbortSignal and returns what read() returns', async () => {
    let opts;
    fetch.mockImplementation((url, o) => {
      opts = o;
      return Promise.resolve(responseWith({ json: () => Promise.resolve({ a: 1 }) }));
    });
    const result = await requestWithTimeout(
      'https://x/y',
      { method: 'POST' },
      { timeoutMs: 5000, read: response => response.json() }
    );
    expect(result).toEqual({ a: 1 });
    expect(opts.method).toBe('POST');
    expect(opts.signal.aborted).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns the response itself without a read callback', async () => {
    const response = responseWith();
    fetch.mockResolvedValue(response);
    await expect(requestWithTimeout('https://x/y')).resolves.toBe(response);
  });

  it('times out while waiting for headers', async () => {
    let signal;
    fetch.mockImplementation((url, o) => {
      signal = o.signal;
      return never();
    });
    const pending = requestWithTimeout('https://x/y', {}, { timeoutMs: 1000 });
    jest.advanceTimersByTime(1000);
    const error = await pending.catch(e => e);
    expect(isFetchTimeout(error)).toBe(true);
    expect(error.phase).toBe('headers');
    expect(error.response).toBeNull();
    expect(signal.aborted).toBe(true);
  });

  it('keeps the deadline armed while a success body stalls', async () => {
    let signal;
    const response = responseWith({ json: never });
    fetch.mockImplementation((url, o) => {
      signal = o.signal;
      return Promise.resolve(response);
    });
    const pending = requestWithTimeout('https://x/y', {}, { timeoutMs: 1000, read: r => r.json() });
    await Promise.resolve();
    await Promise.resolve();
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(1000);
    const error = await pending.catch(e => e);
    expect(error).toBeInstanceOf(FetchTimeoutError);
    expect(error.phase).toBe('body');
    expect(error.response).toBe(response);
    expect(signal.aborted).toBe(true);
  });

  it('times out a stalled error body even when read() swallows failures', async () => {
    fetch.mockResolvedValue(responseWith({ ok: false, status: 502, text: never }));
    const pending = requestWithTimeout(
      'https://x/y',
      {},
      { timeoutMs: 1000, read: r => r.text().catch(() => '') }
    );
    // Let the headers arrive first.
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    const error = await pending.catch(e => e);
    expect(isFetchTimeout(error)).toBe(true);
    expect(error.response.status).toBe(502);
  });

  it('maps an AbortError raised by the transport to a timeout', async () => {
    fetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const error = await requestWithTimeout('https://x/y').catch(e => e);
    expect(isFetchTimeout(error)).toBe(true);
    expect(error.cause.name).toBe('AbortError');
  });

  it('propagates read() errors unchanged and clears the timer', async () => {
    const malformed = Object.assign(new Error('invalid json'), { type: 'invalid-json' });
    fetch.mockResolvedValue(responseWith({ json: () => Promise.reject(malformed) }));
    await expect(
      requestWithTimeout('https://x/y', {}, { timeoutMs: 1000, read: r => r.json() })
    ).rejects.toBe(malformed);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates transport errors unchanged', async () => {
    const reset = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    fetch.mockRejectedValue(reset);
    await expect(requestWithTimeout('https://x/y')).rejects.toBe(reset);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('uses an injected fetch implementation', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(responseWith());
    await requestWithTimeout('https://x/y', {}, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
