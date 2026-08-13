# Removed pricing-plan component reference

Status: removed from the active application on 2026-08-13. This is a future-use design record, not
an implementation or deployment task.

The former feature displayed plan cards with an optional two-state toggle on Sharetribe CMS pages.
It was unrelated to listing prices, original prices, seller earnings, checkout totals, Stripe, and
eShip pricing; those active marketplace features remain unchanged.

## Former behavior

The shared `PricingToggle` component accepted two props:

- `plans`: an object with `set1` and `set2` arrays;
- `toggles`: optional `cta1` and `cta2` labels.

It selected `set1` initially. Toggle buttons were hidden when both labels were empty. Each active
plan rendered a title, description, price, price-period text, CTA link, and checklist. The layout
used two columns, a five-pixel secondary-color border, the shared PageBuilder primary/secondary CTA
styles, and a check icon for every feature.

The former hosted-data contract was:

```json
{
  "toggles": {
    "cta1": "Monthly",
    "cta2": "Annual"
  },
  "plans": {
    "set1": [
      {
        "title": "Plan name",
        "description": "Short description",
        "price": "$29",
        "priceText": "per month",
        "cta": {
          "link": "/signup?plan=basic",
          "text": "Get started"
        },
        "features": ["Feature A", "Feature B"]
      }
    ],
    "set2": []
  }
}
```

## Removed integration points

The removal deleted:

- `src/components/PricingToggle/`;
- `SectionPriceSelector` and the CMS section type `price-columns`;
- `BlockPriceSelector` and the custom block type `blockPriceSelector`;
- the special section ID `av-price-selector`;
- the `content/pricing-plans.json` fetch and `state.CMSPage.pricingPlansData`;
- the translation fallback builder and its `#!#` feature delimiter; and
- component, section, and block tests plus current operator/deployment instructions.

No `PricingToggle.*` keys existed in the checked-in translation JSON files at removal time. If Test
or Live Console contains those keys, or a `content/pricing-plans.json` asset, they are unused and
may be deleted after confirming that no unrelated external client consumes them. Existing CMS pages
must also remove any `price-columns`, `av-price-selector`, or `blockPriceSelector` configuration;
the application no longer registers those types.

## If the feature is requested again

Treat restoration as a new, approved feature:

1. Confirm the current product requirements, page scope, billing terminology, CTA destinations,
   mobile layout, and accessibility behavior.
2. Prefer one hosted JSON asset as the content source; do not restore parallel translation-string
   fallbacks.
3. Recreate a shared card/toggle component and register only the section or block variants actually
   needed.
4. Validate the asset schema before rendering and handle missing plans, features, or CTA data
   safely.
5. Use `type="button"`, an accessible selected-state pattern, keyboard coverage, and responsive
   single-column cards.
6. Add component interaction tests, PageBuilder registration/transform tests, SSR coverage, and
   operator documentation before enabling the feature in Console.

Git history before the removal contains the exact former React, CSS Module, wrapper, registry,
transform, and test implementations.
