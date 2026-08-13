/**
 * AV: Mexico-only address composition for checkout.
 *
 * Archivo Vintach ships within Mexico only, so both the shipping and the billing
 * address are captured with the MX field set (Calle / Número Exterior / Número
 * Interior / Colonia / C.P. / Ciudad / Estado) rather than upstream's flat
 * address form. See `MxAddressFields`, which renders those inputs.
 *
 * These three functions replace the same-named ones in the upstream
 * `CheckoutPageTransactionHelpers.js`. They live here so that file stays byte
 * identical to `sharetribe/web-template` and never conflicts on merge — the
 * upstream originals are simply left unused.
 *
 * All three compose the street line the same way, via `composeMxStreetLine`, so
 * the live eShip quote, the Stripe billing details and the address persisted on
 * the transaction can never drift apart.
 */

/**
 * Compose the human-readable MX street line: "Calle Ext [Int. X]".
 *
 * @param {string} street - Calle (recipientAddressLine1 / billingAddressLine1)
 * @param {string} exteriorNumber - Número Exterior
 * @param {string} interiorNumber - Número Interior (optional)
 * @returns {string}
 */
export const composeMxStreetLine = (street, exteriorNumber, interiorNumber) => {
  const base = [street, exteriorNumber].filter(Boolean).join(' ');
  return interiorNumber ? `${base} Int. ${interiorNumber}` : base;
};

/**
 * Construct billing details (JSON-like object) for the Stripe API.
 *
 * AV: the billing address uses the same MX field set as the shipping address
 * (the MxAddressFields component with the `billing` prefix), so we compose the
 * granular fields (Calle + Número Exterior [Int.] → line1, Colonia → line2) into
 * Stripe's flat address, country hardcoded to 'MX'.
 *
 * @param {Object} formValues - billingName/billingAddressLine1/billingExteriorNumber/
 *   billingInteriorNumber/billingColonia/billingPostal/billingCity/billingState
 * @param {Object} currentUser
 * @returns Object that contains name, email and potentially address data for the Stripe API
 */
export const getBillingDetails = (formValues, currentUser) => {
  const {
    billingName,
    billingAddressLine1,
    billingExteriorNumber,
    billingInteriorNumber,
    billingColonia,
    billingPostal,
    billingCity,
    billingState,
  } = formValues;

  const line1 = composeMxStreetLine(
    billingAddressLine1,
    billingExteriorNumber,
    billingInteriorNumber
  );

  // Billing address is recommended but optional — only include it once the buyer
  // has filled the minimum fields.
  const addressMaybe =
    billingAddressLine1 && billingPostal
      ? {
          address: {
            city: billingCity,
            country: 'MX',
            line1,
            line2: billingColonia,
            postal_code: billingPostal,
            state: billingState,
          },
        }
      : {};
  return {
    name: billingName,
    email: currentUser?.attributes?.email,
    ...addressMaybe,
  };
};

/**
 * Construct shipping details (JSON-like object)
 *
 * AV: Mexico-only shipping form. The MX-specific fields (Número Exterior/Interior,
 * Colonia) are composed into the standard `line1`/`line2` so the seller's transaction
 * panel (DeliveryInfoMaybe) renders a complete address with no changes, and are also
 * stored as structured keys (exteriorNumber/interiorNumber/colonia) so the data stays
 * lossless for shipping labels / bulk export. Country is hardcoded to 'MX'.
 *
 * @param {Object} formValues object containing saveAfterOnetimePayment, recipientName,
 * recipientPhoneNumber, recipientAddressLine1 (Calle), recipientExteriorNumber,
 * recipientInteriorNumber, recipientColonia, recipientPostal, recipientCity, and
 * recipientState.
 * @returns shippingDetails object containing name, phoneNumber and address
 */
export const getShippingDetailsMaybe = formValues => {
  const {
    recipientName,
    recipientPhoneNumber,
    recipientAddressLine1,
    recipientExteriorNumber,
    recipientInteriorNumber,
    recipientColonia,
    recipientPostal,
    recipientCity,
    recipientState,
  } = formValues;

  const line1 = composeMxStreetLine(
    recipientAddressLine1,
    recipientExteriorNumber,
    recipientInteriorNumber
  );

  return recipientName && recipientAddressLine1 && recipientPostal
    ? {
        shippingDetails: {
          name: recipientName,
          phoneNumber: recipientPhoneNumber,
          address: {
            city: recipientCity,
            country: 'MX',
            line1,
            line2: recipientColonia,
            postalCode: recipientPostal,
            state: recipientState,
            // Structured MX fields (lossless; not displayed by DeliveryInfoMaybe).
            exteriorNumber: recipientExteriorNumber,
            interiorNumber: recipientInteriorNumber,
            colonia: recipientColonia,
          },
        },
      }
    : {};
};

/**
 * Build the eShip destination address from the MX shipping form values. Mirrors
 * the composition in `getShippingDetailsMaybe` (street1 = Calle + Ext [Int.], street2
 * = Colonia) so the live quote and the persisted order agree. Returns `null` until
 * the minimum quotable fields (street1 + postal + state + city) are present.
 *
 * @param {Object} formValues - the StripePaymentForm values (recipient* fields)
 * @returns {Object|null} { name, street1, street2, city, state, zip, country, phone }
 */
export const getEshipDestinationFromValues = formValues => {
  const {
    recipientName,
    recipientPhoneNumber,
    recipientAddressLine1,
    recipientExteriorNumber,
    recipientInteriorNumber,
    recipientColonia,
    recipientPostal,
    recipientCity,
    recipientState,
  } = formValues || {};

  const street1 = composeMxStreetLine(
    recipientAddressLine1,
    recipientExteriorNumber,
    recipientInteriorNumber
  );

  const complete =
    recipientAddressLine1 && recipientPostal && recipientState && recipientCity && recipientName;

  return complete
    ? {
        name: recipientName,
        street1,
        street2: recipientColonia || '',
        city: recipientCity,
        state: recipientState,
        zip: recipientPostal,
        country: 'MX',
        phone: recipientPhoneNumber || '',
      }
    : null;
};
