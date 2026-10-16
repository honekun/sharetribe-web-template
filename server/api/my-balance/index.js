'use strict';

const express = require('express');
const { getSdk } = require('../../api-util/sdk');
const { createTTLCache } = require('../../api-util/cache');
const { createRateLimiter } = require('../../api-util/rateLimit');
const {
  PAYMENT_PROCESS_NAMES,
  COMPLETED_TRANSITIONS,
  REFUNDED_TRANSITIONS,
} = require('./balanceTransitions');

const router = express.Router();

// Per-user summary cache. 60s is a reasonable balance: hides repeat hits during
// a session, but a fresh sale shows up within a minute. Keyed by user id only:
// every input to the summary is derived server-side, so the caller cannot mint
// new keys, and maxEntries bounds the process even across many users.
const CACHE_TTL_SECONDS = 60;
const CACHE_MAX_ENTRIES = 1000;
const summaryCache = createTTLCache(CACHE_TTL_SECONDS, { maxEntries: CACHE_MAX_ENTRIES });

// Concurrent requests from one user share a single computation instead of each
// starting their own pagination chain before the cache is filled.
const inFlight = new Map(); // userId -> Promise<summary>

// The page fetches the summary once per session; this only stops a client
// hammering the endpoint (each miss still costs a currentUser.show).
const rateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20 });

// Hard caps to bound worst-case latency: one chain, at most 5000 transactions.
const PER_PAGE = 100;
const MAX_PAGES = 50;

// Fully paginate `sdk.transactions.query` over `params` until totalPages or MAX_PAGES.
async function paginateAll(sdk, params) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await sdk.transactions.query({ ...params, page, perPage: PER_PAGE });
    const data = res?.data?.data || [];
    all.push(...data);
    totalPages = res?.data?.meta?.totalPages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);
  return { transactions: all, truncated: totalPages > MAX_PAGES };
}

// One pass over every sale, bucketed by last transition and by whether it was
// created this month. Pending = neither completed nor refunded.
function summarize(transactions, monthStart) {
  const completed = new Set(COMPLETED_TRANSITIONS);
  const refunded = new Set(REFUNDED_TRANSITIONS);
  const totals = {
    completedTotalAmount: 0,
    pendingTotalAmount: 0,
    cancelledCount: 0,
    currentMonthCompletedAmount: 0,
    currentMonthPendingAmount: 0,
    currentMonthCancelledCount: 0,
  };
  let currency = null;

  for (const tx of transactions) {
    const { lastTransition, payoutTotal, createdAt } = tx?.attributes || {};
    const createdTime = createdAt ? new Date(createdAt).getTime() : NaN;
    const isThisMonth = createdTime >= monthStart.getTime();
    const amount = payoutTotal?.amount || 0;

    if (refunded.has(lastTransition)) {
      totals.cancelledCount += 1;
      if (isThisMonth) totals.currentMonthCancelledCount += 1;
      continue;
    }

    if (payoutTotal && !currency) currency = payoutTotal.currency;
    if (completed.has(lastTransition)) {
      totals.completedTotalAmount += amount;
      if (isThisMonth) totals.currentMonthCompletedAmount += amount;
    } else {
      totals.pendingTotalAmount += amount;
      if (isThisMonth) totals.currentMonthPendingAmount += amount;
    }
  }

  return { ...totals, currency };
}

async function computeSummary(sdk, now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const { transactions, truncated } = await paginateAll(sdk, {
    only: 'sale',
    processNames: PAYMENT_PROCESS_NAMES,
    'fields.transaction': ['payoutTotal', 'lastTransition', 'createdAt'],
  });
  return { ...summarize(transactions, monthStart), truncated };
}

async function summaryHandler(req, res) {
  const sdk = getSdk(req, res);

  let userId;
  try {
    const me = await sdk.currentUser.show();
    userId = me?.data?.data?.id?.uuid;
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const { data: cached } = summaryCache[userId] || {};
  if (cached) {
    return res.json({ ok: true, ...cached });
  }

  try {
    let pending = inFlight.get(userId);
    if (!pending) {
      pending = computeSummary(sdk).finally(() => inFlight.delete(userId));
      inFlight.set(userId, pending);
    }
    const summary = await pending;
    summaryCache[userId] = summary;
    return res.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[my-balance] summary computation failed:', err);
    return res.status(502).json({ ok: false, error: 'summary_failed' });
  }
}

router.get('/summary', rateLimiter, summaryHandler);

module.exports = router;
module.exports.summaryHandler = summaryHandler;
module.exports.computeSummary = computeSummary;
module.exports.summarize = summarize;
module.exports._test = { summaryCache, inFlight, MAX_PAGES, CACHE_MAX_ENTRIES };
