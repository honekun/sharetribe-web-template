'use strict';

const { getInstagramTokenService } = require('./instagramTokenService');

// Daily is plenty for a 60-day token with a 20-day refresh window, and it keeps
// the boot check as the primary trigger — on a service that sleeps, the timer
// may never fire at all.
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

let timer = null;

const runCheck = async () => {
  try {
    await getInstagramTokenService().refreshIfNeeded();
  } catch (err) {
    // Never let a decorative feed's token maintenance crash the process.
    console.error('[instagram] Token refresh check failed:', err.message);
  }
};

/**
 * Check the token now and once a day after that. Idempotent: calling it twice
 * does not start a second timer.
 */
const startInstagramTokenRefresh = ({ intervalMs = CHECK_INTERVAL_MS } = {}) => {
  if (timer) return timer;

  runCheck();

  timer = setInterval(runCheck, intervalMs);
  // Don't hold the process open on shutdown.
  if (timer.unref) timer.unref();
  return timer;
};

const stopInstagramTokenRefresh = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

module.exports = { CHECK_INTERVAL_MS, startInstagramTokenRefresh, stopInstagramTokenRefresh };
