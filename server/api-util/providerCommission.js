'use strict';

// AV: per-seller provider commission override, resolved server-side from the
// listing author's Console `metadata` field. The client never sends a rate.
// Design: docs/superpowers/specs/2026-08-14-per-seller-commission-override-design.md

const {
  commissionOverrideFieldKey,
  getCommissionOverride,
  applyCommissionOverride,
} = require('../../src/config/configAVCommission');

/**
 * The listing's author among a Marketplace API response's `included` entities.
 * Requires the request to have asked for the author (`include: ['author']` or
 * `include: ['listing.author']`).
 *
 * Public listings include the author as `user`, while own listings include the
 * author as `currentUser`.
 *
 * @returns {Object|null} the author user entity, or null when it is not there
 */
const findListingAuthor = (listing, included) => {
  const authorId = listing?.relationships?.author?.data?.id?.uuid;
  if (!authorId || !Array.isArray(included)) {
    return null;
  }
  return (
    included.find(
      entity => ['user', 'currentUser'].includes(entity?.type) && entity?.id?.uuid === authorId
    ) || null
  );
};

/**
 * The provider commission to charge for a sale by `author`.
 *
 * A missing author throws: the rate would be unknown, and a sale created at the
 * wrong rate cannot be found again afterwards. An invalid stored value falls back
 * to the marketplace rate — Console has no range check, and the estimator applies
 * the same rule, so the seller sees the rate that is charged.
 */
const resolveProviderCommission = (providerCommission, author) => {
  if (!author) {
    throw new Error('Listing author unavailable: provider commission cannot be resolved');
  }

  const override = getCommissionOverride(author);
  if (override.status === 'invalid') {
    console.warn(
      `[providerCommission] Ignoring invalid ${commissionOverrideFieldKey} for user ${author.id?.uuid}:`,
      JSON.stringify(override.value)
    );
  }
  return applyCommissionOverride(providerCommission, override);
};

module.exports = { findListingAuthor, resolveProviderCommission };
