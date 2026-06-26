// Seller origin address completeness check. The live eShip quote (and the later
// label step) needs at least street1 + city + state + zip to quote from the
// seller's location. Stored in `currentUser.profile.protectedData.shippingOrigin`.

const REQUIRED = ['street1', 'city', 'state', 'zip'];

export const hasCompleteShippingOrigin = currentUser => {
  const origin = currentUser?.attributes?.profile?.protectedData?.shippingOrigin;
  if (!origin) return false;
  return REQUIRED.every(k => typeof origin[k] === 'string' && origin[k].trim().length > 0);
};
