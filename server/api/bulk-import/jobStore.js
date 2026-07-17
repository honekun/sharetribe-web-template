'use strict';

const crypto = require('crypto');

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

// A job that has sat in 'processing' this long without any progress update is
// treated as stale (wedged) and no longer counts as "active". This prevents a
// single wedged job from 409-locking a user's future imports for the full TTL.
// Must exceed the worker's per-row timeout (importWorker ROW_TIMEOUT_MS) so a
// legitimately slow row never trips it. The worker calls updateJob() after every
// row, so a healthy import keeps refreshing updatedAt well within this window.
const STALE_ACTIVE_MS = 5 * 60 * 1000; // 5 minutes without progress

const jobs = new Map();

const isJobActive = job =>
  job.status === 'processing' && Date.now() - (job.updatedAt || job.createdAt) < STALE_ACTIVE_MS;

function reArmCleanup(id, createdAt) {
  const ageMs = Date.now() - (createdAt || Date.now());
  const remaining = JOB_TTL_MS - ageMs;
  if (remaining <= 0) {
    jobs.delete(id);
    return;
  }
  setTimeout(() => {
    jobs.delete(id);
  }, remaining).unref();
}

function createJob(total, ownerId = null) {
  const id = crypto.randomUUID();
  const job = {
    id,
    ownerId,
    status: 'processing',
    total,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    results: [],
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  reArmCleanup(id, job.createdAt);
  return job;
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  // Track progress time so a wedged 'processing' job can be detected as stale.
  job.updatedAt = Date.now();
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

// True when the given user already has an import actively in progress. A wedged
// job (stale — no progress for STALE_ACTIVE_MS) does not count, so it can't block
// the user's future imports for the full 1-hour TTL.
function hasActiveJobForUser(ownerId) {
  for (const job of jobs.values()) {
    if (job.ownerId === ownerId && isJobActive(job)) return true;
  }
  return false;
}

// Number of imports actively processing across all users (global concurrency).
// Stale/wedged jobs are excluded so they don't consume global capacity.
function countActiveJobs() {
  let count = 0;
  for (const job of jobs.values()) {
    if (isJobActive(job)) count += 1;
  }
  return count;
}

module.exports = {
  createJob,
  updateJob,
  getJob,
  hasActiveJobForUser,
  countActiveJobs,
};
// Test-only: clear the in-memory store so suites don't leak active jobs.
module.exports._test = { reset: () => jobs.clear(), STALE_ACTIVE_MS, isJobActive };
