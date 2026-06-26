'use strict';

const { buildAvShippingProtectedData } = require('./avShipping');

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

it('returns an empty object when there is no resolved rate', () => {
  expect(buildAvShippingProtectedData({}, null)).toEqual({});
});
