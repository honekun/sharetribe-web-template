import { types as sdkTypes } from './sdkLoader';
import {
  getOriginalPriceInitialValue,
  getValidOriginalPrice,
  originalPriceInitialValueMaybe,
} from './avOriginalPrice';

const { Money } = sdkTypes;

describe('getValidOriginalPrice', () => {
  const price = new Money(5000, 'MXN');

  it('returns a Money for a valid higher price in the listing currency', () => {
    const result = getValidOriginalPrice({ amount: 9000, currency: 'MXN' }, price);
    expect(result).toBeInstanceOf(Money);
    expect(result.amount).toBe(9000);
    expect(result.currency).toBe('MXN');
  });

  it('ignores unknown, missing, and mismatched currencies', () => {
    expect(getValidOriginalPrice({ amount: 9000, currency: 'NO-SUCH-CURRENCY' }, price)).toBeNull();
    expect(getValidOriginalPrice({ amount: 9000 }, price)).toBeNull();
    expect(getValidOriginalPrice({ amount: 9000, currency: 'USD' }, price)).toBeNull();
    expect(
      getValidOriginalPrice(
        { amount: 9000, currency: 'NO-SUCH-CURRENCY' },
        { amount: 5000, currency: 'NO-SUCH-CURRENCY' }
      )
    ).toBeNull();
  });

  it('ignores nonnumeric, fractional, unsafe, and non-positive amounts', () => {
    ['9000', NaN, Infinity, 90.5, Number.MAX_SAFE_INTEGER + 1, -9000, 0, null, { $gt: 1 }].forEach(
      amount => {
        expect(getValidOriginalPrice({ amount, currency: 'MXN' }, price)).toBeNull();
      }
    );
  });

  it('ignores values that are not objects', () => {
    [null, undefined, 9000, 'MXN 9000', []].forEach(value => {
      expect(getValidOriginalPrice(value, price)).toBeNull();
    });
  });

  it('requires the original price to exceed the current price', () => {
    expect(getValidOriginalPrice({ amount: 5000, currency: 'MXN' }, price)).toBeNull();
    expect(getValidOriginalPrice({ amount: 4000, currency: 'MXN' }, price)).toBeNull();
  });

  it('needs a usable current price', () => {
    expect(getValidOriginalPrice({ amount: 9000, currency: 'MXN' }, null)).toBeNull();
    expect(
      getValidOriginalPrice({ amount: 9000, currency: 'MXN' }, { currency: 'MXN' })
    ).toBeNull();
  });
});

describe('getOriginalPriceInitialValue', () => {
  it('preloads a well-formed value in the marketplace currency', () => {
    const result = getOriginalPriceInitialValue({ amount: 9000, currency: 'MXN' }, 'MXN');
    expect(result).toBeInstanceOf(Money);
    expect(result.amount).toBe(9000);
  });

  it('keeps a value that is not above the price for the form validator to flag', () => {
    expect(getOriginalPriceInitialValue({ amount: 100, currency: 'MXN' }, 'MXN').amount).toBe(100);
  });

  it('omits malformed values and other currencies', () => {
    expect(getOriginalPriceInitialValue({ amount: 9000, currency: 'USD' }, 'MXN')).toBeNull();
    expect(getOriginalPriceInitialValue({ amount: 90.5, currency: 'MXN' }, 'MXN')).toBeNull();
    expect(getOriginalPriceInitialValue({ amount: 9000, currency: 'MXN' }, undefined)).toBeNull();
    expect(getOriginalPriceInitialValue(undefined, 'MXN')).toBeNull();
  });
});

describe('originalPriceInitialValueMaybe', () => {
  it('spreads a valid value and nothing otherwise', () => {
    expect(originalPriceInitialValueMaybe({ amount: 9000, currency: 'MXN' }, 'MXN')).toEqual({
      originalPrice: new Money(9000, 'MXN'),
    });
    expect(originalPriceInitialValueMaybe({ amount: 9000, currency: 'XXX' }, 'MXN')).toEqual({});
  });
});
