'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { types } = require('sharetribe-flex-integration-sdk');

const { getPackageSizeForCategory } = require('../../../src/config/configAVShipping');
const { getIntegrationSdk } = require('../../services/integrationSdk');
const { getJob, updateJob } = require('./jobStore');
const { getPlaceholderImage } = require('./placeholderImage');
const { omitSystemPublicDataKeys } = require('./publicDataKeys');
const {
  METADATA_KEY,
  assignRowKeys,
  findImportedListings,
  trackInFlight,
  isInFlight,
  getInFlight,
} = require('./rowIdempotency');

const { UUID, Money, LatLng } = types;

const DELAY_BETWEEN_ROWS_MS = 500;
const MAX_JOB_ERRORS = 200;

// Upper bound on how long a single row (image uploads + listing create + stock)
// may take. If an SDK request stalls with no response, the row is failed instead
// of wedging the whole job in 'processing' forever. Kept well below the jobStore
// STALE_ACTIVE_MS window so a slow-but-healthy row never looks wedged.
const ROW_TIMEOUT_MS = 90 * 1000;

// After the last row, how long to wait for timed-out rows' abandoned requests
// to settle before reconciling them. Also below STALE_ACTIVE_MS.
const RECONCILE_GRACE_MS = 30 * 1000;

// Pause before retrying a failed prior-imports lookup once.
const LOOKUP_RETRY_DELAY_MS = 1000;

// Reject `promise` if it hasn't settled within `ms`. The underlying request may
// still resolve later in the background, but the caller stops waiting on it;
// `onTimeout` lets the row stop before its next step (see createRowContext).
function withTimeout(promise, ms, label, onTimeout = () => {}) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.avCode = 'row-timeout'; // stable code the client maps to a translated message
      reject(err);
    }, ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const SLOT_ORDER = ['front', 'back', 'horizontal', 'details'];

const MAX_SDK_ERRORS_KEPT = 5;

/**
 * Serialize an SDK / generic Error into a JSON-safe shape that preserves
 * Sharetribe SDK validation detail (`err.data.errors`) when present.
 */
