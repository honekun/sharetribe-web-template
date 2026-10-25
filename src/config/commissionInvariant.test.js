import defaultConfig from './configDefault';
import { MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE } from './configAVCommission';

// The AV provider fixed fee is invisible to Sharetribe, so nothing on their side
// stops a listing from being priced below what the fee needs. At checkout the
// server clamps the fee (server/api-util/lineItemHelpers.js) rather than failing,
// but a clamped sale earns the platform less than intended. This test is the
// guard: raising the fee or the rate without revisiting the minimum listing price
// fails the build instead of quietly shrinking revenue.
//
// The fee comes from REACT_APP_PROVIDER_COMMISSION_FIXED_FEE, which is unset in
// tests, so fall back to the production value ($15.00 MXN).
const PRODUCTION_FIXED_FEE = 1500;

describe('commission invariant', () => {
  it('leaves room for the fixed fee at the minimum listing price', () => {
    const {
      providerCommissionPercentage,
      providerCommissionFixedAmountInSubunits,
    } = defaultConfig.earningsEstimate;
    const fixedFee = providerCommissionFixedAmountInSubunits || PRODUCTION_FIXED_FEE;
    const minPrice = defaultConfig.listingMinimumPriceSubUnits;
    const headroom = minPrice * (1 - providerCommissionPercentage / 100);

    expect(headroom).toBeGreaterThanOrEqual(fixedFee);
  });

  // A per-seller override (configAVCommission.js) may reach the ceiling, and the
  // fixed fee is still charged on top, so the minimum must also fit it there.
  it('leaves room for the fixed fee at the highest per-seller override', () => {
    const { providerCommissionFixedAmountInSubunits } = defaultConfig.earningsEstimate;
    const fixedFee = providerCommissionFixedAmountInSubunits || PRODUCTION_FIXED_FEE;
    const minPrice = defaultConfig.listingMinimumPriceSubUnits;
    const headroom = minPrice * (1 - MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE / 100);

    expect(headroom).toBeGreaterThanOrEqual(fixedFee);
  });
});
