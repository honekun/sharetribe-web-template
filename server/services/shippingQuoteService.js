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

// quoteToken -> { nacionalExpress?, nacionalEstandar?, rawRates, quot_id, ts }.
// TTL 15 min. The TTL cache is a Proxy: read with `cache[key].data`, write with
// `cache[key] = value` (same usage as server/api/my-balance.js summaryCache).
const quoteCache = createTTLCache(15 * 60);

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
  const authorId = listing?.author?.id?.uuid;
  if (!authorId) return null;
  const integrationSdk = getIntegrationSdk();
  const res = await integrationSdk.users.show({ id: authorId });
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
  const { quot_id, rates } = await eshipClient.quote({
    addressFrom: toEshipAddress(origin),
    addressTo: toEshipAddress(destination, buyerEmail),
    parcels: [parcel],
  });
  const buckets = buildBuckets(rates);
  return { quot_id, buckets };
}

async function quoteForCheckout({ listing, destination, buyerEmail }) {
  const { quot_id, buckets } = await runQuote({ listing, destination, buyerEmail });
  const quoteToken = crypto.randomUUID();
  quoteCache[quoteToken] = { ...buckets, quot_id, ts: Date.now() };
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
  if (isEspecialSize(resolvePackageSize(listing?.attributes?.publicData || {}))) return null;
  const { data: cached } = (quoteToken && quoteCache[quoteToken]) || {};
  let bucket = cached ? cached[avShippingType] : null;
  let quot_id = cached ? cached.quot_id : null;
  if (!bucket) {
    // Cache miss (expired / different dyno / unknown token) -> re-quote.
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
  quoteForCheckout,
  resolveBucketPrice,
  NoOriginError,
  EspecialError,
  __toSubunitsWithMarkup, // test helper
};
