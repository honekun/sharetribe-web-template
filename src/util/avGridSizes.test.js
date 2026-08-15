import {
  AV_BREAKPOINTS,
  AV_SECTION_COLLAPSE_2UP_RAMP,
  AV_SECTION_GRID_RAMP,
  buildSectionRenderSizes,
  effectiveSectionColumns,
  AV_LISTING_GRID_RAMP,
  AV_MANAGE_GRID_RAMP,
  AV_MAP_VARIANT_RAMP,
  AV_SECTION_COLLAPSE_RAMP,
  buildRenderSizes,
  columnsAt,
} from './avGridSizes';

const ALL_RAMPS = {
  AV_LISTING_GRID_RAMP,
  AV_MANAGE_GRID_RAMP,
  AV_MAP_VARIANT_RAMP,
  AV_SECTION_COLLAPSE_RAMP,
};

describe('AV_BREAKPOINTS', () => {
  // Pinned against styles/customMediaQueries.css. A change here without a
  // matching change there is exactly the drift this module exists to prevent.
  it('mirrors the CSS custom media queries', () => {
    expect(AV_BREAKPOINTS).toEqual({
      small: 550,
      medium: 768,
      mLarge: 968,
      large: 1024,
      xLarge: 1440,
      xxLarge: 1921,
    });
  });
});

describe('ramp shape', () => {
  it.each(Object.entries(ALL_RAMPS))('%s starts at 0 and ascends', (_name, ramp) => {
    expect(ramp[0].minWidth).toEqual(0);
    const widths = ramp.map(s => s.minWidth);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(new Set(widths).size).toEqual(widths.length);
  });

  it.each(Object.entries(ALL_RAMPS))('%s declares columns and a size per step', (_name, ramp) => {
    ramp.forEach(step => {
      expect(typeof step.columns).toBe('number');
      expect(step.size).toMatch(/^\d+vw$/);
    });
  });

  // The whole point: a card hint must never be wide enough for a smaller grid.
  // 2 columns implies at most ~50vw, 3 at most ~33vw, and so on.
  it.each(Object.entries(ALL_RAMPS))('%s never advertises more than its share', (_name, ramp) => {
    ramp.forEach(step => {
      const vw = parseInt(step.size, 10);
      const fairShare = 100 / step.columns;
      expect(vw).toBeLessThanOrEqual(fairShare);
    });
  });
});

describe('columnsAt', () => {
  it('returns the columns the listing grid renders at each band', () => {
    expect(columnsAt(AV_LISTING_GRID_RAMP, 320)).toEqual(2);
    expect(columnsAt(AV_LISTING_GRID_RAMP, 549)).toEqual(2);
    expect(columnsAt(AV_LISTING_GRID_RAMP, 550)).toEqual(3);
    expect(columnsAt(AV_LISTING_GRID_RAMP, 1023)).toEqual(3);
    expect(columnsAt(AV_LISTING_GRID_RAMP, 1439)).toEqual(3);
    expect(columnsAt(AV_LISTING_GRID_RAMP, 1440)).toEqual(4);
    expect(columnsAt(AV_LISTING_GRID_RAMP, 1921)).toEqual(5);
  });

  it('caps the manage grid at three columns', () => {
    expect(columnsAt(AV_MANAGE_GRID_RAMP, 1920)).toEqual(3);
    expect(columnsAt(AV_MANAGE_GRID_RAMP, 2560)).toEqual(3);
  });

  it('reports the collapsed section grid, not the operator column count', () => {
    expect(columnsAt(AV_SECTION_COLLAPSE_RAMP, 400)).toEqual(2);
    expect(columnsAt(AV_SECTION_COLLAPSE_RAMP, 900)).toEqual(3);
  });
});

describe('buildRenderSizes', () => {
  it('emits ascending max-width clauses with a bare fallback last', () => {
    expect(buildRenderSizes(AV_LISTING_GRID_RAMP)).toEqual(
      '(max-width: 549px) 50vw, (max-width: 1023px) 33vw, (max-width: 1439px) 26vw, (max-width: 1920px) 18vw, 14vw'
    );
  });

  // The PageBuilder sections' hints are hard to observe in the browser, because
  // a card without a photo renders no <img> at all. Pin the exact output here.
  it('builds collapsing-section hints with the desktop size last', () => {
    expect(buildSectionRenderSizes(AV_SECTION_COLLAPSE_RAMP, '400px')).toEqual(
      '(max-width: 549px) 50vw, (max-width: 967px) 33vw, 400px'
    );
    expect(buildSectionRenderSizes(AV_SECTION_COLLAPSE_2UP_RAMP, '265px')).toEqual(
      '(max-width: 967px) 50vw, 265px'
    );
    expect(buildSectionRenderSizes(AV_SECTION_GRID_RAMP, '600px')).toEqual(
      '(max-width: 549px) 100vw, (max-width: 967px) 33vw, 600px'
    );
  });

  it('handles a single-step ramp as a bare size', () => {
    expect(buildRenderSizes([{ minWidth: 0, columns: 1, size: '100vw' }])).toEqual('100vw');
  });

  it('puts no comma-trailing clause after the fallback', () => {
    Object.values(ALL_RAMPS).forEach(ramp => {
      expect(buildRenderSizes(ramp).endsWith('vw')).toBe(true);
      expect(buildRenderSizes(ramp)).not.toMatch(/,\s*$/);
    });
  });
});

describe('effectiveSectionColumns', () => {
  const originalWidth = window.innerWidth;
  const setWidth = w => {
    Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  };
  afterEach(() => setWidth(originalWidth));

  it('reports the collapsed grid below --viewportMLarge, ignoring the operator setting', () => {
    setWidth(400);
    expect(effectiveSectionColumns(AV_SECTION_COLLAPSE_RAMP, 4)).toEqual(2);
    setWidth(900);
    expect(effectiveSectionColumns(AV_SECTION_COLLAPSE_RAMP, 4)).toEqual(3);
    // Even when the operator asked for fewer columns than the grid renders.
    setWidth(900);
    expect(effectiveSectionColumns(AV_SECTION_COLLAPSE_RAMP, 1)).toEqual(3);
  });

  it('honours the operator setting from --viewportMLarge up', () => {
    setWidth(968);
    expect(effectiveSectionColumns(AV_SECTION_COLLAPSE_RAMP, 4)).toEqual(4);
    setWidth(1400);
    expect(effectiveSectionColumns(AV_SECTION_COLLAPSE_RAMP, 2)).toEqual(2);
  });

  it('keeps the 2-up sections at two columns across the whole collapsed range', () => {
    setWidth(400);
    expect(effectiveSectionColumns(AV_SECTION_COLLAPSE_2UP_RAMP, 4)).toEqual(2);
    setWidth(900);
    expect(effectiveSectionColumns(AV_SECTION_COLLAPSE_2UP_RAMP, 4)).toEqual(2);
  });
});
