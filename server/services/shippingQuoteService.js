'use strict';

const crypto = require('crypto');
const eshipClient = require('../api-util/eshipClient');
const { getIntegrationSdk } = require('./integrationSdk');
const { createTTLCache } = require('../api-util/cache');
const {
  packageSizes,
  resolvePackageSize,
  isEspecialSize,
  applyBuyerMarkup,
  bucketForRate,
} = require('../../src/config/configAVShipping');

// quoteToken -> { nacionalExpress?, nacionalEstandar?, rawRates, quot_id,
// contextHash, ts }. Entries are short lived and bounded because every buyer
// request creates a unique token.
const quoteCache = createTTLCache(15 * 60, { maxEntries: 1000 });

class NoOriginError extends Error {
  constructor() {
    super('Seller origin address missing');
    this.name = 'NoOriginError';
  }
}
class EspecialError extends Error {
  constructor() {
    super('Listing requires especial (manual) shipping');
    this.name = 'EspecialError';
  }
}
// The Integration API call that reads the seller's shipping origin failed
// outright (as opposed to succeeding with no origin saved, which is NoOrigin).
// Common causes: 404 = author not in the Integration app's marketplace (a
// Marketplace/Integration credential-environment mismatch), 401/403 = bad
// creds, or a network error. Kept distinct from EshipApiError so an upstream
// Sharetribe failure is never misattributed to the eShip carrier.
class OriginLookupError extends Error {
  constructor(cause) {
    const status = cause?.status ?? cause?.response?.status;
    super(
      `Failed to look up seller origin${status ? ` [${status}]` : ''}: ${cause?.message || cause}`
    );
    this.name = 'OriginLookupError';
    this.status = status;
    this.cause = cause;
  }
}

// eShip `amount` is in major units (pesos). Convert to subunits + apply markup.
function __toSubunitsWithMarkup(amountMajor) {
  return applyBuyerMarkup(Math.round(amountMajor * 100));
}

function resolveParcel(listing) {
  const publicData = listing?.attributes?.publicData || {};
  const size = resolvePackageSize(publicData);
  if (isEspecialSize(size)) return null;
  const def = packageSizes[size];
  if (!def || !def.dimsCm) return null;
  const [length, width, height] = def.dimsCm;
  return { length, width, height, distance_unit: 'cm', weight: def.weightMaxKg, mass_unit: 'kg' };
}

async function resolveOrigin(listing) {
  // `sdk.listings.show` (no include) carries the author only as a relationship
  // reference; a denormalized `author` is present only when explicitly included.
  // Accept either so the quote works regardless of how the listing was fetched.
  const authorId =
    listing?.author?.id?.uuid || listing?.relationships?.author?.data?.id?.uuid || null;
  if (!authorId) return null;
  const integrationSdk = getIntegrationSdk();
  let res;
  try {
    res = await integrationSdk.users.show({ id: authorId });
  } catch (e) {
    // A thrown error here is an Integration API failure (see OriginLookupError),
    // NOT "seller has no origin". Surface it distinctly instead of letting it
    // fall through to the endpoint's generic eShip catch-all.
    throw new OriginLookupError(e);
  }
  const origin = res?.data?.data?.attributes?.profile?.protectedData?.shippingOrigin;
  if (!origin || !origin.zip || !origin.state) return null;
  return origin;
}

function toEshipAddress(addr, fallbackEmail) {
  return {
    name: addr.name || '',
    street1: addr.street1 || '',
    street2: addr.street2 || '',
    city: addr.city || '',
    state: addr.state || '',
    zip: addr.zip || '',
    country: addr.country || 'MX',
    phone: addr.phone || '',
    email: addr.email || fallbackEmail || '',
  };
}

const normalizedString = value => String(value || '').trim();

// Bind a quote token to the listing, seller, parcel and destination it was
// created for. Only these fixed fields are hashed, so extra client properties
// cannot change the identity of an otherwise identical address.
function quoteContextHash(listing, destination) {
  const authorId =
    listing?.author?.id?.uuid || listing?.relationships?.author?.data?.id?.uuid || '';
  const normalizedDestination = toEshipAddress(destination || {});
  delete normalizedDestination.email;
  Object.keys(normalizedDestination).forEach(key => {
    normalizedDestination[key] = normalizedString(normalizedDestination[key]);
  });
  const context = {
    listingId: listing?.id?.uuid || '',
    authorId,
    parcel: resolveParcel(listing),
    destination: normalizedDestination,
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(context))
    .digest('hex');
}

