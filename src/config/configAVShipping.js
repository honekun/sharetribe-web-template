'use strict';

// AV shipping config — CommonJS so BOTH the ESM client (via webpack interop)
// and the plain-Node server (`require`) share one source of truth.
// Historical source: docs/__old/AV Configuracion Envios Jun 2026.docx.md.

const defaultPackageSize = 'M';

// Buyer-price math. markupPct = buffer over carrier cost (doc §5: ~15-20%).
// roundUpToSubunits = round the marked-up price UP to the nearest peso so we
// never under-recover and prices look clean. Both env-overridable (server-side
// only — these are not REACT_APP_ vars, so on the client they fall back to the
// defaults, which is fine: the client never computes prices, it displays the
// server-computed ones).
const markupPct = Number(process.env.ESHIP_MARKUP_PCT ?? 0.18);
const roundUpToSubunits = 100;
// Dormant: docs don't state whether eShip `amount` includes IVA. We fold IVA
// into the buffer for now; flip this once real responses are reconciled.
const eshipAmountIncludesIva = false;
// eShip endpoint: always taken from ESHIP_BASE_URL (no URL hardcoded here). Set
// it per environment — QA (`https://apiqa.myeship.co/rest`) on the test env to
// match the QA ESHIP_API_KEY, production (`https://api.myeship.co/rest`) live.
const eshipBaseUrl = process.env.ESHIP_BASE_URL;

const packageSizes = {
  S: { dimsCm: [25, 20, 8], weightMaxKg: 0.5, packaging: 'polymailer' },
  M: { dimsCm: [35, 30, 10], weightMaxKg: 1.0, packaging: 'box-medium' },
  L: { dimsCm: [50, 40, 15], weightMaxKg: 1.5, packaging: 'box-large' },
  especial: { dimsCm: null, weightMaxKg: null, packaging: 'custom' },
};

// Maps a category id → package size. Only the EXCEPTIONS to the default (`M`)
// are listed; any category not present here resolves to `M`. Resolution is
// most-specific-first (see getPackageSizeForCategory), so a level-2/level-3 id
// overrides its parent, and family-wide rules can be keyed at level 1.
//
// Source: docs/data/categoria-paquete.csv, mapped to the live taxonomy from the
// categories asset (/listings/listing-categories.json):
//   S        — small/flat items
//   L        — bulky / rigid / footwear-in-box
//   M        — default (tops, shirts, jeans, dresses, skirts, shorts, suits,
//              jumpsuits, mid-size bags, flats, heels, home textiles, etc.)
//
// The CSV groups several live categories under business labels. For example,
// "Chamarras", "Abrigos", and "Sacos" share one live category id, while
// "Tenis / Sneakers" and "Botas" each cover multiple live category ids.
const categoryPackageSizeMap = {
  // Ropa — the CSV assigns all other listed clothing categories to M.
  'ropa-sacos-chamarras': 'L', // Chamarras / Abrigos / Sacos
  'ropa-lenceria': 'S', // Lencería / pijama
  'ropa-de-bano': 'S', // De baño (swimwear)

  // Bolsas — clutch/cartera are S; tote/mochila are L; the rest default to M.
  'bolsas-clutch': 'S',
  'bolsas-carteras': 'S',
  'bolsas-totes': 'L',
  'bolsas-mochilas_casuales': 'L',
  'bolsas-mochilas_deporte': 'L',

  // Zapatos (flats/heels — tacones/sandalias/zapatillas_flats/mocasines/plataformas — default to M)
  'zapatos-tenis_casuales': 'L',
  'zapatos-tenis_deportivos': 'L',
  'zapatos-botas': 'L',
  'zapatos-botas_vaqueras': 'L',
  'zapatos-botas_tacon': 'L',
  'zapatos-botas_montana': 'L',
  'zapatos-botin': 'L',
  'zapatos-botin_tacon': 'L',
};

// Resolve the package size for a listing's category. Accepts the category level
// ids (categoryLevel1, categoryLevel2, categoryLevel3) as separate args or a
// single array, in general→specific order. The MOST SPECIFIC mapped id wins;
// otherwise falls back to the default size.
function getPackageSizeForCategory(...categoryIds) {
  const ids = categoryIds.flat().filter(Boolean);
  for (let i = ids.length - 1; i >= 0; i--) {
    const size = categoryPackageSizeMap[ids[i]];
    if (size) return size;
  }
  return defaultPackageSize;
}

// Resolve the package size for a listing from its publicData: an explicit
// `avPackageSize` wins; otherwise fall back to the category mapping (which itself
// defaults to `M`). Use this everywhere a listing's size is consumed so listings
// created before the size field existed still price/ship correctly.
function resolvePackageSize(publicData) {
  const pd = publicData || {};
  return (
    pd.avPackageSize ||
    getPackageSizeForCategory(pd.categoryLevel1, pd.categoryLevel2, pd.categoryLevel3)
  );
}

function isEspecialSize(size) {
  return size === 'especial';
}

// roundUp(amount*(1+markup)) to the nearest `roundUpToSubunits`.
function applyBuyerMarkup(amountSubunits) {
  const marked = amountSubunits * (1 + markupPct);
  return Math.ceil(marked / roundUpToSubunits) * roundUpToSubunits;
}

module.exports = {
  defaultPackageSize,
  packageSizes,
  categoryPackageSizeMap,
  getPackageSizeForCategory,
  resolvePackageSize,
  isEspecialSize,
  markupPct,
  roundUpToSubunits,
  eshipAmountIncludesIva,
  eshipBaseUrl,
  applyBuyerMarkup,
};
