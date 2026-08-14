import { fetchLocalTopbarData } from './categoryDropdowns';
import { fetchLocalDesignUsers } from './userDropdowns';

/**
 * Shared source for the two pieces of topbar data (the category dropdown config
 * and the local-design user list).
 *
 * The desktop menu and the mobile menu are both mounted on every page — the
 * mobile one just sits closed — so each of them fetching for itself doubled
 * every request, including the one that scans users on the server. Both now go
 * through here, and the second caller joins the first one's in-flight promise
 * instead of starting its own.
 *
 * The result is held for CACHE_TTL_MS so client-side navigation does not refetch
 * data that only changes on deploy or in Console.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

// { promise, resolvedAt } per key; `promise` is reused while in flight and, once
// settled, until it goes stale.
const entries = new Map();

const isFresh = entry =>
  entry && entry.resolvedAt != null && Date.now() - entry.resolvedAt < CACHE_TTL_MS;

const load = (key, fetcher) => {
  const entry = entries.get(key);
  // In flight (resolvedAt not set yet) or still fresh: share it.
  if (entry && (entry.resolvedAt == null || isFresh(entry))) {
    return entry.promise;
  }

  const record = { promise: null, resolvedAt: null };
  record.promise = Promise.resolve()
    .then(fetcher)
    .then(result => {
      record.resolvedAt = Date.now();
      return result;
    })
    .catch(error => {
      // Drop the failure so the next caller can retry rather than inherit it.
      entries.delete(key);
      throw error;
    });

  entries.set(key, record);
  return record.promise;
};

/**
 * The category-dropdown config from the local top-bar.json asset.
 * Resolves to null when it cannot be read (the menus then fall back to their
 * built-in defaults).
 *
 * @returns {Promise<Object|null>}
 */
export const getTopbarData = () => {
  const fetchFn = typeof window !== 'undefined' ? window.fetch?.bind(window) : null;
  return load('topbarData', () => fetchLocalTopbarData(fetchFn)).catch(() => null);
};

/**
 * The users shown in the topbar's "local design" dropdown.
 *
 * @returns {Promise<Array>} dropdown users, or [] when the request fails
 */
export const getLocalDesignUsers = () =>
  load('localDesignUsers', () => fetchLocalDesignUsers()).catch(() => []);

/** Test seam: forget everything fetched so far. */
export const resetTopbarDataCache = () => entries.clear();
