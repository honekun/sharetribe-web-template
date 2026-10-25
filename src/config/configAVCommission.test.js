const {
  commissionOverrideFieldKey,
  MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE,
  parseCommissionOverride,
  getCommissionOverride,
  applyCommissionOverride,
} = require('./configAVCommission');

const userWithMetadata = metadata => ({
  id: { uuid: 'seller-1' },
  attributes: { profile: { metadata } },
});

describe('configAVCommission', () => {
  it('uses the Console field key and the 25 % ceiling', () => {
    expect(commissionOverrideFieldKey).toBe('avCommissionPercentage');
    expect(MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE).toBe(25);
  });

  describe('parseCommissionOverride', () => {
    it.each([undefined, null, '', '   '])('treats %p as no override', value => {
      expect(parseCommissionOverride(value)).toEqual({ status: 'none' });
    });

    it.each([[15, 15], [12.5, 12.5], ['15', 15], [' 12.5 ', 12.5], [0, 0], ['0', 0], [25, 25]])(
      'accepts %p as an override of %p',
      (value, expected) => {
        expect(parseCommissionOverride(value)).toEqual({ status: 'valid', percentage: expected });
      }
    );

    it.each([-1, 25.5, 30, '15%', 'abc', NaN, Infinity, true, {}, []])(
      'rejects %p as invalid',
      value => {
        expect(parseCommissionOverride(value)).toEqual({ status: 'invalid', value });
      }
    );
  });

  describe('getCommissionOverride', () => {
    it('reads the field from profile.metadata', () => {
      const user = userWithMetadata({ avCommissionPercentage: 15 });
      expect(getCommissionOverride(user)).toEqual({ status: 'valid', percentage: 15 });
    });

    it('returns none when the user, profile or metadata is missing', () => {
      expect(getCommissionOverride(null)).toEqual({ status: 'none' });
      expect(getCommissionOverride({ attributes: {} })).toEqual({ status: 'none' });
      expect(getCommissionOverride(userWithMetadata(undefined))).toEqual({ status: 'none' });
    });

    it('ignores the same key in publicData, which the seller can write', () => {
      const user = {
        attributes: { profile: { publicData: { avCommissionPercentage: 0 }, metadata: {} } },
      };
      expect(getCommissionOverride(user)).toEqual({ status: 'none' });
    });
  });

  describe('applyCommissionOverride', () => {
    const hosted = { percentage: 22, minimum_amount: 500 };

    it('returns the hosted commission unchanged without a valid override', () => {
      expect(applyCommissionOverride(hosted, { status: 'none' })).toBe(hosted);
      expect(applyCommissionOverride(hosted, { status: 'invalid', value: 'x' })).toBe(hosted);
    });

    it('replaces the percentage and drops the minimum amount', () => {
      expect(applyCommissionOverride(hosted, { status: 'valid', percentage: 15 })).toEqual({
        percentage: 15,
      });
    });

    it('keeps an explicit zero', () => {
      expect(applyCommissionOverride(hosted, { status: 'valid', percentage: 0 })).toEqual({
        percentage: 0,
      });
    });

    it('works when the hosted commission is missing', () => {
      expect(applyCommissionOverride(undefined, { status: 'valid', percentage: 10 })).toEqual({
        percentage: 10,
      });
    });
  });
});
