'use strict';

// Per-user rolling-hour cap on manual "Generar guía" retries. In-memory only
// (Heroku-safe — resets on restart, acceptable for a soft abuse cap). Each user
// gets a list of recent retry timestamps; entries older than an hour are pruned.
// Mirrors server/api/bulk-import/rateLimiter.js.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;
const store = new Map(); // userId -> number[] (timestamps in ms)

const prune = (timestamps, now) => timestamps.filter(t => now - t < WINDOW_MS);

// Atomically check the user's retry count for the last hour and, if under the
// cap, record this attempt. Returns true when allowed (and recorded), false when
// over the cap (nothing recorded).
const checkAndRecord = userId => {
  const now = Date.now();
  const recent = prune(store.get(userId) || [], now);
  if (recent.length >= MAX_PER_HOUR) {
    store.set(userId, recent);
    return false;
  }
  recent.push(now);
  store.set(userId, recent);
  return true;
};

module.exports = { checkAndRecord, _test: { store, WINDOW_MS, MAX_PER_HOUR } };