function serializeSdkError(err) {
  if (!err) return { message: 'Error desconocido' };
  const out = {
    message: err.message || 'Unknown error',
  };
  if (err.status) out.status = err.status;
  // Synthetic AV error code for worker-thrown errors (kept in its own namespace so
  // axios/SDK internal `err.code` values never leak to the client mapping).
  if (err.avCode) out.code = err.avCode;
  const sdkErrors = err.data && Array.isArray(err.data.errors) ? err.data.errors : null;
  if (sdkErrors && sdkErrors.length > 0) {
    out.sdkErrors = sdkErrors.slice(0, MAX_SDK_ERRORS_KEPT).map(e => ({
      status: e.status,
      code: e.code,
      title: e.title,
      source: e.source,
    }));
    if (sdkErrors.length > MAX_SDK_ERRORS_KEPT) {
      out.sdkErrorsTruncated = sdkErrors.length - MAX_SDK_ERRORS_KEPT;
    }
  }
  return out;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const avError = (message, avCode) => Object.assign(new Error(message), { avCode });

/**
 * Upload a single image buffer to Sharetribe via Integration SDK.
 * Returns the image UUID string.
 *
 * The SDK's MultipartRequest interceptor calls fd.append(key, value) without
 * content-type options. Passing a raw Buffer causes form-data to use
 * Content-Type: application/octet-stream (→ API returns 500). Passing a file
 * path string makes the SDK call fs.createReadStream(), from which form-data
 * can both stat() the real file for Content-Length and infer the MIME type
 * from the extension. The temp file is deleted immediately after upload.
 */
async function uploadImage(sdk, imageBuffer, filename) {
  const ext = path.extname(filename) || '.jpg';
  const tmpFile = path.join(os.tmpdir(), `av-bulk-${process.pid}-${Date.now()}${ext}`);
  fs.writeFileSync(tmpFile, imageBuffer);
  try {
    const res = await sdk.images.upload({ image: tmpFile });
    return res.data.data.id.uuid;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch (_) {}
  }
}

/**
 * Per-attempt state for one row. `checkpoint()` runs before every API call: once
 * the row has timed out, the abandoned attempt stops at its next step instead of
 * carrying on (and, say, approving a listing) after the job reported it failed.
 * `listing` is set as soon as the listing exists, for error reporting.
 */
function createRowContext() {
  const ctx = {
    cancelled: false,
    listing: null,
    checkpoint() {
      if (ctx.cancelled) throw avError('Row cancelled after timeout', 'row-cancelled');
    },
  };
  return ctx;
}

/**
 * Bring a created listing to its final state. Every step is safe to repeat, so
 * this both finishes a fresh listing and resumes one an earlier attempt left
 * half-done:
 *
 *  1. stock — only when the listing has none yet (compare-and-set from null);
 *  2. approve — pendingApproval → published. The listing stays invisible to
 *     buyers until stock is in place;
 *  3. close — for publish:no rows;
 *  4. mark the import key complete, so a later re-upload skips the row.
 *
 * A listing that is closed while still incomplete is never reopened: only a
 * seller can have closed it, after approval.
 */
async function finishListing(sdk, row, listing, ctx, outcome) {
  ctx.listing = listing;
  if (listing.complete) {
    return { listingId: listing.id, state: listing.state, outcome: 'existing' };
  }
  const id = new UUID(listing.id);

  if (row.stock > 0 && listing.stock == null) {
    ctx.checkpoint();
    await sdk.stock.compareAndSet({ listingId: id, oldTotal: null, newTotal: row.stock });
    listing.stock = row.stock;
  }

  if (listing.state === 'pendingApproval') {
    ctx.checkpoint();
    await sdk.listings.approve({ id });
    listing.state = 'published';
  }

  if (!row.publish && listing.state === 'published') {
    ctx.checkpoint();
    await sdk.listings.close({ id });
    listing.state = 'closed';
  }

  // The listing is already correct; a failed marker only means a re-upload
  // repeats these (no-op) steps, so it must not fail the row.
  ctx.checkpoint();
  try {
    await sdk.listings.update({
      id,
      metadata: { [METADATA_KEY]: { key: row.importKey, complete: true } },
    });
    listing.complete = true;
  } catch (err) {
    console.warn(
      `[bulk-import] Row ${row.rowNum}: listing ${listing.id} finished but its import marker was not saved:`,
      JSON.stringify(serializeSdkError(err))
    );
  }

  return { listingId: listing.id, state: listing.state, outcome };
}

/**
 * Process a single CSV row: upload images, create the listing hidden
 * (pendingApproval) with its import key, then finish it. With `existing` — a
 * listing an earlier attempt created for this row — only the finishing steps
 * run.
 */
async function processRow(sdk, row, imageMap, config, ctx, existing = null) {
  if (existing) return finishListing(sdk, row, existing, ctx, 'resumed');

  // authorId is resolved upstream in validateRows (the signed-in user by
  // default, or an admin `user_id` override).
  const authorId = row.authorId;
  if (!authorId) throw avError('No se resolvió ningún autor para la fila del CSV.', 'no-author');

  const imageSlotMapping = {};
  const imageUuids = [];

  // Rows that reference no photo at all (images are optional in the CSV) get the
  // bundled placeholder as their single image. It is deliberately left out of
  // imageSlots — it is not a "front"/"back" photo and must not be captioned as one.
  const usePlaceholder = row.usePlaceholderImage === true;
  let placeholderImageId = null;

  if (usePlaceholder) {
    const { buffer, filename } = getPlaceholderImage();
    ctx.checkpoint();
    placeholderImageId = await uploadImage(sdk, buffer, filename);
    imageUuids.push(new UUID(placeholderImageId));
  } else {
    // Upload images in slot order
    for (const slotKey of SLOT_ORDER) {
      const filename = row.imageSlots[slotKey];
      if (filename && imageMap.has(filename)) {
        const buffer = imageMap.get(filename);
        ctx.checkpoint();
        const uuid = await uploadImage(sdk, buffer, filename);
        imageSlotMapping[slotKey] = uuid;
        imageUuids.push(new UUID(uuid));
      }
    }
  }

  // Build publicData. CSV values go first and system-owned values last, so a
  // column can never override them; validateRows already rejects such columns,
  // and omitSystemPublicDataKeys drops them again here in case a row bypassed it.
  const csvPublicData = omitSystemPublicDataKeys(row.publicData);
  const publicData = {
    ...csvPublicData,
    listingType: config.listingType,
    transactionProcessAlias: config.transactionAlias,
    unitType: config.unitType,
    shippingEnabled: row.shippingEnabled,
    pickupEnabled: row.pickupEnabled,
    // Bulk imports do not expose a package-size input. Derive and persist the
    // authoritative value from the imported category path so checkout, quoting,
    // and later listing edits all see the same value as the regular wizard.
    avPackageSize: getPackageSizeForCategory(
      csvPublicData.categoryLevel1,
      csvPublicData.categoryLevel2,
      csvPublicData.categoryLevel3
    ),
  };

  // originalPrice must be stored as { amount (subunits), currency } to match
  // the Money format expected by OrderPanel and EditListingPricingAndStockPanel.
  if (publicData.originalPrice != null && publicData.originalPrice !== '') {
    const rawVal = parseFloat(publicData.originalPrice);
    if (!isNaN(rawVal) && rawVal > 0) {
      publicData.originalPrice = {
        amount: Math.round(rawVal * 100),
        currency: row.currency,
      };
    } else {
      delete publicData.originalPrice;
    }
  } else {
    delete publicData.originalPrice;
  }

  if (Object.keys(imageSlotMapping).length > 0) {
    publicData.imageSlots = imageSlotMapping;
  }

  // Marks the listing as still needing real photos, so placeholder imports can be
  // found later with a pub_avPlaceholderImage query. The image id lets a later
  // listing edit clear the flag once the placeholder is gone — see
  // src/util/avPlaceholderListing.js.
  if (usePlaceholder) {
    publicData.avPlaceholderImage = true;
    publicData.avPlaceholderImageId = placeholderImageId;
  }

  if (row.locationAddress) {
    publicData.location = { address: row.locationAddress };
  }

  const priceAmount = Math.round(row.price * 100);

  // The Integration API creates a listing either 'published' or
  // 'pendingApproval' ('draft' is a Marketplace API concept). pendingApproval
  // keeps it out of search until stock is set: if a later step fails, no buyer
  // ever sees a listing without stock.
  const listingParams = {
    authorId: new UUID(authorId),
    state: 'pendingApproval',
    title: row.title,
    description: row.description,
    price: new Money(priceAmount, row.currency),
    publicData,
    metadata: { [METADATA_KEY]: { key: row.importKey, complete: false } },
    images: imageUuids,
  };

  if (row.lat !== null && row.lng !== null) {
    listingParams.geolocation = new LatLng(row.lat, row.lng);
  }

  ctx.checkpoint();
  const createRes = await sdk.listings.create(listingParams, { expand: true });

  const created = createRes.data.data;
  const listing = {
    id: created.id.uuid,
    state: created.attributes?.state || 'pendingApproval',
    stock: null,
    complete: false,
  };
  return finishListing(sdk, row, listing, ctx, 'created');
}

/**
 * processRow plus compensation. When a step after the listing exists fails, a
 * publish:no row may have been approved but not closed — close it again, so a
 * failed row never leaves a listing visible that the operator asked to keep
 * closed. Any other half-done listing is still pendingApproval (hidden), and
 * re-uploading the file resumes it. The error is tagged 'row-incomplete' with
 * the listing id and state.
 *
 * A cancelled (timed-out) attempt skips compensation: the job has already
 * reported the row, and the reconciliation pass takes it from there.
 */
async function runRow(sdk, row, imageMap, config, ctx, existing) {
  try {
    return await processRow(sdk, row, imageMap, config, ctx, existing);
  } catch (err) {
    const { listing } = ctx;
    if (!listing || ctx.cancelled) throw err;

    if (!row.publish && listing.state === 'published') {
      try {
        await sdk.listings.close({ id: new UUID(listing.id) });
        listing.state = 'closed';
      } catch (closeErr) {
        console.error(
          `[bulk-import] Row ${row.rowNum}: could not close listing ${listing.id} after a failure:`,
          JSON.stringify(serializeSdkError(closeErr))
        );
      }
    }
    err.avCode = 'row-incomplete';
    err.listingId = listing.id;
    err.listingState = listing.state;
    throw err;
  }
}

/**
 * Prior imports of one author within the idempotency window, retried once. On a
 * second failure the error is returned (not thrown): that author's rows then
 * fail with 'idempotency-check-failed' instead of risking duplicates.
 */
async function lookupPriorImports(sdk, authorId) {
  try {
    return await findImportedListings(sdk, authorId);
  } catch (firstErr) {
    if (firstErr.avCode === 'idempotency-check-failed') return firstErr;
    await delay(LOOKUP_RETRY_DELAY_MS);
    try {
      return await findImportedListings(sdk, authorId);
    } catch (err) {
      console.error(
        `[bulk-import] Could not look up prior imports for author ${authorId}:`,
        JSON.stringify(serializeSdkError(err))
      );
      err.avCode = 'idempotency-check-failed';
      return err;
    }
  }
}

function buildErrorEntry(row, err) {
  const serialized = serializeSdkError(err);
  return {
    row: row.rowNum,
    title: row.title,
    error: serialized.message,
    ...(serialized.status ? { status: serialized.status } : {}),
    ...(serialized.code ? { code: serialized.code } : {}),
    ...(err.listingId ? { listingId: err.listingId, listingState: err.listingState } : {}),
    ...(serialized.sdkErrors ? { sdkErrors: serialized.sdkErrors } : {}),
    ...(serialized.sdkErrorsTruncated ? { sdkErrorsTruncated: serialized.sdkErrorsTruncated } : {}),
  };
}

const resultEntry = (row, result) => ({
  row: row.rowNum,
  title: row.title,
  listingId: result.listingId,
  status: result.state,
  outcome: result.outcome,
});

/**
 * Run one attempt at a row under the row timeout, registered as in flight so
 * no other job can start the same row until this attempt settles — even after
 * the timeout, while its abandoned request may still be running.
 */
function attemptRow(sdk, row, imageMap, config, existing, rowTimeoutMs) {
  const ctx = createRowContext();
  const attempt = trackInFlight(row.importKey, runRow(sdk, row, imageMap, config, ctx, existing));
  return withTimeout(attempt, rowTimeoutMs, `Fila ${row.rowNum}`, () => {
    ctx.cancelled = true;
  });
}

/**
 * Process all rows of an import job asynchronously.
 * Updates job state after each row.
 *
 * Rows are idempotent: each carries an import key (rowIdempotency), and a row
 * whose listing already exists for the same author is resumed or skipped rather
 * than created again. Rows that time out are reconciled after the last row.
 *
 * @param {object} [options]
 * @param {number} [options.rowTimeoutMs] - per-row timeout (defaults to ROW_TIMEOUT_MS;
 *   overridable in tests to exercise the timeout path quickly).
 * @param {number} [options.reconcileGraceMs] - how long to wait for timed-out rows
 *   to settle before reconciling them (defaults to RECONCILE_GRACE_MS).
 */
async function processImportJob(
  jobId,
  rows,
  imageMap,
  { rowTimeoutMs = ROW_TIMEOUT_MS, reconcileGraceMs = RECONCILE_GRACE_MS } = {}
) {
  const sdk = getIntegrationSdk();

  const config = {
    listingType: process.env.BULK_IMPORT_LISTING_TYPE || 'product-selling',
    transactionAlias: process.env.BULK_IMPORT_TRANSACTION_ALIAS || 'default-purchase/release-1',
    unitType: process.env.BULK_IMPORT_UNIT_TYPE || 'item',
  };

  const keyedRows = assignRowKeys(rows, imageMap);

  // One lookup per author, before any row runs.
  const priorByAuthor = new Map();
  for (const authorId of new Set(keyedRows.map(r => r.authorId).filter(Boolean))) {
    priorByAuthor.set(authorId, await lookupPriorImports(sdk, authorId));
  }

  const counts = { succeeded: 0, failed: 0, existing: 0 };

  const recordSuccess = (row, result) => {
    if (result.outcome === 'existing') counts.existing += 1;
    else counts.succeeded += 1;
    const job = updateJob(jobId, { ...counts });
    if (job) job.results.push(resultEntry(row, result));
  };

  const recordFailure = (row, err) => {
    counts.failed += 1;
    const job = updateJob(jobId, { ...counts });
    const serialized = serializeSdkError(err);
    if (job && job.errors.length < MAX_JOB_ERRORS) {
      job.errors.push(buildErrorEntry(row, err));
    } else {
      updateJob(jobId, { errorsWereCapped: true });
    }
    console.error(
      `[bulk-import] Row ${row.rowNum} ("${row.title}") failed:`,
      JSON.stringify(
        { ...serialized, listingId: err.listingId, listingState: err.listingState },
        null,
        2
      )
    );
  };

  const timedOut = [];

  for (let i = 0; i < keyedRows.length; i++) {
    const row = keyedRows[i];

    try {
      const prior = priorByAuthor.get(row.authorId);
      if (prior instanceof Error) throw prior;
      if (isInFlight(row.importKey)) {
        throw avError('An earlier attempt at this row is still running', 'row-in-flight');
      }
      const existing = (prior && prior.get(row.importKey)) || null;

      const result = await attemptRow(sdk, row, imageMap, config, existing, rowTimeoutMs);
      recordSuccess(row, result);
    } catch (err) {
      if (err.avCode === 'row-timeout') timedOut.push(row);
      recordFailure(row, err);
    }
    updateJob(jobId, { processed: i + 1 });

    // Rate limiting delay between rows
    if (i < keyedRows.length - 1) {
      await delay(DELAY_BETWEEN_ROWS_MS);
    }
  }

  if (timedOut.length > 0) {
    await reconcileTimedOutRows({
      sdk,
      jobId,
      rows: timedOut,
      imageMap,
      config,
      counts,
      rowTimeoutMs,
      reconcileGraceMs,
    });
  }

  updateJob(jobId, { status: 'completed' });

  console.log(
    `[bulk-import] Job ${jobId} completed: ${counts.succeeded} succeeded, ${counts.existing} already imported, ${counts.failed} failed`
  );
}

/**
 * Reconcile rows that timed out. Their abandoned attempts get a grace period to
 * settle; then each row's author is looked up again:
 *
 *  - no listing carries the row's key → nothing was created, the error stands
 *    and re-uploading is safe;
 *  - a listing does → its abandoned attempt got that far. Finish it, and on
 *    success move the row from the job's errors to its results.
 *
 * A row whose attempt is still running after the grace period is left failed;
 * it stays registered in flight, so a re-upload cannot duplicate it either.
 */
async function reconcileTimedOutRows({
  sdk,
  jobId,
  rows,
  imageMap,
  config,
  counts,
  rowTimeoutMs,
  reconcileGraceMs,
}) {
  const deadline = Date.now() + reconcileGraceMs;
  for (const row of rows) {
    const pending = getInFlight(row.importKey);
    const remaining = deadline - Date.now();
    if (pending && remaining > 0) {
      await Promise.race([pending.catch(() => {}), delay(remaining)]);
    }
  }

  const freshByAuthor = new Map();
  for (const row of rows) {
    if (isInFlight(row.importKey)) continue;

    if (!freshByAuthor.has(row.authorId)) {
      freshByAuthor.set(row.authorId, await lookupPriorImports(sdk, row.authorId));
    }
    const fresh = freshByAuthor.get(row.authorId);
    const listing = fresh instanceof Error ? null : fresh.get(row.importKey);
    if (!listing) continue;

    const job = getJob(jobId);
    const errorIndex = job ? job.errors.findIndex(e => e.row === row.rowNum) : -1;
    try {
      const result = await attemptRow(sdk, row, imageMap, config, listing, rowTimeoutMs);
      // Created by this job either way — even when the abandoned attempt had
      // already finished it (outcome 'existing') — so it counts as succeeded.
      counts.failed -= 1;
      counts.succeeded += 1;
      updateJob(jobId, { ...counts });
      if (job) {
        if (errorIndex !== -1) job.errors.splice(errorIndex, 1);
        job.results.push(resultEntry(row, { ...result, outcome: 'reconciled' }));
      }
    } catch (err) {
      // Still failed, but now the error names the listing that exists.
      if (job && errorIndex !== -1) job.errors[errorIndex] = buildErrorEntry(row, err);
    }
  }
}

module.exports = { processImportJob, serializeSdkError };
module.exports._test = { withTimeout, ROW_TIMEOUT_MS, RECONCILE_GRACE_MS };
