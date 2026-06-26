import { hasCompleteShippingOrigin } from './shippingOrigin';

const user = shippingOrigin => ({
  attributes: { profile: { protectedData: { shippingOrigin } } },
});

describe('hasCompleteShippingOrigin', () => {
  it('is true when all required fields are present', () => {
    expect(
      hasCompleteShippingOrigin(user({ street1: 'A', city: 'C', state: 'NL', zip: '64000' }))
    ).toBe(true);
  });
  it('is false when a required field is missing', () => {
    expect(hasCompleteShippingOrigin(user({ street1: 'A', city: 'C', state: 'NL' }))).toBe(false);
  });
  it('is false when a required field is blank', () => {
    expect(
      hasCompleteShippingOrigin(user({ street1: '  ', city: 'C', state: 'NL', zip: '64000' }))
    ).toBe(false);
  });
  it('is false for a user without the field', () => {
    expect(hasCompleteShippingOrigin({ attributes: { profile: {} } })).toBe(false);
    expect(hasCompleteShippingOrigin(null)).toBe(false);
  });
});
