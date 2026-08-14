'use strict';

const mockRefreshIfNeeded = jest.fn();

jest.mock('./instagramTokenService', () => ({
  getInstagramTokenService: () => ({ refreshIfNeeded: mockRefreshIfNeeded }),
}));

const {
  startInstagramTokenRefresh,
  stopInstagramTokenRefresh,
} = require('./instagramTokenRefresh');

describe('startInstagramTokenRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRefreshIfNeeded.mockResolvedValue({ refreshed: false, reason: 'not_due' });
  });

  afterEach(() => {
    stopInstagramTokenRefresh();
    jest.useRealTimers();
  });

  it('checks immediately, because a sleepy service may never reach the timer', () => {
    startInstagramTokenRefresh();
    expect(mockRefreshIfNeeded).toHaveBeenCalledTimes(1);
  });

  it('keeps checking on the interval', () => {
    startInstagramTokenRefresh({ intervalMs: 1000 });

    jest.advanceTimersByTime(3000);

    expect(mockRefreshIfNeeded).toHaveBeenCalledTimes(4); // boot + 3 ticks
  });

  it('does not start a second timer when called twice', () => {
    startInstagramTokenRefresh({ intervalMs: 1000 });
    startInstagramTokenRefresh({ intervalMs: 1000 });

    jest.advanceTimersByTime(1000);

    expect(mockRefreshIfNeeded).toHaveBeenCalledTimes(2); // one boot check, one tick
  });

  it('stops checking after stop', () => {
    startInstagramTokenRefresh({ intervalMs: 1000 });
    stopInstagramTokenRefresh();

    jest.advanceTimersByTime(5000);

    expect(mockRefreshIfNeeded).toHaveBeenCalledTimes(1);
  });

  it('survives a rejected refresh without throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRefreshIfNeeded.mockRejectedValue(new Error('postgres down'));

    // Real timers here: the rejection travels through several microtask hops
    // after Babel's async transform, so flush with a real macrotask instead of
    // guessing a tick count. The 1s interval cannot fire in that window.
    jest.useRealTimers();

    expect(() => startInstagramTokenRefresh({ intervalMs: 1000 })).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(errorSpy).toHaveBeenCalledWith(
      '[instagram] Token refresh check failed:',
      'postgres down'
    );
    errorSpy.mockRestore();
  });
});
