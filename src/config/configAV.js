// AV-owned configuration. Keep AV-specific defaults here so they do not
// leak into upstream Sharetribe config files (which makes future merges noisy).

// ISO 3166-1 alpha-2 country code used as the default for:
//   - Stripe payment / recipient country on CheckoutPage
//   - Stripe Connect payout country on EditListingWizard
// Overridable via env so deployments outside MX don't need a code change.
export const defaultCountry = process.env.REACT_APP_AV_DEFAULT_COUNTRY || 'MX';

// Locale used to format *prices only*, independent of the marketplace UI locale
// (which the hosted /general/localization.json asset sets to Spanish). AV shows
// MXN as "$1,325.00" rather than the es-MX "1.325,00 $".
//
// Applied through `util/avNumberFormat.js`, so every price path — formatMoney,
// formatCurrencyMajorUnit and the price inputs — agrees. Overridable via env so
// a deployment can follow its own locale instead.
export const priceFormatLocale = process.env.REACT_APP_AV_PRICE_FORMAT_LOCALE || 'en-US';

// User-type values (set in `currentUser.attributes.profile.publicData.userType`)
// that may set an `originalPrice` on a listing — i.e. show the strike-through
// "was" price input in the pricing panels.
export const sellerUserTypes = ['vendedor', 'vendedor-stock'];

export const canShowOriginalPrice = currentUser => {
  const userType = currentUser?.attributes?.profile?.publicData?.userType;
  return sellerUserTypes.includes(userType);
};

// User-type values that should see the AV onboarding "welcome" popup
// (rendered by TopbarContainer). Intentionally separate from `sellerUserTypes`
// (the originalPrice gate) — the popup audience and the price-field audience
// are unrelated.
export const welcomePopupUserTypes = ['vendedor', 'vendedor-tienda'];

// Whether the welcome popup is eligible to show for this user: a matching
// seller userType that has not yet completed onboarding. The caller still
// combines this with any per-session dismissal state and route suppression
// (e.g. it is hidden on the signup page, where it would otherwise cover the
// "check your email" confirmation message).
export const canShowWelcomePopup = currentUser => {
  const publicData = currentUser?.attributes?.profile?.publicData;
  return welcomePopupUserTypes.includes(publicData?.userType) && !publicData?.onboardingCompleted;
};

// Route pathnames where the welcome popup is suppressed even when the user is
// otherwise eligible. The signup page shows a "check your email" confirmation
// right after registration that the popup would cover.
export const welcomePopupSuppressedPaths = ['/signup'];

// Note: this gate is intentionally separate from `sellerUserTypes` (the
// originalPrice gate above) — store-type tags and originalPrice are unrelated.
// Store sellers (userType === storeSellerUserType) can tag listings with one or
// more `tipoTienda` values, rendered as colored tags over the listing image.
export const storeSellerUserType = 'vendedor-tienda';
export const storeTypeFieldKey = 'tipoTienda';

// Returns [{ key, label }] of store-type tags for the listing author, or [] when
// the author is not a store seller or has no tipoTienda set. Labels resolve from
// the hosted `tipoTienda` user-field enumOptions, falling back to the raw value.
export const getStoreTypeTags = (author, config = {}) => {
  const publicData = author?.attributes?.profile?.publicData;
  if (publicData?.userType !== storeSellerUserType) {
    return [];
  }

  const raw = publicData?.[storeTypeFieldKey];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (values.length === 0) {
    return [];
  }

  const fieldConfig = (config?.user?.userFields || []).find(f => f.key === storeTypeFieldKey);
  const options = fieldConfig?.enumOptions || [];
  return values.map(value => {
    const match = options.find(o => o.option === value);
    return { key: value, label: match?.label || value };
  });
};

// Menu entries hidden from store sellers. A `vendedor-tienda` sells through the
// marketplace rather than buying on it, so the buyer-side entries are noise in
// their menus: the saved shipping address (account side nav), favorites
// (profile menu, mobile menu, UserNav, and the topbar heart), and the inbox
// sidebar's Orders tab.
//
// Entries are keyed by route name, except the inbox, whose two tabs are one
// route — `InboxPage:orders` follows the `InboxPage:<tab>` key TopbarMobileMenu
// already uses for its active-page class. The inbox itself stays visible: a
// store seller still needs the envelope to reach messages about their sales.
//
// A *visibility* gate only, and separate from the three gates above for the
// same reason those are separate from each other. Every route stays registered
// and every page keeps working, so an address, favorite or order saved before
// the account became a store seller is dropped from the menus but is never
// orphaned or unreachable by URL.
export const storeSellerHiddenNavPages = ['MyAddressesPage', 'FavoritesPage', 'InboxPage:orders'];

