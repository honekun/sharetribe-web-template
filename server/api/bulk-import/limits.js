'use strict';

// Tiered import limits. "standard" = any signed-in user (imports for themselves);
// "admin" = emails in BULK_IMPORT_OPERATOR_EMAILS (may also set a CSV `user_id`
// column). The ZIP extractor still enforces its own absolute ceilings (entry
// count, per-file size, total uncompressed bytes); these tiers are the smaller,
// per-user caps applied after authentication.
const LIMITS = {
  standard: {
    maxRows: 25,
    maxImages: 100,
    maxZipBytes: 20 * 1024 * 1024, // 20 MB compressed
    maxImportsPerHour: 3,
  },
  admin: {
    maxRows: 100,
    maxImages: 400,
    maxZipBytes: 50 * 1024 * 1024, // 50 MB compressed
    maxImportsPerHour: 20,
  },
};

const getLimits = isAdmin => (isAdmin ? LIMITS.admin : LIMITS.standard);

module.exports = { getLimits, LIMITS };
