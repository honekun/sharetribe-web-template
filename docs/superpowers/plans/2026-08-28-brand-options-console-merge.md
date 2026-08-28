# Brand Options Console Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator add a brand in the Sharetribe Console and have it appear across the app without a deploy, by merging the Console `brand` field's `enumOptions` into the code-defined `brand` listing field.

**Architecture:** `src/util/configHelpers.js` merges hosted (Console) and code-defined listing fields at *field* granularity, so the code `brand` object replaces the Console one wholesale and Console's options are discarded. A new AV helper in `src/config/configAV.js` enriches the code-defined field's `enumOptions` with the Console ones *before* that merge runs, so `configHelpers`' own "code field wins" semantics are untouched and the upstream diff stays at a single line. Every consumer already reads the merged config, so nothing else changes.

**Tech Stack:** React 18, Jest + React Testing Library, CRA-based build, Yarn 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-brand-options-console-merge-design.md`

## Global Constraints

- **Scope is `brand` only.** `color` and `all_sizes` must keep today's behaviour: the code field wins wholesale and Console is ignored. Task 3 pins this with a test.
- **Precedence:** options merge; on the same option key the **Console** entry wins (its label). The field's own config — `schemaType`, `filterConfig`, `showConfig`, `saveConfig`, `isRequired` — stays **code-owned**.
- **Sort comparator is exactly** `localeCompare(a.label, b.label, 'es', { sensitivity: 'base' })`. Do **not** add `numeric: true` — it collates `7 For All Mankind` before `525` and reorders the existing list. The chosen comparator was measured to be a no-op over the current 625 options.
- `other` (label `Otra...`) is pinned first, after sorting.
- **Never mutate** `avListingFields` or either input array. It is module-level shared state.
- **Upstream File Policy:** `src/util/configHelpers.js` is an upstream file. Change exactly one line in it (line 1387). Put all logic in `configAV.js`.
- **No commit attribution.** Do not add a `Co-Authored-By: Claude` trailer to any commit in this repo.
- Run tests with `CI=true yarn test -- --watchAll=false --testPathPattern=<pattern>`. Without `CI=true` Jest enters interactive watch mode and hangs.

---

### Task 1: `mergeHostedBrandOptions` helper

Pure function, no wiring. After this task the helper exists and is fully tested but nothing calls it.

**Files:**
- Modify: `src/config/configAV.js` (append before the `configAVShipping` re-export block at the end, i.e. after `moveListingFieldToEnd` which ends at line 118)
- Test: `src/config/configAV.test.js` (append a new top-level `describe` after the existing `moveListingFieldToEnd` describe)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const brandFieldKey = 'brand'` — string
  - `export const mergeHostedBrandOptions = (defaultListingFields, hostedListingFields) => Array` — takes two listing-field arrays, returns a listing-field array. Returns the `defaultListingFields` reference **unchanged** when the merge cannot apply. Task 2 calls this.

- [ ] **Step 1: Write the failing tests**

Append to `src/config/configAV.test.js`. Add `brandFieldKey` and `mergeHostedBrandOptions` to the existing import block at the top of the file (the import list is alphabetised — `brandFieldKey` goes after `canShowWelcomePopup`... in fact alphabetically it goes first, before `canShowOriginalPrice`; `mergeHostedBrandOptions` goes after `isNavPageHiddenForUserType`).

