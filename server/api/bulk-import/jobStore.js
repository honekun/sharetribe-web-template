'use strict';

const crypto = require('crypto');

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

const jobs = new Map();

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
  };
  jobs.set(id, job);
  reArmCleanup(id, job.createdAt);
  return job;
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

// True when the given user already has an import in progress.
function hasActiveJobForUser(ownerId) {
  for (const job of jobs.values()) {
    if (job.ownerId === ownerId && job.status === 'processing') return true;
  }
  return false;
}

// Number of imports currently processing across all users (global concurrency).
function countActiveJobs() {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === 'processing') count += 1;
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
module.exports._test = { reset: () => jobs.clear() };
