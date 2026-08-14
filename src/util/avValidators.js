import { types as sdkTypes } from './sdkLoader';

const { Money } = sdkTypes;

// Final Form expects an undefined value for a successful validation
const VALID = undefined;

/**
 * Validates the AV "original price" (the strike-through "was" price).
 *
 * The value is optional, but when it is given it has to be higher than the
 * listing price — a lower or equal value is never displayed (OrderPanel,
 * AVListingCard and AVBagItemCard all require `originalPrice > price`), so
 * accepting one would silently store a value the marketplace never shows.
 *
 * Field-level validators in Final Form receive the whole form state as the
 * second argument, which is how the price is reached from here. Note this
 * cannot be wrapped in `composeValidators` — that helper forwards only the
 * value.
 *
 * @param {string} message - The error message shown when the value is too low
 * @returns {(value: Money, allValues: Object) => string|undefined}
 */
export const originalPriceAbovePrice = message => (value, allValues) => {
  // The field is optional: nothing entered, nothing to check.
  if (!(value instanceof Money)) {
    return VALID;
  }

  // Price has its own validators; don't add a second error while it is empty.
  const price = allValues?.price;
  if (!(price instanceof Money)) {
    return VALID;
  }

  // Both inputs are rendered with the marketplace currency, so a mismatch means
  // the two amounts are not comparable and the value could not be shown either.
  if (value.currency !== price.currency) {
    return message;
  }

  return value.amount > price.amount ? VALID : message;
};
