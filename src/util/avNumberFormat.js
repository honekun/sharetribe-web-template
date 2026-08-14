import { priceFormatLocale } from '../config/configAV';

/**
 * Locale-pinned, memoised number formatting for prices.
 *
 * Prices render in one fixed locale regardless of the marketplace UI locale, so
 * MXN reads "$1,325.00" everywhere rather than "1.325,00 $". Without this, the
 * same amount formats differently depending on which code path produced it —
 * `formatMoney` (listing prices, order breakdowns) versus `intl.formatNumber`
 * (search price-filter labels) — which is how those two drifted apart.
 *
 * `Intl.NumberFormat` construction is the expensive part, so formatters are
 * cached by their options. The previous inline `new Intl.NumberFormat(...)`
 * calls built a fresh one on every render.
 */

const formatterCache = new Map();

const getFormatter = options => {
  const key = JSON.stringify(options);
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(priceFormatLocale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
};

/**
 * Format a number with the pinned price locale.
 *
 * @param {number} value
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string}
 */
export const formatPriceNumber = (value, options) => getFormatter(options).format(value);

// Test seam: the cache is module-level and would otherwise outlive a test that
// changes the configured locale.
export const _clearFormatterCache = () => formatterCache.clear();
