'use strict';

// Per-user rolling-hour import counter. In-memory only (Heroku-safe — resets on
// restart, which is acceptable for an abuse-prevention soft cap). Each user gets
// a list of recent import-start timestamps; entries older than one hour are pruned.
const WINDOW_MS = 60 * 60 * 1000;
const store = new Map(); // userId -> number[] (timestamps in ms)

const prune = (timestamps, now) => timestamps.filter(t => now - t < WINDOW_MS);

/**
 * Atomically check the user's import count for the last hour and, if under the
 * cap, record this import. Returns true when the import is allowed (and recorded),
 * false when the user is over their hourly cap (nothing recorded).
 */
const checkAndRecord = (userId, maxPerHour) => {
  const now = Date.now();
  const recent = prune(store.get(userId) || [], now);
  if (recent.length >= maxPerHour) {
    store.set(userId, recent);
    return false;
  }
  recent.push(now);
  store.set(userId, recent);
  return true;
};

module.exports = { checkAndRecord, _test: { store, WINDOW_MS } };
