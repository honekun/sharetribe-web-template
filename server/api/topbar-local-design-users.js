'use strict';

const { getIntegrationSdk } = require('../services/integrationSdk');
const { createTTLCache } = require('../api-util/cache');

const USERS_PER_PAGE = 100;
const MAX_PAGES = 20;
const CACHE_TTL_SECONDS = 300;
const usersCache = createTTLCache(CACHE_TTL_SECONDS);
const CACHE_KEY = 'local-design-users';

const STORE_USER_TYPE = 'vendedor-tienda';

// The narrow query the Integration API can serve when the marketplace has
// extended-data schemas for these keys. Without a schema the API rejects the
// filter, and we fall back to reading every user and filtering here.
const FILTER_PARAMS = { pub_userType: STORE_USER_TYPE };

// Set once the API has told us the filter is unusable, so a cold cache does not
// pay for a failing request every time.
let filteredQuerySupported = null;

// In-flight work, shared by every request that arrives while it runs.
let pendingLoad = null;

const isTruthyLocalDesignValue = value =>
  value === true || value === 1 || value === '1' || value === 'true';

const getUserType = user => user?.attributes?.profile?.publicData?.userType;
const getLocalDesignValue = user =>
  user?.attributes?.profile?.metadata?.localDesign ??
  user?.attributes?.profile?.publicData?.localDesign ??
  null;

async function queryUsers(sdk, extraParams) {
  const allUsers = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await sdk.users.query({
      ...extraParams,
      page,
      perPage: USERS_PER_PAGE,
    });

    allUsers.push(...(response?.data?.data || []));
    totalPages = response?.data?.meta?.totalPages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return allUsers;
}

/**
 * The store users, fetched with the `pub_userType` filter when the marketplace
 * defines a schema for it, and by reading every user otherwise.
 */
async function queryCandidateUsers(sdk) {
  if (filteredQuerySupported !== false) {
    try {
      const users = await queryUsers(sdk, FILTER_PARAMS);
      filteredQuerySupported = true;
      return users;
    } catch (error) {
      if (filteredQuerySupported === true) {
        // The filter worked before, so this is a real failure, not a missing schema.
        throw error;
      }
      filteredQuerySupported = false;
      console.warn(
        '[topbar-local-design-users] pub_userType filter rejected; falling back to a full scan.',
        'Define a user-field schema for userType in Console to avoid it.'
      );
    }
  }

  return queryUsers(sdk);
}

function buildDropdownUsers(users) {
  return users
    .filter(user => getUserType(user) === STORE_USER_TYPE)
    .filter(user => isTruthyLocalDesignValue(getLocalDesignValue(user)))
    .map(user => {
      const id = user?.id?.uuid;
      const displayName =
        user?.attributes?.profile?.displayName || user?.attributes?.profile?.abbreviatedName || id;

      return id
        ? {
            id,
            text: displayName,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.text.localeCompare(b.text, 'es'));
}

/**
 * Cached dropdown users. Concurrent callers on a cold cache share one load
 * instead of each scanning users of their own.
 */
function loadDropdownUsers() {
  const { data: cached } = usersCache[CACHE_KEY] || {};
  if (cached) {
    return Promise.resolve(cached);
  }
  if (pendingLoad) {
    return pendingLoad;
  }

  pendingLoad = (async () => {
    const sdk = getIntegrationSdk();
    const users = await queryCandidateUsers(sdk);
    const dropdownUsers = buildDropdownUsers(users);
    usersCache[CACHE_KEY] = dropdownUsers;
    return dropdownUsers;
  })().finally(() => {
    pendingLoad = null;
  });

  return pendingLoad;
}

module.exports = async (req, res) => {
  try {
    const users = await loadDropdownUsers();
    return res.json({ users });
  } catch (error) {
    console.error('[topbar-local-design-users] Failed to load users:', error);
    return res.status(500).json({ error: 'failed_to_load_users' });
  }
};

// Test seam: drop the cached list and any in-flight load. Pass
// keepFilterSupport to keep what has been learned about the pub_ filter, which
// is what a real process does between cache expiries.
module.exports.resetForTests = ({ keepFilterSupport = false } = {}) => {
  delete usersCache[CACHE_KEY];
  pendingLoad = null;
  if (!keepFilterSupport) {
    filteredQuerySupported = null;
  }
};
