import {
  avDeliveryMethodFromPageData,
  avEffectiveDeliveryMethod,
  avShippingOrderParams,
  avShippingProtectedData,
} from './avOrderParams';

const purchasePageData = deliveryMethod => ({
  listing: {
    attributes: { publicData: { transactionProcessAlias: 'default-purchase/release-1' } },
  },
  orderData: { deliveryMethod },
});

describe('avEffectiveDeliveryMethod', () => {
  it('defaults purchases to shipping when the Console setting leaves it unset', () => {
    expect(avEffectiveDeliveryMethod(undefined, true)).toBe('shipping');
    expect(avEffectiveDeliveryMethod('none', true)).toBe('shipping');
  });

  it('respects an explicit pickup', () => {
    expect(avEffectiveDeliveryMethod('pickup', true)).toBe('pickup');
  });

  it('leaves non-purchase processes untouched', () => {
    expect(avEffectiveDeliveryMethod(undefined, false)).toBeUndefined();
    expect(avEffectiveDeliveryMethod('none', false)).toBe('none');
  });
});

describe('avDeliveryMethodFromPageData', () => {
  it('agrees with avEffectiveDeliveryMethod for purchases', () => {
    expect(avDeliveryMethodFromPageData(purchasePageData(undefined))).toBe('shipping');
    expect(avDeliveryMethodFromPageData(purchasePageData('none'))).toBe('shipping');
    expect(avDeliveryMethodFromPageData(purchasePageData('pickup'))).toBe('pickup');
  });

  it('does not default bookings to shipping', () => {
    const bookingPageData = {
      listing: {
        attributes: { publicData: { transactionProcessAlias: 'default-booking/release-1' } },
      },
      orderData: { deliveryMethod: undefined },
    };
    expect(avDeliveryMethodFromPageData(bookingPageData)).toBeUndefined();
  });

  it('tolerates a listing with no process alias', () => {
    expect(avDeliveryMethodFromPageData({})).toBeUndefined();
  });
});

describe('avShippingOrderParams', () => {
  it('passes the quote binding through when present', () => {
    expect(
      avShippingOrderParams({
        avShippingType: 'nacionalExpress',
        avQuoteToken: 'tok',
        avDestination: { zip: '01000' },
        buyerEmail: 'a@example.com',
      })
    ).toEqual({
      avShippingType: 'nacionalExpress',
      avQuoteToken: 'tok',
      avDestination: { zip: '01000' },
      buyerEmail: 'a@example.com',
    });
  });

  it('omits every key that is absent rather than sending undefined', () => {
    expect(avShippingOrderParams({ avShippingType: 'nacionalEstandar' })).toEqual({
      avShippingType: 'nacionalEstandar',
    });
    expect(avShippingOrderParams({})).toEqual({});
    expect(avShippingOrderParams(undefined)).toEqual({});
  });
});

describe('avShippingProtectedData', () => {
  it('persists only the chosen bucket, never the token or destination', () => {
    expect(
      avShippingProtectedData({
        avShippingType: 'nacionalExpress',
        avQuoteToken: 'tok',
        avDestination: { zip: '01000' },
        buyerEmail: 'a@example.com',
      })
    ).toEqual({ avShippingType: 'nacionalExpress' });
  });

  it('is empty when nothing was chosen', () => {
    expect(avShippingProtectedData({})).toEqual({});
    expect(avShippingProtectedData(undefined)).toEqual({});
  });
});