```js
describe('mergeHostedBrandOptions', () => {
  const codeFields = () => [
    { key: 'color', schemaType: 'multi-enum', enumOptions: [{ option: 'rojo', label: 'Rojo' }] },
    {
      key: 'brand',
      scope: 'public',
      schemaType: 'enum',
      enumOptions: [
        { option: 'other', label: 'Otra...' },
        { option: 'zara', label: 'Zara' },
        { option: 'prada', label: 'Prada' },
      ],
      saveConfig: { label: 'Marca', isRequired: true },
      filterConfig: { indexForSearch: true, filterType: 'SelectMultipleFilter' },
    },
  ];

  const hostedFields = enumOptions => [
    { key: 'brand', scope: 'public', schemaType: 'enum', enumOptions },
  ];

  const brandOf = fields => fields.find(field => field.key === 'brand');
  const optionsOf = fields => brandOf(fields).enumOptions.map(option => option.option);

  it('adds a Console-only brand', () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([{ option: 'gucci', label: 'Gucci' }])
    );

    expect(optionsOf(merged)).toContain('gucci');
  });

  it('keeps a code-only brand', () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([{ option: 'gucci', label: 'Gucci' }])
    );

    expect(optionsOf(merged)).toContain('prada');
  });

  it("prefers the Console label when both define the same option", () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([{ option: 'zara', label: 'ZARA' }])
    );

    expect(brandOf(merged).enumOptions).toContainEqual({ option: 'zara', label: 'ZARA' });
  });

  it('leaves the code-owned field config untouched', () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([{ option: 'gucci', label: 'Gucci' }])
    );

    expect(brandOf(merged).saveConfig).toEqual({ label: 'Marca', isRequired: true });
    expect(brandOf(merged).filterConfig.filterType).toEqual('SelectMultipleFilter');
    expect(brandOf(merged).schemaType).toEqual('enum');
  });

  it('sorts merged options by label with `other` pinned first', () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([{ option: 'gucci', label: 'Gucci' }])
    );

    expect(optionsOf(merged)).toEqual(['other', 'gucci', 'prada', 'zara']);
  });

  it('sorts accent-insensitively', () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([{ option: 'ala-a', label: 'Alaïa' }])
    );

    expect(optionsOf(merged)).toEqual(['other', 'ala-a', 'prada', 'zara']);
  });

  it('drops an option whose `option` or `label` is not a string', () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([
        { option: 42, label: 'Numeric key' },
        { option: 'no-label', label: null },
        { option: 'gucci', label: 'Gucci' },
      ])
    );

    expect(optionsOf(merged)).toEqual(['other', 'gucci', 'prada', 'zara']);
  });

  it('leaves other fields alone', () => {
    const merged = mergeHostedBrandOptions(
      codeFields(),
      hostedFields([{ option: 'gucci', label: 'Gucci' }])
    );

    expect(merged.find(field => field.key === 'color').enumOptions).toEqual([
      { option: 'rojo', label: 'Rojo' },
    ]);
  });

  it('does not mutate its inputs', () => {
    const code = codeFields();
    const hosted = hostedFields([{ option: 'gucci', label: 'Gucci' }]);

    mergeHostedBrandOptions(code, hosted);

    expect(optionsOf(code)).toEqual(['other', 'zara', 'prada']);
    expect(hosted[0].enumOptions).toEqual([{ option: 'gucci', label: 'Gucci' }]);
  });

  describe('identity guards', () => {
    it('returns the input unchanged when the hosted brand field is absent', () => {
      const code = codeFields();

      expect(mergeHostedBrandOptions(code, [{ key: 'color' }])).toBe(code);
    });

    it('returns the input unchanged when the code brand field is absent', () => {
      const code = [{ key: 'color', schemaType: 'multi-enum', enumOptions: [] }];

      expect(
        mergeHostedBrandOptions(code, hostedFields([{ option: 'gucci', label: 'Gucci' }]))
      ).toBe(code);
    });

    it('returns the input unchanged when hosted enumOptions is empty or missing', () => {
      const code = codeFields();

      expect(mergeHostedBrandOptions(code, hostedFields([]))).toBe(code);
      expect(mergeHostedBrandOptions(code, [{ key: 'brand', schemaType: 'enum' }])).toBe(code);
    });

    it('returns the input unchanged when either argument is not an array', () => {
      const code = codeFields();

      expect(mergeHostedBrandOptions(code, undefined)).toBe(code);
      expect(mergeHostedBrandOptions(code, null)).toBe(code);
      expect(mergeHostedBrandOptions(undefined, hostedFields([]))).toBeUndefined();
    });
  });

  it('exposes the brand field key', () => {
    expect(brandFieldKey).toEqual('brand');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true yarn test -- --watchAll=false --testPathPattern=configAV`

