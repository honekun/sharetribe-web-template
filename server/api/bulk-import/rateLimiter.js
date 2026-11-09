'use strict';

// Per-user rolling-hour counters. In-memory only (Heroku-safe — resets on
// restart, which is acceptable for an abuse-prevention soft cap). Each user gets
// a list of recent timestamps; entries older than one hour are pruned.
//
//  - `store`: imports that actually started (the hourly import cap).
//  - `attemptStore`: every /start upload attempt that reached admission, valid
//    or not, so failed uploads are bounded too (audit A05).
const WINDOW_MS = 60 * 60 * 1000;
const store = new Map(); // userId -> number[] (timestamps in ms)
const attemptStore = new Map(); // userId -> number[] (timestamps in ms)

const prune = (timestamps, now) => timestamps.filter(t => now - t < WINDOW_MS);

const recordIfUnder = (counter, userId, maxPerHour) => {
  const now = Date.now();
  const recent = prune(counter.get(userId) || [], now);
  if (recent.length >= maxPerHour) {
    counter.set(userId, recent);
    return false;
  }
  recent.push(now);
  counter.set(userId, recent);
  return true;
};

/**
 * Atomically check the user's import count for the last hour and, if under the
 * cap, record this import. Returns true when the import is allowed (and recorded),
 * false when the user is over their hourly cap (nothing recorded).
 */
const checkAndRecord = (userId, maxPerHour) => recordIfUnder(store, userId, maxPerHour);

/**
 * Would an import start now fit under the hourly cap? Records nothing — used
 * before the upload is read, so an over-cap user is refused without buffering.
 */
const wouldAllow = (userId, maxPerHour) => {
  const recent = prune(store.get(userId) || [], Date.now());
  store.set(userId, recent);
  return recent.length < maxPerHour;
};

/** Record one upload attempt; false when the user is over the attempt cap. */
const checkAndRecordAttempt = (userId, maxPerHour) =>
  recordIfUnder(attemptStore, userId, maxPerHour);

module.exports = {
  checkAndRecord,
  checkAndRecordAttempt,
  wouldAllow,
  _test: { store, attemptStore, WINDOW_MS },
};
