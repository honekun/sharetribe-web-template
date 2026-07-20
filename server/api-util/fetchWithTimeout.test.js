'use strict';

jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');
const { fetchWithTimeout } = require('./fetchWithTimeout');

describe('fetchWithTimeout', () => {
  beforeEach(() => fetch.mockReset());

  it('passes an AbortSignal to fetch and returns the response', async () => {
    let opts;
    fetch.mockImplementation((url, o) => {
      opts = o;
      return Promise.resolve('response');
    });
    const res = await fetchWithTimeout('https://x/y', { method: 'POST' }, 5000);
    expect(res).toBe('response');
    expect(opts.method).toBe('POST');
    expect(opts.signal).toBeDefined();
    expect(opts.signal.aborted).toBe(false);
  });

  it('aborts the request once the timeout elapses', () => {
    jest.useFakeTimers();
    let signal;
    fetch.mockImplementation((url, o) => {
      signal = o.signal;
      return new Promise(() => {}); // never resolves
    });
    fetchWithTimeout('https://x/y', {}, 1000);
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(signal.aborted).toBe(true);
    jest.useRealTimers();
  });
});
