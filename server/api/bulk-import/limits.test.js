'use strict';

const { getLimits, LIMITS } = require('./limits');

describe('getLimits', () => {
  it('returns the standard tier for non-admin users', () => {
    expect(getLimits(false)).toBe(LIMITS.standard);
    expect(getLimits(undefined)).toBe(LIMITS.standard);
  });

  it('returns the admin tier for admin users', () => {
    expect(getLimits(true)).toBe(LIMITS.admin);
  });

  it('admin limits are at least as large as standard limits', () => {
    expect(LIMITS.admin.maxRows).toBeGreaterThanOrEqual(LIMITS.standard.maxRows);
    expect(LIMITS.admin.maxImages).toBeGreaterThanOrEqual(LIMITS.standard.maxImages);
    expect(LIMITS.admin.maxZipBytes).toBeGreaterThanOrEqual(LIMITS.standard.maxZipBytes);
    expect(LIMITS.admin.maxImportsPerHour).toBeGreaterThanOrEqual(
      LIMITS.standard.maxImportsPerHour
    );
  });
});
