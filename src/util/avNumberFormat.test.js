import { formatPriceNumber, _clearFormatterCache } from './avNumberFormat';
import { priceFormatLocale } from '../config/configAV';
import { formatCurrencyMajorUnit } from './currency';

const MXN = {
  style: 'currency',
  currency: 'MXN',
  currencyDisplay: 'narrowSymbol',
  useGrouping: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

beforeEach(() => _clearFormatterCache());

describe('formatPriceNumber', () => {
  it('formats MXN with a leading $, comma thousands and dot decimals', () => {
    expect(formatPriceNumber(1325, MXN)).toEqual('$1,325.00');
  });

  it('defaults to en-US', () => {
    expect(priceFormatLocale).toEqual('en-US');
  });

  it('reuses one formatter per options object', () => {
    const spy = jest.spyOn(Intl, 'NumberFormat');
    _clearFormatterCache();

    formatPriceNumber(1, MXN);
    formatPriceNumber(2, MXN);
    formatPriceNumber(3, MXN);

    // Constructing Intl.NumberFormat is the expensive part; it used to happen on
    // every call, including every keystroke in the price input.
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('builds a separate formatter for different options', () => {
    const spy = jest.spyOn(Intl, 'NumberFormat');
    _clearFormatterCache();

    formatPriceNumber(1, MXN);
    formatPriceNumber(1, { ...MXN, currency: 'USD' });

    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe('formatCurrencyMajorUnit', () => {
  // It used to call intl.formatNumber, so search price-filter labels followed the
  // marketplace locale while every other price on the page did not.
  const spanishIntl = {
    formatNumber: (value, opts) => new Intl.NumberFormat('es-MX', opts).format(value),
  };

  it('ignores the marketplace locale and matches the rest of the page', () => {
    expect(formatCurrencyMajorUnit(spanishIntl, 'MXN', '1325')).toEqual('$1,325');
  });

  it('agrees with formatPriceNumber on the same amount', () => {
    const viaFilter = formatCurrencyMajorUnit(spanishIntl, 'MXN', '1325');
    const viaPrice = formatPriceNumber(1325, {
      ...MXN,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    expect(viaFilter).toEqual(viaPrice);
  });
});
