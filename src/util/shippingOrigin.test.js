import {
  hasCompleteShippingOrigin,
  shippingOriginFromValues,
  valuesFromShippingOrigin,
} from './shippingOrigin';

describe('shippingOriginFromValues / valuesFromShippingOrigin', () => {
  const values = {
    recipientName: 'Juan Pérez',
    recipientPhoneNumber: '5512345678',
    recipientAddressLine1: 'Av. Reforma',
    recipientExteriorNumber: '222',
    recipientInteriorNumber: '4B',
    recipientColonia: 'Juárez',
    recipientPostal: '06600',
    recipientCity: 'Ciudad de México',
    recipientState: 'Ciudad de México',
  };

  it('composes the stored origin (street1/street2 + structured fields)', () => {
    expect(shippingOriginFromValues(values)).toEqual({
      name: 'Juan Pérez',
      street1: 'Av. Reforma 222 Int. 4B',
      street2: 'Juárez',
      city: 'Ciudad de México',
      state: 'Ciudad de México',
      zip: '06600',
      phone: '5512345678',
      calle: 'Av. Reforma',
      exteriorNumber: '222',
      interiorNumber: '4B',
      colonia: 'Juárez',
    });
  });

  it('round-trips through valuesFromShippingOrigin', () => {
    const origin = shippingOriginFromValues(values);
    expect(valuesFromShippingOrigin(origin)).toMatchObject({
      recipientAddressLine1: 'Av. Reforma',
      recipientExteriorNumber: '222',
      recipientInteriorNumber: '4B',
      recipientColonia: 'Juárez',
      recipientPostal: '06600',
      recipientState: 'Ciudad de México',
    });
  });

  it('falls back to street1/street2 for legacy origins without structured fields', () => {
    const legacy = {
      name: 'A',
      street1: 'Calle 5',
      street2: 'Centro',
      city: 'C',
      state: 'NL',
      zip: '64000',
      phone: '8',
    };
    expect(valuesFromShippingOrigin(legacy)).toMatchObject({
      recipientAddressLine1: 'Calle 5',
      recipientColonia: 'Centro',
    });
  });
});

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
