import appSettings from '../config/settings';
import { types as sdkTypes } from './sdkLoader';

const { Money } = sdkTypes;

/**
 * AV "original price" (the strike-through "was" price, `publicData.originalPrice`).
 *
 * The value is seller-controlled extended data: the edit forms validate it, but
 * a seller using the Marketplace API directly can store anything, and the
 * upstream sanitizer passes unconfigured nested public data through unchanged.
 * Constructing `Money` from it and formatting it throws for an unknown currency
 * (`formatMoney` → `unitDivisor`), which takes down every SSR page that renders
 * the listing. Every consumer reads it through these helpers instead (audit A03).
 */

const isKnownCurrency = currency =>
  typeof currency === 'string' &&
  Object.prototype.hasOwnProperty.call(appSettings.subUnitDivisors || {}, currency);

// A stored `{ amount, currency }` in minor units, or null.
const readStoredOriginalPrice = (originalPrice, currency) => {
  if (!originalPrice || typeof originalPrice !== 'object') return null;
  const { amount } = originalPrice;
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  if (originalPrice.currency !== currency || !isKnownCurrency(currency)) return null;
  return new Money(amount, currency);
};

/**
 * The original price to display next to `price`, or null when it is malformed,
 * in another currency than the listing price, or not above it.
 *
 * @param {Object} originalPrice - `publicData.originalPrice` as stored
 * @param {Money} price - the listing's current price
 * @returns {Money|null}
 */
export const getValidOriginalPrice = (originalPrice, price) => {
  if (!price || !Number.isSafeInteger(price.amount)) return null;
  const money = readStoredOriginalPrice(originalPrice, price.currency);
  return money && money.amount > price.amount ? money : null;
};

/**
 * The original price to preload into the pricing forms, or null.
 *
 * Only shape and currency are checked here: `FieldCurrencyInput` throws on a
 * Money in a currency other than the marketplace's, while a value not above
 * the price is left for the form's own validator to flag.
 *
 * @param {Object} originalPrice - `publicData.originalPrice` as stored
 * @param {string} marketplaceCurrency - the currency the form edits in
 * @returns {Money|null}
 */
export const getOriginalPriceInitialValue = (originalPrice, marketplaceCurrency) =>
  readStoredOriginalPrice(originalPrice, marketplaceCurrency);

// `{ originalPrice }` when there is one to preload, else `{}` — for spreading
// into a form's initial values.
export const originalPriceInitialValueMaybe = (originalPrice, marketplaceCurrency) => {
  const value = getOriginalPriceInitialValue(originalPrice, marketplaceCurrency);
  return value ? { originalPrice: value } : {};
};
