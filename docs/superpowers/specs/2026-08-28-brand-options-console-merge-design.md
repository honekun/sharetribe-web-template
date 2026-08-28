# Merge Console `brand` options into the code-defined brand field

**Date:** 2026-08-28
**Status:** Approved, ready for implementation planning

## Problem

`brand` is defined twice and only one definition is used.

`src/config/configListingAV.js:144` defines a `brand` listing field: `schemaType: 'enum'`,
`indexForSearch: true`, ~600 alphabetised `enumOptions` with `{ option: 'other', label: 'Otra...' }`
pinned first.

A `brand` listing field also exists in the Sharetribe Console. It is currently ignored, because
`mergeListingConfig` in `src/util/configHelpers.js:1387` merges hosted and code-defined listing
fields at **field** granularity:

```js
const listingFields = moveListingFieldToEnd(
  union(hostedListingFields, defaultListingFields, 'key'),
  'tags'
);
```

`union` (`configHelpers.js:1359`) keys by `key` and prefers the second array, so the code-defined
`brand` object replaces the hosted one wholesale — config *and* options. Adding a brand therefore
requires a code change and a deploy, even though an operator can already type it into Console.

## Goal

Brands can be added in Console without a deploy, while the code list stays the maintained baseline.

## Decisions

| Question | Decision |
| --- | --- |
| What does Console win? | **Options only.** `enumOptions` from both sources are merged; on the same option key Console's entry (its label) wins. `schemaType`, `filterConfig`, `showConfig`, `saveConfig`, `isRequired` stay code-owned. |
| Which fields? | **`brand` only.** `color` and `all_sizes` keep today's behaviour (code wins wholesale, Console ignored). |
| Ordering | **Re-sort the merged list alphabetically by label**, locale-aware and accent-insensitive, with `other` pinned first. |
| Bulk import | **Out of scope.** The importer is not touched. |

## Design

### Approach

Enrich the code-defined field *before* the union, rather than changing the union.

The precedence we want — "the code field wins, but carries Console's extra options" — is expressed
exactly by handing `union` a code-defined `brand` whose `enumOptions` are already merged.
`configHelpers`' own semantics stay untouched, the AV logic lives in `configAV.js` per the Upstream
File Policy, and the upstream diff stays at the one line that is already AV-modified and already on
the watchlist.

Two alternatives were rejected:

- **Resolver callback on `union`.** `union` is also used for `userTypes` and `userFields`; widening
  its signature widens the AV footprint in an upstream function AV does not otherwise own.
- **Merge at each consumer.** Four call sites to keep in sync, each needing the hosted config
  threaded in.

### New helper — `src/config/configAV.js`

```js
export const brandFieldKey = 'brand';

export const mergeHostedBrandOptions = (defaultListingFields, hostedListingFields) => { ... };
```

Returns `defaultListingFields` with the `brand` entry's `enumOptions` replaced by the merged list.

Behaviour, in order:

1. **Identity guards.** If either argument is not an array, or `brand` is absent from either, or the
   hosted `brand` field's `enumOptions` is not a non-empty array, return `defaultListingFields`
   unchanged (the same reference — no new array).
2. **Merge.** Key options by `String(option)`. The code list seeds the map; the hosted list is
   applied second, so a Console entry overwrites the code entry on collision, taking its label with
   it.
3. **Sanitize.** Drop any entry whose `option` or `label` is not a string. This is load-bearing, not
   defensive polish — see Failure modes below.
4. **Sort.** `localeCompare(a.label, b.label, 'es', { sensitivity: 'base', numeric: true })`, then
   move `other` to the front.
5. **Return** a new array. Never mutate `avListingFields` or either input.

### Call site — `src/util/configHelpers.js:1387`

```js
const listingFields = moveListingFieldToEnd(
  union(hostedListingFields, mergeHostedBrandOptions(defaultListingFields, hostedListingFields), 'key'),
  'tags'
);
```

One line changed, in a file already carrying AV code for exactly this merge.

