'use strict';

// Row-level idempotency for bulk import.
//
// A row timeout only stops the worker waiting: the Integration API request it
// abandoned may still create the listing. Re-uploading the same file must then
// finish that listing, not create a second one. So every row gets a
// deterministic key, stamped into the listing's `metadata` (operator-only — a
// seller cannot edit it), and before creating anything the worker looks for a
// recent listing of the same author carrying that key.
//
// The lookup filters by author and creation time only, and matches the key in
// code. A `meta_*` filter would need a search schema, and without one Sharetribe
// silently ignores the filter instead of failing.

const crypto = require('crypto');

const { types } = require('sharetribe-flex-integration-sdk');

const { UUID } = types;

// listing.attributes.metadata[METADATA_KEY] = { key, complete }
const METADATA_KEY = 'avBulkImport';

// How far back a re-upload is matched against earlier imports. A row identical
// to one imported within this window is reported as already imported.
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

const PAGE_SIZE = 100;
// 2,000 listings by one author in the window. Beyond that the lookup cannot
// prove a row is new, so it fails rather than risk a duplicate.
const MAX_PAGES = 20;

const sha256 = data =>
  crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');

// JSON with sorted object keys, so key order in publicData never changes a hash.
const stableStringify = value => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
};

/**
 * Hash of everything the row would write. Image slots hash the file bytes, not
 * the filename, so re-uploading with corrected photos under the same names is a
 * different row.
 */
function rowFingerprint(row, imageMap) {
  const images = {};
  for (const [slot, filename] of Object.entries(row.imageSlots || {})) {
    const buffer = imageMap.get(filename);
    images[slot] = buffer ? sha256(buffer) : null;
  }
  return sha256(
    stableStringify({
      authorId: row.authorId,
      title: row.title,
      description: row.description,
      price: row.price,
      currency: row.currency,
      stock: row.stock,
      publish: row.publish,
      shippingEnabled: row.shippingEnabled,
      pickupEnabled: row.pickupEnabled,
      locationAddress: row.locationAddress,
      lat: row.lat,
      lng: row.lng,
      publicData: row.publicData || {},
      images,
      placeholder: row.usePlaceholderImage === true,
    })
  );
}

/**
 * Give every row an `importKey`. Identical rows in one file are numbered by
 * occurrence (`…-0`, `…-1`), so a file listing the same item twice still creates
 * two listings, and re-uploading that file maps each row back to its own.
 */
function assignRowKeys(rows, imageMap) {
  const seen = new Map();
  return rows.map(row => {
    const fingerprint = rowFingerprint(row, imageMap).slice(0, 40);
    const occurrence = seen.get(fingerprint) || 0;
    seen.set(fingerprint, occurrence + 1);
    return { ...row, importKey: `${fingerprint}-${occurrence}` };
  });
}

const stockQuantity = (listing, included) => {
  const ref = listing.relationships?.currentStock?.data;
  if (!ref) return null;
  const stock = included.find(item => item.type === ref.type && item.id?.uuid === ref.id?.uuid);
  const quantity = stock?.attributes?.quantity;
  return typeof quantity === 'number' ? quantity : null;
};

/**
 * Listings of `authorId` created within the window that carry an import key,
 * as Map<importKey, { id, state, stock, complete }>. Throws (avCode
 * 'idempotency-check-failed') when the author has more listings in the window
 * than the lookup reads.
 */
async function findImportedListings(sdk, authorId, { now = Date.now() } = {}) {
  const found = new Map();
  const createdAtStart = new Date(now - IDEMPOTENCY_WINDOW_MS);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await sdk.listings.query({
      authorId: new UUID(authorId),
      createdAtStart,
      states: ['published', 'closed', 'pendingApproval'],
      include: ['currentStock'],
      perPage: PAGE_SIZE,
      page,
    });
    const { data = [], included = [], meta = {} } = res.data || {};

    for (const listing of data) {
      const marker = listing.attributes?.metadata?.[METADATA_KEY];
      if (!marker || typeof marker.key !== 'string') continue;
      found.set(marker.key, {
        id: listing.id.uuid,
        state: listing.attributes.state,
        stock: stockQuantity(listing, included),
        complete: marker.complete === true,
      });
    }

    if (page >= (meta.totalPages || 1)) return found;
  }

  const err = new Error(
    `Author ${authorId} has more than ${MAX_PAGES * PAGE_SIZE} listings in the idempotency window`
  );
  err.avCode = 'idempotency-check-failed';
  throw err;
}

// Rows whose processing has not settled yet, across all jobs in this process:
// importKey -> Promise. A timed-out row stays here until its abandoned request
// finishes, so a re-upload cannot race it into a duplicate.
//
// Process-local by design: correct for the supported single web process. With
// more than one, two processes can both miss the metadata lookup and create the
// same row. A durable atomic claim per importKey is required before scaling
// web past 1 — see docs/pending/scaling.md.
const inFlight = new Map();

function trackInFlight(key, promise) {
  inFlight.set(key, promise);
  const clear = () => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  };
  promise.then(clear, clear);
  return promise;
}

const isInFlight = key => inFlight.has(key);
const getInFlight = key => inFlight.get(key) || null;

module.exports = {
  METADATA_KEY,
  IDEMPOTENCY_WINDOW_MS,
  assignRowKeys,
  findImportedListings,
  trackInFlight,
  isInFlight,
  getInFlight,
};
module.exports._test = {
  rowFingerprint,
  stableStringify,
  MAX_PAGES,
  reset: () => inFlight.clear(),
};