Expected: FAIL. Every `mergeHostedBrandOptions` test errors with `TypeError: (0 , _configAV.mergeHostedBrandOptions) is not a function`, and the `brandFieldKey` test fails on `undefined`. The pre-existing `configAV` and `moveListingFieldToEnd` tests still pass.

- [ ] **Step 3: Write the implementation**

Append to `src/config/configAV.js`, immediately after `moveListingFieldToEnd` (which ends at line 118) and **before** the `const avShipping = require('./configAVShipping');` block at the end of the file:

```js
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

// Both keys must be strings. `configHelpers.validSchemaOptions` marks the *whole*
// field invalid if a single option fails this, and `validListingFields` then drops
// `brand` from the config altogether — no filter, no wizard input, no label. One
// malformed Console row must not be able to do that.
const isUsableOption = option =>
  typeof option?.option === 'string' && typeof option?.label === 'string';

// Not `numeric: true`: numeric collation orders "7 For All Mankind" before "525"
// and would reorder the hand-authored code list. Plain locale collation reproduces
// that list exactly, so the sort only ever places Console additions.
const byLabel = (a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true yarn test -- --watchAll=false --testPathPattern=configAV`

Expected: PASS, all tests in the suite.

- [ ] **Step 5: Commit**

```bash
git add src/config/configAV.js src/config/configAV.test.js
git commit -m "feat(brand): merge Console brand options into the code field

Console's 'brand' listing field is discarded by the field-level union in
configHelpers. Add mergeHostedBrandOptions, which folds Console's
enumOptions into the code-defined field before that union runs: Console
wins per option, the field's own config stays code-owned, and the result
is sorted by label with 'other' pinned first.

Not wired up yet."
```

---

### Task 2: Wire the helper into the config merge

**Files:**
- Modify: `src/util/configHelpers.js:1387-1390` (one line)
- Test: `src/util/configHelpers.test.js` (new file)

**Interfaces:**
- Consumes: `mergeHostedBrandOptions` from Task 1.
- Produces: `mergeConfig(configAsset, defaultConfigs).listing.listingFields` now carries Console-only brands. Task 3 asserts the `brand`-only boundary against this same surface.

**Fixture warning — read before writing the test.** `mergeConfig` walks the whole hosted-config tree, and two upstream branches crash on a sparse fixture:

1. `configHelpers.js:1617` calls the four-parameter `mergeSortConfig(hosted, default, omitRelevance, listingFields)` with only three arguments, so `listingFields` is `undefined` and `getSortOptionsFromListingFields` throws `Cannot read properties of undefined (reading 'forEach')`. This branch is taken whenever the hosted asset has no `search.mainSearch`. **The fixture must set `search.mainSearch`.** (Pre-existing upstream bug, out of scope — production assets always carry `mainSearch`.)
2. The `mainSearch` branch does not fall back to `defaultSearchConfig`, so `dateRangeFilter` and `priceFilter` land in `defaultFilters` as `undefined` and `validDefaultFilters` throws `Cannot read properties of undefined (reading 'schemaType')`. **The fixture must also set `search.dateRangeFilter` and `search.priceFilter`.**

The suite will also print `Mandatory hosted asset for branding is missing` / `for transactionSize is missing` and several `Unsupported listing extended data configurations detected` warnings. Both are expected upstream noise on a narrow fixture — do **not** broaden the fixture to silence them (see CLAUDE.md, Testing Conventions).

- [ ] **Step 1: Write the failing test**

Create `src/util/configHelpers.test.js`:

