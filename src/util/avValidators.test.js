import { types as sdkTypes } from './sdkLoader';
import { originalPriceAbovePrice } from './avValidators';

const { Money } = sdkTypes;

const MESSAGE = 'must be higher than the price';
const validate = originalPriceAbovePrice(MESSAGE);

describe('originalPriceAbovePrice', () => {
  it('accepts an original price above the listing price', () => {
    expect(validate(new Money(2000, 'MXN'), { price: new Money(1000, 'MXN') })).toBeUndefined();
  });

  it('rejects an original price below the listing price', () => {
    expect(validate(new Money(500, 'MXN'), { price: new Money(1000, 'MXN') })).toBe(MESSAGE);
  });

  it('rejects an original price equal to the listing price', () => {
    expect(validate(new Money(1000, 'MXN'), { price: new Money(1000, 'MXN') })).toBe(MESSAGE);
  });

  it('rejects a value in another currency, which could not be compared or shown', () => {
    expect(validate(new Money(2000, 'USD'), { price: new Money(1000, 'MXN') })).toBe(MESSAGE);
  });

  it('accepts an empty value, since the field is optional', () => {
    expect(validate(undefined, { price: new Money(1000, 'MXN') })).toBeUndefined();
    expect(validate('', { price: new Money(1000, 'MXN') })).toBeUndefined();
  });

  it('stays silent while the price is missing or not yet a Money', () => {
    expect(validate(new Money(2000, 'MXN'), {})).toBeUndefined();
    expect(validate(new Money(2000, 'MXN'), { price: 1000 })).toBeUndefined();
    expect(validate(new Money(2000, 'MXN'), undefined)).toBeUndefined();
  });
});