export const isNavPageHiddenForUserType = (userType, pageName) =>
  userType === storeSellerUserType && storeSellerHiddenNavPages.includes(pageName);

export const isNavPageHiddenForUser = (currentUser, pageName) =>
  isNavPageHiddenForUserType(currentUser?.attributes?.profile?.publicData?.userType, pageName);

// Keep `tags` as the last visible listing field so it doesn't interrupt the field
// flow. Called from `configHelpers.mergeListingConfig` on the merged field list.
export const moveListingFieldToEnd = (listingFields, keyToMove) => {
  if (!Array.isArray(listingFields) || !keyToMove) {
    return listingFields;
  }

  const matchedFields = listingFields.filter(field => field?.key === keyToMove);
  if (matchedFields.length === 0) {
    return listingFields;
  }

  const remainingFields = listingFields.filter(field => field?.key !== keyToMove);
  return [...remainingFields, ...matchedFields];
};

// The `brand` listing field is defined in code (configListingAV.js) *and* in the
// Sharetribe Console. `configHelpers.mergeListingConfig` merges the two sources at
// field granularity and prefers the code-defined object, which would discard
// Console's options entirely. Merge them here instead, before that union runs, so
// an operator can add a brand in Console without a deploy while the field's own
// config stays code-owned.
//
// Console wins per option: its entry (and so its label) replaces a code entry with
// the same key. The result is sorted by label with `other` pinned first.
export const brandFieldKey = 'brand';

// Both keys must be non-blank strings. `configHelpers.validSchemaOptions` marks the
// *whole* field invalid if a single option fails this, and `validListingFields` then
// drops `brand` from the config altogether — no filter, no wizard input, no label. One
// malformed Console row must not be able to do that. An empty/whitespace-only string
// is rejected too: it would otherwise survive as a blank option that sorts to the
// front (an empty label collates first) and shows up as a blank row in the wizard's
// searchable-select, the search filter, and a `?pub_brand=` link with no value.
const isUsableOption = option =>
  typeof option?.option === 'string' &&
  option.option.trim() !== '' &&
  typeof option?.label === 'string' &&
  option.label.trim() !== '';

// Hoisted so the comparator isn't re-resolving a collator on every call: measured at
// 1.5–7ms for 625 options versus 0.05–0.09ms hoisted (~25x), and this runs on both the
// SSR per-request path and the client-boot path.
// Not `numeric: true`: numeric collation orders "7 For All Mankind" before "525"
// and would reorder the hand-authored code list. Plain locale collation reproduces
// that list exactly, so the sort only ever places Console additions.
const brandLabelCollator = new Intl.Collator('es', { sensitivity: 'base' });
const byLabel = (a, b) => brandLabelCollator.compare(a.label, b.label);

export const mergeHostedBrandOptions = (defaultListingFields, hostedListingFields) => {
  if (!Array.isArray(defaultListingFields) || !Array.isArray(hostedListingFields)) {
    return defaultListingFields;
  }

  const codeBrand = defaultListingFields.find(field => field?.key === brandFieldKey);
  const hostedBrand = hostedListingFields.find(field => field?.key === brandFieldKey);
  const hostedOptions = hostedBrand?.enumOptions;

  if (!codeBrand || !Array.isArray(hostedOptions) || hostedOptions.length === 0) {
    return defaultListingFields;
  }

  const codeOptions = Array.isArray(codeBrand.enumOptions) ? codeBrand.enumOptions : [];
  const byOption = new Map(
    [...codeOptions, ...hostedOptions].filter(isUsableOption).map(option => [option.option, option])
  );

  const merged = [...byOption.values()].sort(byLabel);
  const other = merged.filter(option => option.option === 'other');
  const rest = merged.filter(option => option.option !== 'other');

  return defaultListingFields.map(field =>
    field === codeBrand ? { ...field, enumOptions: [...other, ...rest] } : field
  );
};

// AV shipping config lives in a CommonJS sibling (configAVShipping.js) so the
// server can require the same source. Re-export for ergonomic client imports.
const avShipping = require('./configAVShipping');
export const {
  packageSizes: shippingPackageSizes,
  defaultPackageSize,
  getPackageSizeForCategory,
  resolvePackageSize,
  isEspecialSize,
} = avShipping;
