'use strict';

// node-fetch has no built-in timeout, so a hung upstream connection would stall
// the request (and, on the poller path, the whole poll loop) indefinitely. This
// wraps fetch with an AbortController that aborts after `timeoutMs`. Mirrors the
// inline timeout in api-util/eshipClient.js; shared so all outbound calls behave
// the same.

const fetch = require('node-fetch');

const DEFAULT_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchWithTimeout, DEFAULT_TIMEOUT_MS };