```js
import defaultConfig from '../config/configDefault';
import { mergeConfig } from './configHelpers';

// mergeConfig walks the whole hosted-config tree. Two upstream branches throw on a
// sparse fixture, so `search` must carry mainSearch + dateRangeFilter + priceFilter
// even though this suite only cares about listingFields. See the plan for detail.
const hostedConfig = hostedListingFields => ({
  listingTypes: {
    listingTypes: [
      {
        id: 'venta',
        transactionProcess: { name: 'default-purchase', alias: 'default-purchase/release-1' },
        unitType: 'item',
      },
    ],
  },
  search: {
    mainSearch: { searchType: 'keywords' },
    dateRangeFilter: { schemaType: 'dates', enabled: false },
    priceFilter: { schemaType: 'price', enabled: false },
  },
  listingFields: { listingFields: hostedListingFields },
});

const brandOptions = configAsset => {
  const merged = mergeConfig(configAsset, defaultConfig);
  const brand = merged.listing.listingFields.find(field => field.key === 'brand');
  return brand?.enumOptions || [];
};

describe('mergeConfig listingFields — brand', () => {
  it('adds a brand that only Console defines', () => {
    const options = brandOptions(
      hostedConfig([
        {
          key: 'brand',
          scope: 'public',
          schemaType: 'enum',
          enumOptions: [{ option: 'av-test-brand', label: 'AV Test Brand' }],
        },
      ])
    );

    expect(options).toContainEqual({ option: 'av-test-brand', label: 'AV Test Brand' });
  });

  it('prefers the Console label for a brand both sources define', () => {
    const options = brandOptions(
      hostedConfig([
        {
          key: 'brand',
          scope: 'public',
          schemaType: 'enum',
          enumOptions: [{ option: 'zara', label: 'ZARA (console)' }],
        },
      ])
    );

    expect(options).toContainEqual({ option: 'zara', label: 'ZARA (console)' });
  });

  it('keeps the code-defined brands and the code-owned field config', () => {
    const merged = mergeConfig(
      hostedConfig([
        {
          key: 'brand',
          scope: 'public',
          schemaType: 'enum',
          enumOptions: [{ option: 'av-test-brand', label: 'AV Test Brand' }],
        },
      ]),
      defaultConfig
    );
    const brand = merged.listing.listingFields.find(field => field.key === 'brand');

    expect(brand.enumOptions.length).toBeGreaterThan(600);
    expect(brand.enumOptions).toContainEqual({ option: 'prada', label: 'Prada' });
    expect(brand.saveConfig.label).toEqual('Marca');
    expect(brand.filterConfig.filterType).toEqual('SelectMultipleFilter');
  });

  it('leaves the brand list untouched when Console defines no brand field', () => {
    const withConsoleBrand = brandOptions(
      hostedConfig([
        { key: 'brand', scope: 'public', schemaType: 'enum', enumOptions: [] },
      ])
    );
    const withoutConsoleBrand = brandOptions(hostedConfig([]));

    expect(withoutConsoleBrand).toEqual(withConsoleBrand);
    expect(withoutConsoleBrand[0]).toEqual({ option: 'other', label: 'Otra...' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true yarn test -- --watchAll=false --testPathPattern=configHelpers`

Expected: FAIL on the first two tests — the Console-only brand is absent, and `zara` still resolves to the code label `Zara`. The third and fourth tests pass already (they describe behaviour that must not change).

- [ ] **Step 3: Wire the helper in**

In `src/util/configHelpers.js`, extend the existing `configAV` import at **line 2**:

```js
import { moveListingFieldToEnd } from '../config/configAV';
```

becomes:

```js
import { mergeHostedBrandOptions, moveListingFieldToEnd } from '../config/configAV';
```

Then change the single call at line 1387-1390 from:

```js
  const listingFields = moveListingFieldToEnd(
    union(hostedListingFields, defaultListingFields, 'key'),
    'tags'
  );
```

to:

```js
  const listingFields = moveListingFieldToEnd(
    union(
      hostedListingFields,
      mergeHostedBrandOptions(defaultListingFields, hostedListingFields),
      'key'
    ),
    'tags'
  );
```

Also update the comment directly above it (lines 1384-1386) so it stops claiming Console is ignored. Replace:

```js
  // listingFields: always merge hosted + code-defined defaults so large enum fields
  // (brands, color, all_sizes) can be managed in code rather than in Console.
```

with:

```js
  // listingFields: always merge hosted + code-defined defaults so large enum fields
  // (brands, color, all_sizes) can be managed in code rather than in Console.
  // AV: `brand` additionally merges Console's own enumOptions into the code-defined
  // field (Console wins per option) so brands can be added without a deploy.
```

