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
 * **These ramps mirror CSS and cannot be imported by it.** When a grid's media
 * queries change, change the ramp in the same commit. `avGridSizes.test.js`
 * pins the breakpoints so a silent drift in the numbers fails a test, but it
 * cannot know what the CSS says — that part is on the author.
 */

// Mirrors styles/customMediaQueries.css.
export const AV_BREAKPOINTS = {
  small: 550,
  medium: 768,
  mLarge: 968,
  large: 1024,
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
 */
export const AV_MANAGE_GRID_RAMP = [
  { minWidth: 0, columns: 2, size: '50vw' },
  { minWidth: AV_BREAKPOINTS.small, columns: 3, size: '33vw' },
  { minWidth: AV_BREAKPOINTS.large, columns: 3, size: '21vw' },
];

/**
 * Search results with the map open. The list shares its width with the map, so
 * the card is a fraction of a panel rather than of the viewport.
 */
export const AV_MAP_VARIANT_RAMP = [
  { minWidth: 0, columns: 2, size: '50vw' },
  { minWidth: AV_BREAKPOINTS.medium, columns: 2, size: '25vw' },
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
 * SectionRecommendedListings, which is a plain grid rather than a collapsing
 * carousel: one column below --viewportSmall, three up to --viewportMLarge.
 */
export const AV_SECTION_GRID_RAMP = [
  { minWidth: 0, columns: 1, size: '100vw' },
  { minWidth: AV_BREAKPOINTS.small, columns: 3, size: '33vw' },
];

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
