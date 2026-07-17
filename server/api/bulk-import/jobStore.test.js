'use strict';

const {
  createJob,
  updateJob,
  getJob,
  hasActiveJobForUser,
  countActiveJobs,
  _test,
} = require('./jobStore');

describe('jobStore', () => {
  beforeEach(() => {
    _test.reset();
  });

  describe('createJob', () => {
    it('creates a job with correct initial state', () => {
      const job = createJob(10);
      expect(job.id).toBeDefined();
      expect(typeof job.id).toBe('string');
      expect(job.status).toBe('processing');
      expect(job.total).toBe(10);
      expect(job.processed).toBe(0);
      expect(job.succeeded).toBe(0);
      expect(job.failed).toBe(0);
      expect(job.errors).toEqual([]);
      expect(job.results).toEqual([]);
      expect(job.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('generates unique IDs', () => {
      const job1 = createJob(1);
      const job2 = createJob(1);
      expect(job1.id).not.toBe(job2.id);
    });

    it('records the owner when provided', () => {
      const job = createJob(1, 'user-a');
      expect(job.ownerId).toBe('user-a');
    });

    it('defaults ownerId to null when omitted', () => {
      expect(createJob(1).ownerId).toBeNull();
    });
  });

  describe('ownership and concurrency', () => {
    it('scopes the active-job check per user', () => {
      createJob(3, 'user-a');
      expect(hasActiveJobForUser('user-a')).toBe(true);
      expect(hasActiveJobForUser('user-b')).toBe(false);
    });

    it('stops counting a user job once it completes', () => {
      const job = createJob(1, 'user-a');
      expect(hasActiveJobForUser('user-a')).toBe(true);
      updateJob(job.id, { status: 'completed' });
      expect(hasActiveJobForUser('user-a')).toBe(false);
    });

    it('counts active jobs globally across users', () => {
      createJob(1, 'u1');
      createJob(1, 'u2');
      const j3 = createJob(1, 'u3');
      expect(countActiveJobs()).toBe(3);
      updateJob(j3.id, { status: 'completed' });
      expect(countActiveJobs()).toBe(2);
    });

    it('stops counting a wedged (stale) processing job as active', () => {
      const job = createJob(1, 'user-a');
      expect(hasActiveJobForUser('user-a')).toBe(true);
      expect(countActiveJobs()).toBe(1);

      // Simulate a job that has sat in 'processing' with no progress past the
      // stale window (the worker never called updateJob again).
      job.updatedAt = Date.now() - (_test.STALE_ACTIVE_MS + 1000);

      expect(hasActiveJobForUser('user-a')).toBe(false);
      expect(countActiveJobs()).toBe(0);
    });

    it('refreshes updatedAt on progress so a healthy job stays active', () => {
      const job = createJob(1, 'user-a');
      job.updatedAt = Date.now() - (_test.STALE_ACTIVE_MS + 1000); // pretend it went stale
      expect(hasActiveJobForUser('user-a')).toBe(false);

      // A progress update (as the worker does after each row) revives it.
      updateJob(job.id, { processed: 1 });
      expect(hasActiveJobForUser('user-a')).toBe(true);
    });
  });

  describe('getJob', () => {
    it('returns null for non-existent job', () => {
      expect(getJob('nonexistent-id')).toBeNull();
    });

    it('returns the job by ID', () => {
      const job = createJob(5);
      const fetched = getJob(job.id);
      expect(fetched).toBe(job);
      expect(fetched.total).toBe(5);
    });
  });

  describe('updateJob', () => {
    it('updates job fields', () => {
      const job = createJob(3);
      const updated = updateJob(job.id, { processed: 1, succeeded: 1 });
      expect(updated.processed).toBe(1);
      expect(updated.succeeded).toBe(1);
      expect(updated.status).toBe('processing');
    });

    it('returns null for non-existent job', () => {
      const result = updateJob('nonexistent', { processed: 1 });
      expect(result).toBeNull();
    });

    it('updates status to completed', () => {
      const job = createJob(1);
      updateJob(job.id, { status: 'completed' });
      expect(getJob(job.id).status).toBe('completed');
    });

    it('preserves arrays (errors/results) by reference', () => {
      const job = createJob(2);
      job.errors.push({ row: 2, title: 'Test', error: 'fail' });
      const fetched = getJob(job.id);
      expect(fetched.errors).toHaveLength(1);
      expect(fetched.errors[0].row).toBe(2);
    });
  });
});
