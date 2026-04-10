'use strict';

const crypto = require('crypto');

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

const jobs = new Map();

function createJob(total) {
  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'processing',
    total,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    results: [],
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  scheduleCleanup(id);
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

function scheduleCleanup(id) {
  setTimeout(() => {
    jobs.delete(id);
  }, JOB_TTL_MS).unref();
}

module.exports = { createJob, updateJob, getJob };
