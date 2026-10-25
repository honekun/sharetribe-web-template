'use strict';

// AV per-seller provider commission override — CommonJS so BOTH the ESM client
// (EarningsEstimator, via webpack interop) and the plain-Node server (the
// line-item endpoints) parse the value with one rule. The estimate a seller
// prices against therefore cannot diverge from what checkout charges.
// Design: docs/superpowers/specs/2026-08-14-per-seller-commission-override-design.md

// Console user field, scope `metadata`: only operators (Console, Integration API)
// can write it. It is publicly readable through the API — an accepted trade-off.
// Keep "Display on profile" off in Console: ProfilePage renders metadata fields
// that opt in.
const commissionOverrideFieldKey = 'avCommissionPercentage';

// The $15.00 fixed fee is always charged on top, and must fit inside the $20.00
// minimum listing price: 2000 × (1 − 25 / 100) = 1500. Asserted by
// commissionInvariant.test.js — raising this means raising that minimum.
const MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE = 25;

const NONE = Object.freeze({ status: 'none' });

const toNumber = value => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value)) {
    return Number(value);
  }
  return NaN;
};

/**
 * Parse the stored override.
 *
 * @param {*} value raw `metadata.avCommissionPercentage`
 * @returns {{status: 'none'} | {status: 'valid', percentage: number} | {status: 'invalid', value: *}}
 */
const parseCommissionOverride = value => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return NONE;
  }
  const percentage = toNumber(value);
  const inRange =
    Number.isFinite(percentage) &&
    percentage >= 0 &&
    percentage <= MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE;
  return inRange ? { status: 'valid', percentage } : { status: 'invalid', value };
};

/**
 * The override stored on a user entity. Only `metadata` counts: the same key in
 * `publicData` or `privateData` is seller-writable and is ignored.
 */
const getCommissionOverride = user =>
  parseCommissionOverride(user?.attributes?.profile?.metadata?.[commissionOverrideFieldKey]);

/**
 * The provider commission to charge. A valid override replaces the percentage
 * and drops `minimum_amount`, so the marketplace minimum cannot overrule a
 * negotiated rate on a cheap item. Anything else returns the hosted object.
 */
const applyCommissionOverride = (providerCommission, override) => {
  if (override?.status !== 'valid') {
    return providerCommission;
  }
  // eslint-disable-next-line no-unused-vars
  const { minimum_amount, ...rest } = providerCommission || {};
  return { ...rest, percentage: override.percentage };
};

module.exports = {
  commissionOverrideFieldKey,
  MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE,
  parseCommissionOverride,
  getCommissionOverride,
  applyCommissionOverride,
};
