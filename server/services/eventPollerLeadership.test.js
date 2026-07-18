'use strict';

const EventEmitter = require('events');

const { ADVISORY_LOCK_ID, EventPollerLeadership } = require('./eventPollerLeadership');

function createSharedLockPool() {
  let lockHolder = null;
  const clients = [];

  class FakeClient extends EventEmitter {
    async query(sql, params) {
      expect(params).toEqual([ADVISORY_LOCK_ID]);
      if (sql.includes('pg_try_advisory_lock')) {
        const acquired = lockHolder == null;
        if (acquired) lockHolder = this;
        return { rows: [{ acquired }] };
      }
      if (sql.includes('pg_advisory_unlock')) {
        if (lockHolder === this) lockHolder = null;
        return { rows: [{ pg_advisory_unlock: true }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }

    release(err) {
      this.releasedWith = err;
      if (err && lockHolder === this) lockHolder = null;
    }
  }

  return {
    clients,
    connect: jest.fn(async () => {
      const client = new FakeClient();
      clients.push(client);
      return client;
    }),
  };
}

describe('EventPollerLeadership', () => {
  const logger = {
    error: jest.fn(),
    log: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('allows only one process to run notification work at a time', async () => {
    const pool = createSharedLockPool();
    const first = new EventPollerLeadership({ pool, ownerId: 'web.1:101', logger });
    const second = new EventPollerLeadership({ pool, ownerId: 'web.2:202', logger });
    const notificationWork = jest.fn();

    if (await first.tryAcquire()) notificationWork();
    if (await second.tryAcquire()) notificationWork();

    expect(notificationWork).toHaveBeenCalledTimes(1);
    expect(first.isLeader()).toBe(true);
    expect(second.isLeader()).toBe(false);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Leadership acquired owner=web.1:101:')
    );
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Standby owner=web.2:202'));

    await first.release();
    expect(await second.tryAcquire()).toBe(true);
    expect(second.isLeader()).toBe(true);
  });

  test('reports leadership loss when the dedicated PostgreSQL connection fails', async () => {
    const pool = createSharedLockPool();
    const leadership = new EventPollerLeadership({ pool, ownerId: 'web.1:101', logger });
    const onLost = jest.fn();
    leadership.onLeadershipLost(onLost);
    await leadership.tryAcquire();
    const firstLeaseId = leadership.leaseId;

    const error = new Error('connection terminated');
    pool.clients[0].emit('error', error);

    expect(leadership.isLeader()).toBe(false);
    expect(onLost).toHaveBeenCalledWith(error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Leadership lost owner=web.1:101:'),
      error
    );

    expect(await leadership.tryAcquire()).toBe(true);
    expect(leadership.leaseId).not.toBe(firstLeaseId);
  });
});
