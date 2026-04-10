'use strict';

const { createJob, updateJob, getJob } = require('./jobStore');

describe('jobStore', () => {
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