Nothing else in this file changes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true yarn test -- --watchAll=false --testPathPattern=configHelpers`

Expected: PASS, all four tests.

- [ ] **Step 5: Commit**

```bash
git add src/util/configHelpers.js src/util/configHelpers.test.js
git commit -m "feat(brand): read Console brand options in the listing config merge

Wire mergeHostedBrandOptions into mergeListingConfig so a brand added in
Console reaches the wizard input, the search filter, the listing page
label lookup and avBrandSearch without a deploy.

The new configHelpers test fixture has to set search.mainSearch,
dateRangeFilter and priceFilter: mergeSortConfig is called with three
arguments at a four-parameter signature, and the mainSearch branch does
not fall back to the default search config. Both are pre-existing
upstream issues that only surface on a sparse fixture."
```

---

### Task 3: Pin the `brand`-only boundary and the search path

Two regressions this change could plausibly cause, each locked down with a test. No production code changes in this task — if either test fails, Task 1 or 2 is wrong.

**Files:**
- Modify: `src/util/configHelpers.test.js` (append a describe)
- Modify: `src/extensions/searchFilters/avBrandSearch.test.js` (append two tests to the existing `findBrandOption` describe)

**Interfaces:**
- Consumes: `mergeConfig` behaviour from Task 2; `hostedConfig`/`brandOptions` helpers defined in Task 2's test file.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `src/util/configHelpers.test.js`:

```js
describe('mergeConfig listingFields — the brand-only boundary', () => {
  const hostedColorField = {
    key: 'color',
    scope: 'public',
    schemaType: 'multi-enum',
    enumOptions: [{ option: 'av-test-color', label: 'AV Test Color' }],
  };

  it('ignores Console options for color', () => {
    const merged = mergeConfig(hostedConfig([hostedColorField]), defaultConfig);
    const color = merged.listing.listingFields.find(field => field.key === 'color');

    expect(color.enumOptions).not.toContainEqual({
      option: 'av-test-color',
      label: 'AV Test Color',
    });
    expect(color.enumOptions).toContainEqual({ option: 'rojo', label: 'Rojo' });
  });

  it('ignores Console options for all_sizes', () => {
    const merged = mergeConfig(
      hostedConfig([
        {
          key: 'all_sizes',
          scope: 'public',
          schemaType: 'multi-enum',
          enumOptions: [{ option: 'av-test-size', label: 'AV Test Size' }],
        },
      ]),
      defaultConfig
    );
    const sizes = merged.listing.listingFields.find(field => field.key === 'all_sizes');

    expect(sizes.enumOptions).not.toContainEqual({
      option: 'av-test-size',
      label: 'AV Test Size',
    });
  });
});
```

Append to the existing `describe('findBrandOption', ...)` block in `src/extensions/searchFilters/avBrandSearch.test.js` (the file already defines a module-level `listingFields` fixture; these two tests build their own merged config instead):

```js
  it('resolves a brand that only Console defines, once merged', () => {
    const merged = mergeHostedBrandOptions(
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'other', label: 'Otra...' }],
        },
      ],
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'av-test-brand', label: 'AV Test Brand' }],
        },
      ]
    );

    expect(findBrandOption('av test brand', merged)).toEqual('av-test-brand');
  });

  it('resolves a Console-relabelled brand by its Console label', () => {
    const merged = mergeHostedBrandOptions(
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'zara', label: 'Zara' }],
        },
      ],
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'zara', label: 'ZARA Espana' }],
        },
      ]
    );

    expect(findBrandOption('zara espana', merged)).toEqual('zara');
  });
```

Add the import at the top of `avBrandSearch.test.js`, after the existing `./avBrandSearch` import:

```js
import { mergeHostedBrandOptions } from '../../config/configAV';
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `CI=true yarn test -- --watchAll=false --testPathPattern="configHelpers|avBrandSearch"`

Expected: PASS. Unlike Tasks 1 and 2 these are regression guards, not red-then-green tests — they describe behaviour Tasks 1 and 2 should already produce. **A failure here means Task 1 or Task 2 is wrong; fix the implementation, not the test.** In particular, a failing "ignores Console options for color" means the merge is not scoped to `brand`.

- [ ] **Step 3: Commit**

