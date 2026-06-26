'use strict';

const { checkAndRecord, _test } = require('./rateLimiter');

describe('checkAndRecord', () => {
  beforeEach(() => {
    _test.store.clear();
  });

  it('allows up to maxPerHour imports then blocks', () => {
    expect(checkAndRecord('u1', 2)).toBe(true);
    expect(checkAndRecord('u1', 2)).toBe(true);
    expect(checkAndRecord('u1', 2)).toBe(false);
  });

  it('scopes counts per user', () => {
    expect(checkAndRecord('a', 1)).toBe(true);
    expect(checkAndRecord('a', 1)).toBe(false);
    // A different user has their own budget.
    expect(checkAndRecord('b', 1)).toBe(true);
  });

  it('does not record when over the cap', () => {
    checkAndRecord('u2', 1);
    checkAndRecord('u2', 1); // blocked, not recorded
    expect(_test.store.get('u2')).toHaveLength(1);
  });

  it('expires entries older than one hour', () => {
    checkAndRecord('u3', 1);
    // Backdate the recorded timestamp beyond the window.
    _test.store.set('u3', [Date.now() - (_test.WINDOW_MS + 1000)]);
    expect(checkAndRecord('u3', 1)).toBe(true);
  });
});