### Data flow

Every consumer reads the merged `config.listing.listingFields` via `useConfiguration()`, so no other
file changes:

| Consumer | Effect |
| --- | --- |
| `EditListingDetailsForm` → `FieldSearchableSelect` (`configListingDisplay.js:89`) | Console-only brands become selectable when creating a listing. |
| `SearchPage` `brand` filter | Console-only brands appear as filter options. |
| `AVListingDetails.js:113`, `CustomListingFields` | A listing stored with a Console-only brand resolves to its label instead of falling back to the raw slug. |
| `extensions/searchFilters/avBrandSearch.js:49` | Reads `brand.enumOptions` off the merged config, so a Console-added brand becomes typeable in the search box immediately. This is the largest win and needs no change of its own. |

### Failure modes

Every failure degrades to today's behaviour rather than to a broken one.

| Condition | Result |
| --- | --- |
| Hosted asset not loaded yet (SSR before assets resolve) | Guard 1 returns the code list unchanged. |
| Console `brand` field deleted or renamed | Guard 1; code list unchanged. |
| Console `brand` has a non-enum `schemaType`, or no options | Guard 1; code list unchanged. |
| A Console option has a non-string `option` or `label` | Guard 3 drops that entry. **Without it the whole field is lost:** `validSchemaOptions` (`configHelpers.js:511`) requires every entry to have string `option` *and* `label`; one bad entry makes the field invalid, and `validListingFields` (`configHelpers.js:898-902`) then drops `brand` from the config entirely — no filter, no wizard input, no label anywhere. |
| A listing holds a brand value in neither list | Unchanged: `enumLabel` (`AVListingDetails.js:13`) falls back to the raw value. |

### Known issues left open

Both are pre-existing and explicitly out of scope.

- **Bulk import writes raw labels.** `server/api/bulk-import/csvParser.js` passes the `Marca` cell
  through unvalidated, so `Marca: Gucci` stores `brand: "Gucci"`. That never matches the slug
  `gucci` used by `?pub_brand=` links and the search filter, so the listing renders the brand as
  text but is unreachable through brand navigation. Merging options does not change this either
  way, and Console-only brands import fine precisely because nothing is validated.
- **Console's `brand` field config stays ignored.** Only its options are read; its
  `filterConfig`/`showConfig`/`saveConfig` continue to be discarded by the field-level union. An
  operator changing the field's label in Console will see no effect.

## Testing

- **`src/config/configAV.test.js`** — collision keeps Console's label; Console-only option added;
  code-only option kept; result sorted alphabetically; `other` pinned first; each identity guard
  (non-array input, `brand` absent from either side, empty/absent hosted `enumOptions`) returns the
  input unchanged; a non-string `option` and a non-string `label` are each dropped; neither input
  array is mutated.
- **`configHelpers` integration** — hosted `brand` plus code `brand` produce the merged option set
  through `mergeConfig`; `color` and `all_sizes` still resolve to the code definition wholesale,
  pinning the "brand only" boundary.
- **`extensions/searchFilters/avBrandSearch.test.js`** — a Console-only brand resolves to
  `pub_brand`.
- **Full suite** (`yarn test -- --watchAll=false`). Re-sorting changes the existing list's order
  even with an empty Console field: entries such as `& Other Stories`, `1.STATE`, `1/8 Takamura`,
  `525` and `7 For All Mankind` sort differently under `localeCompare` with `numeric: true` than in
  the hand-authored order. Snapshots covering the brand list will need regenerating, and the run is
  what tells us which.

## Files touched

| File | Change |
| --- | --- |
| `src/config/configAV.js` | New `brandFieldKey` + `mergeHostedBrandOptions`. |
| `src/config/configAV.test.js` | Unit tests for the helper. |
| `src/util/configHelpers.js` | One line at 1387: wrap `defaultListingFields`. |
| `CLAUDE.md` | Update the `configAV.js` summary and the `util/configHelpers.js` watchlist row, which currently reads "code wins over Console". |