```bash
git add src/util/configHelpers.test.js src/extensions/searchFilters/avBrandSearch.test.js
git commit -m "test(brand): pin the brand-only boundary and the search path

Console options for color and all_sizes must still be ignored, and a
Console-only brand must be resolvable from the search box."
```

---

### Task 4: Full suite, then documentation

**Files:**
- Modify: `CLAUDE.md` (the `configAV.js` bullet, and the `util/configHelpers.js` watchlist row)
- Modify: `docs/superpowers/specs/2026-08-28-brand-options-console-merge-design.md` (status line)

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: nothing.

- [ ] **Step 1: Run the full test suite**

Run: `CI=true yarn test -- --watchAll=false`

Expected: PASS, with **no snapshot changes**. The sort comparator was measured to be a no-op over the current 625-option code list, so with an absent or empty Console brand field the rendered brand list is identical to today's. A changed snapshot means the implementation is wrong — most likely `numeric: true` crept into the comparator, or `other` is not pinned. **Do not run `yarn test -u`.**

- [ ] **Step 2: Check formatting**

Run: `yarn format-ci`

Expected: PASS. If it fails on a file this change touched, run `yarn format` and re-check. If it fails only on files this change did not touch, leave them alone — see the `prettier-baseline-stale` note in project memory.

- [ ] **Step 3: Confirm the upstream diff is one line**

Run: `git fetch upstream && git diff upstream/main --stat -- src/util/configHelpers.js`

Expected: `configHelpers.js` appears with a small line count. Then run `git diff upstream/main -- src/util/configHelpers.js` and confirm this change contributed only the import addition, the `mergeHostedBrandOptions(...)` call, and the added comment — no reformatting or reordering of surrounding upstream code.

- [ ] **Step 4: Update `CLAUDE.md`**

In the `configAV.js` bullet under **Config** (around line 96), append to the list of what `configAV.js` owns, before the closing sentence about the four gates:

```
`brandFieldKey`/`mergeHostedBrandOptions()` (folds the Console `brand` field's
`enumOptions` into the code-defined field from `configListingAV.js` before
`configHelpers`' field-level union discards them — Console wins per option, the
field's own config stays code-owned, result sorted by label with `other` first;
`brand` only, `color`/`all_sizes` are untouched);
```

In the Watchlist table, the `util/configHelpers.js` row currently reads:

```
| `util/configHelpers.js` | Listing field merge (code wins over Console) |
```

Change it to:

```
| `util/configHelpers.js` | Listing field merge (code wins over Console, except `brand` options — `configAV.mergeHostedBrandOptions`) |
```

- [ ] **Step 5: Mark the spec implemented**

In `docs/superpowers/specs/2026-08-28-brand-options-console-merge-design.md`, change the `**Status:**` line to:

```
**Status:** Implemented
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-08-28-brand-options-console-merge-design.md
git commit -m "docs(brand): record the Console brand option merge

configAV now owns mergeHostedBrandOptions; correct the configHelpers
watchlist row, which claimed code wins over Console unconditionally."
```

---

## Operator follow-up (not code)

Once this ships, the Console `brand` field becomes the place to add a brand. Two things an operator needs to know, and neither is enforced by code:

- The Console option's **key** is what gets stored on the listing and what `?pub_brand=` matches. Use the same slug style as the code list (lowercase, hyphenated, accents folded — `zadig-voltaire`, not `Zadig & Voltaire`).
- Console's **label** wins over the code label for an option key that exists in both. That is the supported way to rename a brand without a deploy.

## Known issues deliberately left open

Both are pre-existing and out of scope for this plan; they are recorded in the spec.

- `server/api/bulk-import/csvParser.js` does not validate or slugify the `Marca` column, so `Marca: Gucci` stores `brand: "Gucci"`. The listing page renders that via `enumLabel`'s raw-value fallback, but its `?pub_brand=Gucci` link never matches the `gucci` slug. Merging options changes nothing here either way.
- Console's `brand` field config (`filterConfig`, `showConfig`, `saveConfig`) is still discarded — only its options are read. An operator editing the field's label in Console will see no effect.
