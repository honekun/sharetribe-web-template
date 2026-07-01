// Seller origin address completeness check. The live eShip quote (and the later
// label step) needs at least street1 + city + state + zip to quote from the
// seller's location. Stored in `currentUser.profile.protectedData.shippingOrigin`.

const REQUIRED = ['street1', 'city', 'state', 'zip'];

export const hasCompleteShippingOrigin = currentUser => {
  const origin = currentUser?.attributes?.profile?.protectedData?.shippingOrigin;
  if (!origin) return false;
  return REQUIRED.every(k => typeof origin[k] === 'string' && origin[k].trim().length > 0);
};

// The origin form uses the same granular MX fields as the checkout ShippingDetails
// (recipient* names). Compose them into the stored `shippingOrigin` object: the
// eShip-facing `street1`/`street2` (mirrors getEshipDestinationFromValues) plus the
// structured pieces (calle/exteriorNumber/interiorNumber/colonia) so the form can
// repopulate losslessly.
export const shippingOriginFromValues = values => {
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
  } = values || {};

  const streetBase = [recipientAddressLine1, recipientExteriorNumber].filter(Boolean).join(' ');
  const street1 = recipientInteriorNumber
    ? `${streetBase} Int. ${recipientInteriorNumber}`
    : streetBase;

  return {
    name: recipientName,
    street1,
    street2: recipientColonia || '',
    city: recipientCity,
    state: recipientState,
    zip: recipientPostal,
    phone: recipientPhoneNumber || '',
    // Structured (lossless) source fields for repopulating the granular form.
    calle: recipientAddressLine1,
    exteriorNumber: recipientExteriorNumber || '',
    interiorNumber: recipientInteriorNumber || '',
    colonia: recipientColonia || '',
  };
};

// Inverse of shippingOriginFromValues — seed the form from a stored origin. Falls
// back to the composed street1/street2 for origins saved before structured fields
// existed.
export const valuesFromShippingOrigin = origin => {
  const o = origin || {};
  return {
    recipientName: o.name,
    recipientAddressLine1: o.calle != null ? o.calle : o.street1,
    recipientExteriorNumber: o.exteriorNumber,
    recipientInteriorNumber: o.interiorNumber,
    recipientColonia: o.colonia != null ? o.colonia : o.street2,
    recipientPostal: o.zip,
    recipientCity: o.city,
    recipientState: o.state,
    recipientPhoneNumber: o.phone,
  };
};
