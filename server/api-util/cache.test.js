'use strict';

jest.mock('../log.js', () => ({
  devLogger: jest.fn(),
}));

const { createLRUCache, createTTLCache } = require('./cache');

describe('createTTLCache', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('deletes an expired entry when it is read', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T00:00:00.000Z'));
    const cache = createTTLCache(1);
    cache.token = 'value';

    jest.advanceTimersByTime(1001);

    expect(cache.token.data).toBeNull();
    expect(Object.keys(cache)).not.toContain('token');
  });

  it('evicts the oldest entry when maxEntries is reached', () => {
    const cache = createTTLCache(60, { maxEntries: 2 });
    cache.first = 'a';
    cache.second = 'b';
    cache.third = 'c';

    expect(cache.first.data).toBeNull();
    expect(cache.second.data).toBe('b');
    expect(cache.third.data).toBe('c');
  });
});

describe('LRUcache', () => {
  it('Set and get', () => {
    const memoryStore = { cache: new Map(), totalBytes: 0 };
    const cache = createLRUCache({ memoryStore, maxBytes: 32, ttl: 60 });
    cache.xProp = 'x';
    expect(cache.xProp.data).toEqual('x');
    expect(cache.xProp.bytes).toEqual(1);
    expect(cache.xProp.expiresAt).toBeGreaterThan(Date.now());
  });

  it('Get non-existent key', () => {
    const memoryStore = { cache: new Map(), totalBytes: 0 };
    const cache = createLRUCache({ memoryStore, maxBytes: 32, defaultTTL: 60 });
    expect(cache.xProp.data).toBeNull();
    expect(cache.xProp.bytes).toEqual(0);
  });

  it('cache does not grow beyond maxBytes', () => {
    const memoryStore = { cache: new Map(), totalBytes: 0 };
    const cache = createLRUCache({ memoryStore, maxBytes: 4, ttl: 60 });
    for (let i = 0; i < 10; i++) {
      // This cache implementation counts value bytes, not keys and metadata.
      cache[`x${i}`] = 'x';
    }
    expect([...memoryStore.cache.keys()]).toEqual(['x6', 'x7', 'x8', 'x9']);
    expect(memoryStore.cache.get('x0')).toBeUndefined();
  });

  it('cache does not return expired properties', () => {
    const prefilledCache = new Map();
    prefilledCache.set('xProp', { data: 'x', bytes: 1, expiresAt: 1735827232551 });

    const memoryStore = { cache: prefilledCache, totalBytes: 1 };
    const cache = createLRUCache({ memoryStore, maxBytes: 4, ttl: 60 });
    const { data, bytes } = cache.xProp;

    expect(data).toBeNull();
    expect(bytes).toEqual(0);
    expect(memoryStore.cache.get('xProp')).toBeUndefined();
  });

  it('cache does return non-expired properties', () => {
    const prefilledCache = new Map();
    const xPropExpires = Date.now() + 10000;
    prefilledCache.set('xProp', { data: 'x', bytes: 1, expiresAt: xPropExpires });

    const memoryStore = { cache: prefilledCache, totalBytes: 1 };
    const cache = createLRUCache({ memoryStore, maxBytes: 4, ttl: 60 });
    const { data, bytes, expiresAt } = cache.xProp;

    expect(data).toEqual('x');
    expect(bytes).toEqual(1);
    expect(expiresAt).toEqual(expiresAt);
  });

  it('cache maintains LRU order', () => {
    const memoryStore = { cache: new Map(), totalBytes: 0 };
    const cache = createLRUCache({ memoryStore, maxBytes: 4, ttl: 60 });

    for (let i = 0; i < 10; i++) {
      cache[`x${i}`] = 'x';
    }
    cache.x6;
    cache.x10 = 'x';

    expect([...memoryStore.cache.keys()]).toEqual(['x8', 'x9', 'x6', 'x10']);
  });
});