function rawRateView(rate) {
  return {
    rate_id: rate.rate_id,
    provider: rate.provider,
    servicelevel: rate.servicelevel,
    days: rate.days,
    rawAmount: rate.amount,
    currency: rate.currency,
    buyerAmountSubunits: __toSubunitsWithMarkup(rate.amount),
    tags: rate.tags || [],
    bucket: bucketForRate(rate),
  };
}

function bucketFromRate(rate) {
  return {
    amountSubunits: __toSubunitsWithMarkup(rate.amount),
    currency: rate.currency,
    days: rate.days,
    carrier: rate.provider,
    servicelevel: rate.servicelevel,
    rate_id: rate.rate_id,
  };
}

function buildBuckets(rates) {
  const out = { rawRates: (rates || []).map(rawRateView) };
  for (const rate of rates || []) {
    const bucket = bucketForRate(rate);
    if (bucket && !out[bucket]) out[bucket] = bucketFromRate(rate);
  }
  return out;
}

async function runQuote({ listing, destination, buyerEmail }) {
  const parcel = resolveParcel(listing);
  if (!parcel) throw new EspecialError();
  const origin = await resolveOrigin(listing);
  if (!origin) throw new NoOriginError();
  const quoteRes = await eshipClient.quote({
    addressFrom: toEshipAddress(origin),
    addressTo: toEshipAddress(destination, buyerEmail),
    parcels: [parcel],
  });
  // eShip's /quotation response identifies the quote via `object_id` (verified on
  // apiqa; there is no `quot_id`). Captured for traceability — the /shipment call
  // only needs the rate's `rate_id`, so this being absent never blocks a label.
  const quot_id = quoteRes.object_id || quoteRes.quot_id || null;
  const rates = quoteRes.rates;
  const buckets = buildBuckets(rates);
  return { quot_id, buckets };
}

async function quoteForCheckout({ listing, destination, buyerEmail }) {
  const { quot_id, buckets } = await runQuote({ listing, destination, buyerEmail });
  const quoteToken = crypto.randomUUID();
  quoteCache[quoteToken] = {
    ...buckets,
    quot_id,
    contextHash: quoteContextHash(listing, destination),
    ts: Date.now(),
  };
  return {
    quoteToken,
    express: buckets.nacionalExpress || null,
    estandar: buckets.nacionalEstandar || null,
    rawRates: buckets.rawRates,
    quot_id,
  };
}

async function resolveBucketPrice({
  quoteToken,
  avShippingType,
  listing,
  destination,
  buyerEmail,
}) {
  // No chosen delivery type -> no fee to resolve (e.g. the initial speculate).
  if (!avShippingType) return null;
  if (isEspecialSize(resolvePackageSize(listing?.attributes?.publicData || {}))) return null;
  const { data: cached } = (quoteToken && quoteCache[quoteToken]) || {};
  const contextMatches =
    cached && destination && cached.contextHash === quoteContextHash(listing, destination);
  let bucket = contextMatches ? cached[avShippingType] : null;
  let quot_id = contextMatches ? cached.quot_id : null;
  if (!bucket) {
    // Cache miss or mismatched listing/destination -> re-quote. We can only
    // re-quote with an authoritative destination.
    if (!destination) return null;
    const requoted = await runQuote({ listing, destination, buyerEmail });
    bucket = requoted.buckets[avShippingType] || null;
    quot_id = requoted.quot_id;
  }
  if (!bucket) return null;
  // Thread quot_id onto the rate so persistence (avShipping) captures it.
  const rate = { ...bucket, quot_id };
  return { amountSubunits: bucket.amountSubunits, currency: bucket.currency, rate };
}

module.exports = {
  resolveParcel,
  resolveOrigin,
  buildBuckets,
  quoteContextHash,
  quoteForCheckout,
  resolveBucketPrice,
  NoOriginError,
  EspecialError,
  OriginLookupError,
  __toSubunitsWithMarkup, // test helper
};
