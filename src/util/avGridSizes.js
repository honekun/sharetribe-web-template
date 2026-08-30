/**
 * AV: one source of truth for how many columns each listing grid renders at a
 * given viewport width, and how wide a card therefore is.
 *
 * The problem this solves: the column counts live in CSS media queries, the
 * `sizes` hints live in JS string literals, and the PageBuilder carousels keep a
 * third copy in their own `getEffectiveColumns`. Nothing tied them together, so
 * changing the grid left the hints advertising the old layout — which makes the
 * browser download images up to 3x wider than the slot they land in.
 *
 * A ramp is an ascending list of breakpoints. `columns` is what the CSS renders
 * at that width; `size` is the `sizes` hint for one card there. They are
 * separate facts: between 550px and 1439px the listing grid is 3 columns
 * throughout, but a card is ~33vw on a phone and ~26vw once the content
 * max-width takes over, because the grid stops growing with the viewport.
 *
 * A `size` may be `vw` or `px`. Past a `max-width` cap the card stops tracking
 * the viewport entirely, and there is no single `vw` value that is accurate on
 * both sides of the cap: pick one that fits at the cap and it over-fetches by
 * 70% two breakpoints later. Those bands are stated in `px`, which is what they
 * actually are.
 *
 * **These ramps mirror CSS and cannot be imported by it.** When a grid's media
 * queries change, change the ramp in the same commit. `avGridSizes.test.js`
 * pins the breakpoints, and its boundary table checks each hint against the
 * card width the CSS geometry produces at the edges of each band — in both
 * directions, since a hint that is too small fetches a soft image just as
 * surely as one that is too large wastes bytes. That table is still a hand
 * transcription of the stylesheet; keeping it true is on the author.
 */

// Mirrors styles/customMediaQueries.css, plus the two bare `min-width` values
// AV's own overrides use (1440px in avBrandOverrides.css, and the 550px that
// predates --viewportSmall being used there).
export const AV_BREAKPOINTS = {
  small: 550,
  medium: 768,
  mLarge: 968,
  large: 1024,
  largeWithPaddings: 1128,
  xLarge: 1440,
  xxLarge: 1921,
};

/**
 * Search results (non-map), Favorites and Profile.
 * CSS: avBrandOverrides.css `SearchResultsPanel_listingCards__` /
 * `ProfilePage_listings__`, and FavoritesPage.module.css `.listingCards`.
 */
export const AV_LISTING_GRID_RAMP = [
  { minWidth: 0, columns: 2, size: '50vw' },
  { minWidth: AV_BREAKPOINTS.small, columns: 3, size: '33vw' },
  { minWidth: AV_BREAKPOINTS.large, columns: 3, size: '26vw' },
  { minWidth: AV_BREAKPOINTS.xLarge, columns: 4, size: '18vw' },
  { minWidth: AV_BREAKPOINTS.xxLarge, columns: 5, size: '14vw' },
];

/**
 * Manage listings. Same ramp up to --viewportLarge, but it stops at 3 columns
 * rather than stepping to 4 and 5 (avBrandOverrides.css
 * `ManageListingsPage_listingCards__` has no 1440/1921 rules).
 *
 * `.listingPanel` caps at --contentMaxWidth + 72px (1128px) from
 * --viewportLarge and at --contentMaxWidth (1056px) from --viewportXLarge,
 * inside 36px of `.listingCards` padding and two 24px gaps. So the card is
 * (1128 - 72 - 48) / 3 = 336px through most of the desktop range and 312px on
 * very wide screens — fixed widths, not fractions of the viewport. Advertising
 * the 1128px figure as `30vw` would ask for 576px at 1920px wide.
 */
export const AV_MANAGE_GRID_RAMP = [
  { minWidth: 0, columns: 2, size: '50vw' },
  { minWidth: AV_BREAKPOINTS.small, columns: 3, size: '33vw' },
  { minWidth: AV_BREAKPOINTS.large, columns: 3, size: '30vw' },
  { minWidth: AV_BREAKPOINTS.largeWithPaddings, columns: 3, size: '336px' },
  { minWidth: AV_BREAKPOINTS.xxLarge, columns: 3, size: '312px' },
];

/**
 * Search results with the map open. The list shares its width with the map, so
 * the card is a fraction of a panel rather than of the viewport.
 *
 * `.searchResultContainer` takes 50% of the viewport from --viewportMedium and
 * 62.5% from --viewportLarge, inside `.listingsForMapVariant` padding (24px,
 * then 36px) and one 24px gap. Two columns give 25vw - 36px and then
 * 31.25vw - 48px, the latter reaching ~28.8vw at 1920px — which is why this
 * band cannot keep the 25vw the narrower one uses.
 */
