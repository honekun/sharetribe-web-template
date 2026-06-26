import {
  getShippingDetailsMaybe,
  getEshipDestinationFromValues,
} from './CheckoutPageTransactionHelpers';

describe('getEshipDestinationFromValues', () => {
  const complete = {
    recipientName: 'Juan Pérez',
    recipientPhoneNumber: '+52 55 1234 5678',
    recipientAddressLine1: 'Av. Reforma',
    recipientExteriorNumber: '123',
    recipientInteriorNumber: '4B',
    recipientColonia: 'Condesa',
    recipientPostal: '06100',
    recipientCity: 'Ciudad de México',
    recipientState: 'Ciudad de México',
  };

  it('composes a quotable eShip destination from complete values', () => {
    expect(getEshipDestinationFromValues(complete)).toEqual({
      name: 'Juan Pérez',
      street1: 'Av. Reforma 123 Int. 4B',
      street2: 'Condesa',
      city: 'Ciudad de México',
      state: 'Ciudad de México',
      zip: '06100',
      country: 'MX',
      phone: '+52 55 1234 5678',
    });
  });

  it('returns null until the minimum quotable fields are present', () => {
    expect(getEshipDestinationFromValues({})).toBe(null);
    expect(getEshipDestinationFromValues({ ...complete, recipientPostal: undefined })).toBe(null);
    expect(getEshipDestinationFromValues({ ...complete, recipientState: undefined })).toBe(null);
  });
});

describe('getShippingDetailsMaybe', () => {
  const base = {
    recipientName: 'Juan Pérez',
    recipientPhoneNumber: '+52 55 1234 5678',
    recipientAddressLine1: 'Av. Reforma',
    recipientExteriorNumber: '123',
    recipientColonia: 'Condesa',
    recipientPostal: '06100',
    recipientCity: 'Ciudad de México',
    recipientState: 'Ciudad de México',
  };

  it('returns {} until the required gate fields are present', () => {
    expect(getShippingDetailsMaybe({})).toEqual({});
    expect(getShippingDetailsMaybe({ recipientName: 'Juan' })).toEqual({});
    expect(getShippingDetailsMaybe({ recipientName: 'Juan', recipientAddressLine1: 'Av' })).toEqual(
      {}
    );
  });

  it('hardcodes country to MX and maps colonia to line2', () => {
    const { shippingDetails } = getShippingDetailsMaybe(base);
    expect(shippingDetails.name).toBe('Juan Pérez');
    expect(shippingDetails.phoneNumber).toBe('+52 55 1234 5678');
    expect(shippingDetails.address.country).toBe('MX');
    expect(shippingDetails.address.line2).toBe('Condesa');
    expect(shippingDetails.address.colonia).toBe('Condesa');
    expect(shippingDetails.address.postalCode).toBe('06100');
    expect(shippingDetails.address.city).toBe('Ciudad de México');
    expect(shippingDetails.address.state).toBe('Ciudad de México');
  });

  it('composes line1 as street + exterior number when no interior', () => {
    const { shippingDetails } = getShippingDetailsMaybe(base);
    expect(shippingDetails.address.line1).toBe('Av. Reforma 123');
    expect(shippingDetails.address.exteriorNumber).toBe('123');
    expect(shippingDetails.address.interiorNumber).toBeUndefined();
  });

  it('appends the interior number to line1 when provided', () => {
    const { shippingDetails } = getShippingDetailsMaybe({
      ...base,
      recipientInteriorNumber: '4B',
    });
    expect(shippingDetails.address.line1).toBe('Av. Reforma 123 Int. 4B');
    expect(shippingDetails.address.interiorNumber).toBe('4B');
  });
});
