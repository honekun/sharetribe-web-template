import {
  findShippingFeeLineItem,
  isLabelPurchaseAllowed,
  labelShippingRecord,
  resolveLabelShippingRecord,
  shippingChargeMatches,
  transitionNames,
} from './configAVShippingLabel';

const RATE = { rate_id: 'rate-1', amountSubunits: 11800, currency: 'MXN' };
const shippingFee = {
  code: 'line-item/shipping-fee',
  includeFor: ['customer'],
  reversal: false,
  lineTotal: { amount: 11800, currency: 'MXN' },
};
const itemLine = { code: 'line-item/item', includeFor: ['customer', 'provider'], reversal: false };

const makeTx = ({
  metadataShipping,
  legacyShipping,
  lineItems = [itemLine, shippingFee],
  transitions = ['transition/request-payment', 'transition/confirm-payment'],
} = {}) => ({
  attributes: {
    lineItems,
    metadata: metadataShipping ? { avShipping: metadataShipping } : {},
    protectedData: legacyShipping ? { avShipping: legacyShipping } : {},
    transitions: transitions.map(transition => ({ transition })),
    lastTransition: transitions[transitions.length - 1],
  },
});

describe('transitionNames / isLabelPurchaseAllowed', () => {
  it('lists the history plus the last transition', () => {
    expect(transitionNames(makeTx())).toEqual([
      'transition/request-payment',
      'transition/confirm-payment',
      'transition/confirm-payment',
    ]);
    expect(transitionNames({})).toEqual([]);
  });

  it('allows a label once paid and never after a cancellation', () => {
    expect(isLabelPurchaseAllowed(makeTx())).toBe(true);
    expect(isLabelPurchaseAllowed(makeTx({ transitions: ['transition/request-payment'] }))).toBe(
      false
    );
    expect(
      isLabelPurchaseAllowed(
        makeTx({ transitions: ['transition/confirm-payment', 'transition/operator-cancel'] })
      )
    ).toBe(false);
  });
});

describe('findShippingFeeLineItem / shippingChargeMatches', () => {
  it('finds only the customer-paid, non-reversal shipping fee', () => {
    expect(findShippingFeeLineItem([itemLine, shippingFee])).toBe(shippingFee);
    expect(findShippingFeeLineItem([{ ...shippingFee, reversal: true }])).toBeNull();
    expect(findShippingFeeLineItem([{ ...shippingFee, includeFor: ['provider'] }])).toBeNull();
    expect(findShippingFeeLineItem(undefined)).toBeNull();
  });

  it('requires the charged amount and currency to equal the record', () => {
    expect(shippingChargeMatches([shippingFee], RATE)).toBe(true);
    expect(shippingChargeMatches([shippingFee], { ...RATE, amountSubunits: 1 })).toBe(false);
    expect(shippingChargeMatches([shippingFee], { ...RATE, currency: 'USD' })).toBe(false);
    expect(shippingChargeMatches([itemLine], RATE)).toBe(false);
    expect(shippingChargeMatches([shippingFee], null)).toBe(false);
  });
});

describe('resolveLabelShippingRecord / labelShippingRecord', () => {
  it('prefers the server-written metadata record', () => {
    const tx = makeTx({ metadataShipping: RATE, legacyShipping: { ...RATE, rate_id: 'other' } });
    expect(resolveLabelShippingRecord(tx)).toEqual({ record: RATE, source: 'metadata' });
    expect(labelShippingRecord(tx)).toBe(RATE);
  });

  it('trusts a legacy protectedData record only without a dispute', () => {
    expect(resolveLabelShippingRecord(makeTx({ legacyShipping: RATE }))).toEqual({
      record: RATE,
      source: 'legacy',
    });
    const disputed = makeTx({
      legacyShipping: RATE,
      transitions: ['transition/confirm-payment', 'transition/dispute'],
    });
    expect(resolveLabelShippingRecord(disputed)).toEqual({
      record: null,
      source: 'legacy_rewritable',
    });
    expect(labelShippingRecord(disputed)).toBeNull();
  });

  it('keeps a metadata record trusted after a dispute', () => {
    const tx = makeTx({
      metadataShipping: RATE,
      transitions: ['transition/confirm-payment', 'transition/dispute'],
    });
    expect(labelShippingRecord(tx)).toBe(RATE);
  });

  it('gives no record when the buyer was not charged that shipping price', () => {
    expect(labelShippingRecord(makeTx({ metadataShipping: RATE, lineItems: [itemLine] }))).toBe(
      null
    );
    expect(labelShippingRecord(makeTx({ metadataShipping: { ...RATE, amountSubunits: 1 } }))).toBe(
      null
    );
    expect(labelShippingRecord(makeTx())).toBeNull();
  });
});
