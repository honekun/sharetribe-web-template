import {
  AV_BREAKPOINTS,
  AV_SECTION_COLLAPSE_2UP_RAMP,
  AV_SECTION_GRID_RAMP,
  AV_SECTION_ONE_COLUMN_RAMP,
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
  AV_SECTION_COLLAPSE_2UP_RAMP,
  AV_SECTION_GRID_RAMP,
  AV_SECTION_ONE_COLUMN_RAMP,
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
      largeWithPaddings: 1128,
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
      expect(step.size).toMatch(/^\d+(vw|px)$/);
    });
  });

  // The whole point: a card hint must never be wide enough for a smaller grid.
  // 2 columns implies at most ~50vw, 3 at most ~33vw, and so on. Only viewport
  // units can be judged this way — a `px` step describes a band where the grid
  // has stopped tracking the viewport, and the boundary table below is what
  // checks those.
  it.each(Object.entries(ALL_RAMPS))('%s never advertises more than its share', (_name, ramp) => {
    ramp
      .filter(step => step.size.endsWith('vw'))
      .forEach(step => {
        const vw = parseInt(step.size, 10);
        const fairShare = 100 / step.columns;
        expect(vw).toBeLessThanOrEqual(fairShare);
      });
  });
});

describe('boundary widths', () => {
  // The `never advertises more than its share` test above only catches hints
  // that are too *large*. A hint that is too small is the worse failure — it
  // fetches an image narrower than the slot and renders it soft — and nothing
  // caught it, which is how Manage Listings came to advertise 21vw for a card
  // that is nearly 30vw wide at 1024px.
  //
  // So: resolve the hint the way a browser would, and compare it against the
  // card width the stylesheet actually produces. The geometry below is a hand
  // transcription of the CSS; it is the part of this file that goes stale, and
  // the formulas name their source so the next person can re-check them.

  const toPx = (size, viewportWidth) =>
    size.endsWith('vw') ? (parseFloat(size) / 100) * viewportWidth : parseFloat(size);

  // Mirrors the browser's `sizes` resolution: first matching clause wins, and a
  // clause with no media condition is the fallback.
  const resolveSizes = (sizes, viewportWidth) => {
    const clauses = sizes.split(',').map(s => s.trim());
    const match = clauses.find(clause => {
      const media = clause.match(/^\(max-width: (\d+)px\)/);
      return !media || viewportWidth <= Number(media[1]);
    });
    return toPx(match.replace(/^\(max-width: \d+px\)\s*/, ''), viewportWidth);
  };

  // ManageListingsPage.module.css: `.listingPanel` max-width --contentMaxWidth
  // + 72px (1128px) from --viewportLarge and --contentMaxWidth (1056px) from
  // --viewportXLarge; `.listingCards` padding 24px, 36px from --viewportLarge;
  // gap 24px. Columns from avBrandOverrides.css: 2, then 3 from --viewportSmall.
  const manageCard = at => {
    const panel = at >= 1921 ? Math.min(at, 1056) : at >= 1024 ? Math.min(at, 1128) : at;
    const padding = at >= 1024 ? 72 : 48;
    const columns = at >= 550 ? 3 : 2;
    return (panel - padding - (columns - 1) * 24) / columns;
  };

  // SearchPage.module.css: `.searchResultContainer` flex-basis 50% from
  // --viewportMedium and 62.5% from --viewportLarge; `.listingsForMapVariant`
  // padding 24px, 36px from --viewportLarge; gap 24px. Columns from
  // avBrandOverrides.css: 2, then 3 from --viewportXLarge.
  const mapCard = at => {
    const panel = at >= 1024 ? at * 0.625 : at >= 768 ? at * 0.5 : at;
    const padding = at >= 1024 ? 72 : 48;
    const columns = at >= 1921 ? 3 : 2;
    return (panel - padding - (columns - 1) * 24) / columns;
  };

  // SectionRecommendedListings.module.css `.baseColumn`: max-width
  // --contentMaxWidthPages (1120px), padding 32px, and `.oneColumn` stays one
  // column at every width.
  const sectionOneColumnCard = at => Math.min(at, 1120) - 64;

  const CASES = [
    // [label, sizes, viewport widths, card width at that viewport]
    [
      'manage grid',
      buildRenderSizes(AV_MANAGE_GRID_RAMP),
      [320, 549, 550, 1023, 1024, 1127, 1128, 1440, 1920, 1921, 2560],
      manageCard,
    ],
    [
      'map variant',
      buildRenderSizes(AV_MAP_VARIANT_RAMP),
      [320, 767, 768, 1023, 1024, 1440, 1920, 1921, 2560],
      mapCard,
    ],
    [
      'one-column section',
      buildSectionRenderSizes(AV_SECTION_ONE_COLUMN_RAMP, '1120px'),
      [320, 549, 550, 967, 968, 1120, 1440],
      sectionOneColumnCard,
    ],
  ];

  // A hint may never be smaller than the card. Some slack above it is fine and
  // unavoidable, since one clause has to cover a whole band — but 1.35x is the
  // most any of these needs, and a regression past it means a band grew a step.
  it.each(CASES)(
    '%s hints cover the rendered card at every band edge',
    (_label, sizes, widths, cardAt) => {
      // Reported as one object per width so a failure names the viewport that
      // broke rather than just a pair of numbers.
      const ratios = widths.map(width => ({
        width,
        undersized: resolveSizes(sizes, width) < cardAt(width),
        wasteful: resolveSizes(sizes, width) > cardAt(width) * 1.35,
      }));
      expect(ratios).toEqual(widths.map(width => ({ width, undersized: false, wasteful: false })));
    }
  );

  // The regression the one-column ramp exists to prevent: borrowing the 3-up
  // section ramp asks for a third of the image a full-width card renders.
  it('would undersize a one-column section using the three-column ramp', () => {
    const wrong = buildSectionRenderSizes(AV_SECTION_GRID_RAMP, '1120px');
    expect(resolveSizes(wrong, 900)).toBeLessThan(sectionOneColumnCard(900) / 2);
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

  // The two ramps whose grids stop tracking the viewport at a max-width, and
  // therefore state their widest bands in px.
  it('emits px clauses where the grid has stopped growing', () => {
    expect(buildRenderSizes(AV_MANAGE_GRID_RAMP)).toEqual(
      '(max-width: 549px) 50vw, (max-width: 1023px) 33vw, (max-width: 1127px) 30vw, (max-width: 1920px) 336px, 312px'
    );
    expect(buildRenderSizes(AV_MAP_VARIANT_RAMP)).toEqual(
      '(max-width: 767px) 50vw, (max-width: 1023px) 25vw, (max-width: 1920px) 29vw, 20vw'
    );
  });

  it('handles a single-step ramp as a bare size', () => {
    expect(buildRenderSizes([{ minWidth: 0, columns: 1, size: '100vw' }])).toEqual('100vw');
    expect(buildRenderSizes(AV_SECTION_ONE_COLUMN_RAMP)).toEqual('100vw');
  });

  it('puts no comma-trailing clause after the fallback', () => {
    Object.values(ALL_RAMPS).forEach(ramp => {
      expect(buildRenderSizes(ramp)).toMatch(/\d+(vw|px)$/);
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
