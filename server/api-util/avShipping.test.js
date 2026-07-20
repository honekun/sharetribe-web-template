'use strict';

const {
  authoritativeShippingDestination,
  buildAvShippingProtectedData,
  destinationFromShippingDetails,
} = require('./avShipping');

it('builds avShipping protectedData from a resolved rate', () => {
  const out = buildAvShippingProtectedData(
    { avShippingType: 'nacionalExpress', avQuoteToken: 't' },
    {
      amountSubunits: 11800,
      currency: 'MXN',
      rate: { carrier: 'DHL', servicelevel: { token: 'x' }, rate_id: 'r1', quot_id: 'q1' },
    }
  );
  expect(out.avShipping).toMatchObject({
    bucket: 'nacionalExpress',
    carrier: 'DHL',
    rate_id: 'r1',
    quot_id: 'q1',
    amountSubunits: 11800,
    currency: 'MXN',
  });
});

it('converts persisted shippingDetails into the canonical eShip destination', () => {
  expect(
    destinationFromShippingDetails({
      name: 'Buyer',
      phoneNumber: '8181',
      address: {
        line1: 'Calle 1 22 Int. 3',
        line2: 'Centro',
        city: 'Monterrey',
        state: 'NL',
        postalCode: '64000',
        country: 'MX',
      },
    })
  ).toEqual({
    name: 'Buyer',
    street1: 'Calle 1 22 Int. 3',
    street2: 'Centro',
    city: 'Monterrey',
    state: 'NL',
    zip: '64000',
    country: 'MX',
    phone: '8181',
  });
});

it('only trusts avDestination during speculation', () => {
  const avDestination = { zip: '11111', state: 'XX' };
  const protectedDestination = {
    name: 'Buyer',
    address: {
      line1: 'Calle 1',
      city: 'Monterrey',
      state: 'NL',
      postalCode: '64000',
    },
  };
  const orderData = {
    avDestination,
    protectedData: { shippingDetails: protectedDestination },
  };

  expect(authoritativeShippingDestination(orderData, true)).toBe(avDestination);
  expect(authoritativeShippingDestination(orderData, false)).toEqual(
    expect.objectContaining({ zip: '64000', state: 'NL' })
  );
});

it('returns an empty object when there is no resolved rate', () => {
  expect(buildAvShippingProtectedData({}, null)).toEqual({});
});
