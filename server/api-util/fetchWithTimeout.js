'use strict';

// One deadline for a whole outbound HTTP exchange: connecting, receiving the
// headers, and reading the body. node-fetch resolves as soon as the headers
// arrive, so a timer cleared at that point leaves a stalled body free to hold a
// checkout quote, a label purchase or a poller tick indefinitely (audit A06).
// Every provider client (eShip, Brevo, WhatsApp, Instagram) goes through
// `requestWithTimeout` so the behaviour cannot drift between them.

const fetch = require('node-fetch');

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * The deadline passed. `response` is the response whose body was still being
 * read (`phase: 'body'`), or null when no headers arrived (`phase: 'headers'`),
 * so a caller can keep classifying a non-2xx status it already saw.
 */
class FetchTimeoutError extends Error {
  constructor(timeoutMs, response = null, cause = null) {
    super(`Request timed out after ${timeoutMs} ms`);
    this.name = 'FetchTimeoutError';
    this.code = 'ETIMEDOUT';
    this.timeoutMs = timeoutMs;
    this.response = response;
    this.phase = response ? 'body' : 'headers';
    if (cause) this.cause = cause;
  }
}

const isFetchTimeout = error => error instanceof FetchTimeoutError;

/**
 * Fetch `url` and run `read(response)` under one deadline.
 *
 * Read the body inside `read` (status checks, `json()`, `text()`): whatever it
 * returns is the result, and whatever it throws propagates unchanged. When the
 * deadline passes first, the request is aborted and a `FetchTimeoutError` is
 * thrown even if `read` would have swallowed the abort. The timer is cleared as
 * soon as the exchange settles.
 *
 * @param {string} url
 * @param {Object} [options] - fetch options (a `signal` is supplied here)
 * @param {Object} [config]
 * @param {number} [config.timeoutMs=10000]
 * @param {(response: Response) => any} [config.read] - defaults to returning the response
 * @param {Function} [config.fetchImpl] - injectable fetch (tests, token refresh)
 */
async function requestWithTimeout(url, options = {}, config = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, read = response => response, fetchImpl = fetch } = config;
  const controller = new AbortController();
  let response = null;
  let timer;

  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new FetchTimeoutError(timeoutMs, response));
      controller.abort();
    }, timeoutMs);
  });
  const exchange = (async () => {
    response = await fetchImpl(url, { ...options, signal: controller.signal });
    return read(response);
  })();

  try {
    return await Promise.race([exchange, deadline]);
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new FetchTimeoutError(timeoutMs, response, error);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    // The losing side may still settle (an aborted read rejects later).
    exchange.catch(() => {});
    deadline.catch(() => {});
  }
}

module.exports = { DEFAULT_TIMEOUT_MS, FetchTimeoutError, isFetchTimeout, requestWithTimeout };