export const AV_MAP_VARIANT_RAMP = [
  { minWidth: 0, columns: 2, size: '50vw' },
  { minWidth: AV_BREAKPOINTS.medium, columns: 2, size: '25vw' },
  { minWidth: AV_BREAKPOINTS.large, columns: 2, size: '29vw' },
  { minWidth: AV_BREAKPOINTS.xxLarge, columns: 3, size: '20vw' },
];

/**
 * The AV PageBuilder sections that collapse from a carousel to a static grid
 * below --viewportMLarge (968px). Above that the operator's own column count
 * applies and this ramp no longer describes the layout.
 */
export const AV_SECTION_COLLAPSE_RAMP = [
  { minWidth: 0, columns: 2, size: '50vw' },
  { minWidth: AV_BREAKPOINTS.small, columns: 3, size: '33vw' },
];

/**
 * SectionSelectedCat and SectionSelectedUser. They collapse the same way but
 * stayed 2-up at every width below 968px — their cards are categories and
 * seller profiles rather than listings, so they were left out of the 3-up
 * change.
 */
export const AV_SECTION_COLLAPSE_2UP_RAMP = [{ minWidth: 0, columns: 2, size: '50vw' }];

/**
 * SectionRecommendedListings at two columns and above, which is a plain grid
 * rather than a collapsing carousel: one column below --viewportSmall, three up
 * to --viewportMLarge.
 */
export const AV_SECTION_GRID_RAMP = [
  { minWidth: 0, columns: 1, size: '100vw' },
  { minWidth: AV_BREAKPOINTS.small, columns: 3, size: '33vw' },
];

/**
 * SectionRecommendedListings at **one** column, which needs its own ramp
 * because SectionRecommendedListings.module.css deliberately leaves `.oneColumn`
 * out of the 550-967px 3-up rule — a single-column section is a layout the
 * operator chose, not a default to be widened. Its card therefore spans the
 * whole block container at every width, and borrowing the three-column ramp
 * would ask for a third of the image it renders.
 */
export const AV_SECTION_ONE_COLUMN_RAMP = [{ minWidth: 0, columns: 1, size: '100vw' }];

/**
 * The columns rendered at a given viewport width.
 *
 * @param {Array} ramp ascending list of { minWidth, columns }
 * @param {number} viewportWidth
 * @returns {number}
 */
export const columnsAt = (ramp, viewportWidth) => {
  const match = [...ramp].reverse().find(step => viewportWidth >= step.minWidth);
  return match ? match.columns : ramp[0].columns;
};

/**
 * Build a `sizes` attribute from a ramp.
 *
 * Each step becomes a `(max-width: <next.minWidth - 1>px) <size>` clause, and
 * the last step is the unconditional fallback — the order `sizes` requires.
 *
 * @param {Array} ramp ascending list of { minWidth, size }
 * @returns {string}
 */
export const buildRenderSizes = ramp =>
  ramp
    .map((step, i) => {
      const next = ramp[i + 1];
      return next ? `(max-width: ${next.minWidth - 1}px) ${step.size}` : step.size;
    })
    .join(', ');

/**
 * The `sizes` hint for a PageBuilder section that collapses to a static grid
 * below --viewportMLarge and uses the operator's own column count above it.
 *
 * @param {Array} collapseRamp the ramp describing the collapsed grid
 * @param {string} desktopSize hint for one card at the operator's column count
 * @returns {string}
 */
export const buildSectionRenderSizes = (collapseRamp, desktopSize) =>
  buildRenderSizes([...collapseRamp, { minWidth: AV_BREAKPOINTS.mLarge, size: desktopSize }]);

/**
 * Columns actually rendered by a collapsing PageBuilder section.
 *
 * Below --viewportMLarge the CSS lays the items out as a fixed grid and ignores
 * the operator's setting entirely, so the ramp is authoritative there. At or
 * above it the section is a real carousel again and the operator's count wins.
 *
 * Returns `numColumns` during SSR, where there is no viewport to measure.
 *
 * @param {Array} collapseRamp
 * @param {number} numColumns operator's configured column count
 * @returns {number}
 */
export const effectiveSectionColumns = (collapseRamp, numColumns) => {
  if (typeof window === 'undefined') return numColumns;
  const w = window.innerWidth;
  return w >= AV_BREAKPOINTS.mLarge ? numColumns : columnsAt(collapseRamp, w);
};
