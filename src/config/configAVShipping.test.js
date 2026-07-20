const {
  getPackageSizeForCategory,
  getShippingPrice,
  isEspecialSize,
  getAvailableDeliveryTypes,
  defaultPackageSize,
} = require('./configAVShipping');

describe('configAVShipping helpers', () => {
  const cfg = require('./configAVShipping');
  let original;

  beforeEach(() => {
    original = JSON.parse(JSON.stringify(cfg.priceGrid));
  });

  afterEach(() => {
    Object.assign(cfg.priceGrid, original);
  });

  test('getPackageSizeForCategory falls back to default for unknown category', () => {
    expect(getPackageSizeForCategory('does-not-exist')).toBe(defaultPackageSize);
    expect(defaultPackageSize).toBe('M');
  });

  test('isEspecialSize is true only for especial', () => {
    expect(isEspecialSize('especial')).toBe(true);
    expect(isEspecialSize('M')).toBe(false);
  });

  test('getShippingPrice returns null for especial and unknown', () => {
    expect(getShippingPrice('especial', 'nacionalEstandar')).toBeNull();
    expect(getShippingPrice('M', 'no-such-type')).toBeNull();
    expect(getShippingPrice('Z', 'nacionalEstandar')).toBeNull();
  });

  test('getAvailableDeliveryTypes returns both priced national types', () => {
    cfg.priceGrid.M.nacionalEstandar = 12900;
    cfg.priceGrid.M.nacionalExpress = 18900;
    expect(getAvailableDeliveryTypes('M')).toEqual(['nacionalExpress', 'nacionalEstandar']);
  });

  test('getAvailableDeliveryTypes hides unpriced types', () => {
    cfg.priceGrid.M.nacionalEstandar = 12900;
    cfg.priceGrid.M.nacionalExpress = null;
    expect(getAvailableDeliveryTypes('M')).toEqual(['nacionalEstandar']);
  });

  test('getAvailableDeliveryTypes returns [] for especial', () => {
    expect(getAvailableDeliveryTypes('especial')).toEqual([]);
  });
});

describe('getPackageSizeForCategory mapping (real Console category ids)', () => {
  test('ropa sub-category exceptions; rest default to M', () => {
    expect(getPackageSizeForCategory('ropa', 'ropa-sacos-chamarras')).toBe('L');
    expect(getPackageSizeForCategory('ropa', 'ropa-lenceria')).toBe('S');
    expect(getPackageSizeForCategory('ropa', 'ropa-de-bano')).toBe('S');
    expect(getPackageSizeForCategory('ropa', 'ropa-tops')).toBe('M');
    expect(getPackageSizeForCategory('ropa', 'ropa-jeans')).toBe('M');
  });

  test('resolves most-specific first, falling back up the levels', () => {
    // level3 unmapped → falls back to the level2 exception
    expect(
      getPackageSizeForCategory(
        'ropa',
        'ropa-sacos-chamarras',
        'ropa-sacos-chamarras-chamarras-de-piel'
      )
    ).toBe('L');
    // accesorios mapped at the family (level1) → applies to all descendants
    expect(
      getPackageSizeForCategory('accesorios', 'accesorios-joyerias', 'accesorios-joyerias-collares')
    ).toBe('S');
  });

  test('bolsas: small vs large vs mid-default', () => {
    expect(getPackageSizeForCategory('bolsas', 'bolsas-clutch')).toBe('S');
    expect(getPackageSizeForCategory('bolsas', 'bolsas-carteras')).toBe('S');
    expect(getPackageSizeForCategory('bolsas', 'bolsas-totes')).toBe('L');
    expect(getPackageSizeForCategory('bolsas', 'bolsas-mochilas_deporte')).toBe('L');
    expect(getPackageSizeForCategory('bolsas', 'bolsas-mano')).toBe('M');
    expect(getPackageSizeForCategory('bolsas', 'bolsas-cruzadas')).toBe('M');
  });

  test('zapatos: sneakers/boots L, flats/heels default M', () => {
    expect(getPackageSizeForCategory('zapatos', 'zapatos-tenis_deportivos')).toBe('L');
    expect(getPackageSizeForCategory('zapatos', 'zapatos-botas')).toBe('L');
    expect(getPackageSizeForCategory('zapatos', 'zapatos-botin')).toBe('L');
    expect(getPackageSizeForCategory('zapatos', 'zapatos-tacones')).toBe('M');
    expect(getPackageSizeForCategory('zapatos', 'zapatos-zapatillas_flats')).toBe('M');
  });

  test('accesorios family → S; home-antiques family → especial', () => {
    expect(getPackageSizeForCategory('accesorios', 'accesorios-lentes')).toBe('S');
    expect(getPackageSizeForCategory('home-antiques', 'home-antiques-antiguedades')).toBe(
      'especial'
    );
  });

  test('unknown/empty inputs fall back to default', () => {
    expect(getPackageSizeForCategory('does-not-exist')).toBe('M');
    expect(getPackageSizeForCategory()).toBe('M');
    expect(getPackageSizeForCategory(undefined, null)).toBe('M');
  });
});

describe('applyBuyerMarkup', () => {
  const { applyBuyerMarkup, markupPct, roundUpToSubunits } = require('./configAVShipping');

  test('applies the markup and rounds up to the nearest peso', () => {
    // 10000 centavos * 1.18 = 11800 -> already a whole peso
    expect(applyBuyerMarkup(10000)).toBe(11800);
  });

  test('rounds a fractional-peso result UP to the next peso', () => {
    // 9999 * 1.18 = 11798.82 -> ceil to nearest 100 -> 11800
    expect(applyBuyerMarkup(9999)).toBe(11800);
  });

  test('uses the configured markup and rounding constants', () => {
    expect(markupPct).toBeCloseTo(0.18, 5);
    expect(roundUpToSubunits).toBe(100);
  });
});

// Note: bucket selection (Express/Estándar) is computed from price/days in
// server/services/shippingQuoteService.js (pickExpressRate/pickEstandarRate),
// not from eShip tags — see shippingQuoteService.test.js `buildBuckets`.

describe('resolvePackageSize(publicData)', () => {
  const { resolvePackageSize } = require('./configAVShipping');

  test('prefers an explicit avPackageSize', () => {
    expect(resolvePackageSize({ avPackageSize: 'L', categoryLevel1: 'ropa' })).toBe('L');
  });

  test('falls back to the category mapping when avPackageSize is absent', () => {
    expect(
      resolvePackageSize({ categoryLevel1: 'ropa', categoryLevel2: 'ropa-sacos-chamarras' })
    ).toBe('L');
    expect(resolvePackageSize({ categoryLevel1: 'accesorios' })).toBe('S');
  });

  test('falls back to the default size for unmapped/empty publicData', () => {
    expect(
      resolvePackageSize({ categoryLevel1: 'bolsas', categoryLevel2: 'bolsas-formales' })
    ).toBe('M');
    expect(resolvePackageSize({})).toBe('M');
    expect(resolvePackageSize()).toBe('M');
  });
});
