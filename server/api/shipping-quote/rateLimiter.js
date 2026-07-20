'use strict';

// Soft per-user limit for carrier quotations. Authentication is enforced by
// the route; this protects eShip spend and keeps the bounded quote cache from
// being churned by one buyer.
const WINDOW_MS = 60 * 1000;
const MAX_PER_MINUTE = 30;
const store = new Map();

const checkAndRecord = userId => {
  const now = Date.now();
  const recent = (store.get(userId) || []).filter(timestamp => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_PER_MINUTE) {
    store.set(userId, recent);
    return false;
  }
  recent.push(now);
  store.set(userId, recent);
  return true;
};

module.exports = { checkAndRecord, _test: { store, WINDOW_MS, MAX_PER_MINUTE } };
