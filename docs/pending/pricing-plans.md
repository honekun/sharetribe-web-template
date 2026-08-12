# Pricing plans hosted asset

Status: pending Console configuration and fallback cleanup.

`CMSPage.duck.js` requests `content/pricing-plans.json`. Until that asset exists in each Sharetribe
environment, the pricing section uses application translation fallbacks.

## Publish the asset

In **Sharetribe Console → Content → Assets**, create `content/pricing-plans.json`:

```json
{
  "toggles": {
    "cta1": "Monthly",
    "cta2": "Annual"
  },
  "plans": {
    "set1": [
      {
        "title": "Plan Name",
        "description": "Short description",
        "price": "$29",
        "priceText": "per month",
        "cta": { "link": "/signup?plan=basic", "text": "Get Started" },
        "features": ["Feature A", "Feature B", "Feature C"]
      }
    ],
    "set2": [
      {
        "title": "Plan Name (Annual)",
        "description": "Short description",
        "price": "$290",
        "priceText": "per year",
        "cta": { "link": "/signup?plan=basic-annual", "text": "Get Started" },
        "features": ["Feature A", "Feature B", "Feature C"]
      }
    ]
  }
}
```

- A set may contain any number of plans.
- `features` is an array of strings.
- An empty `cta1` or `cta2` hides that toggle.
- Publish and verify the asset separately in Test and Live.

## Acceptance checklist

- [ ] Publish the asset in the Sharetribe Test environment.
- [ ] Verify `SectionPriceSelector` and `PricingToggle` render the hosted values and both toggles.
- [ ] Publish the approved asset in the Live environment.
- [ ] Remove `buildPlanFromIntl` and `buildPricingFromIntl` from
      `src/extensions/pageBuilder/av/transform.js`.
- [ ] Remove `FEATURE_DELIMITER` from `src/extensions/pageBuilder/av/constants.js`.
- [ ] Confirm whether any `PricingToggle.*` keys exist only in hosted Console translations; remove
      those hosted fallbacks after both environments use the asset. No such keys are checked into
      the repository today.
- [ ] Update the [operator guide](../operator-guide.md#411-pricing-plans-price-columns) so operators
      no longer need to account for the fallback.

Use the [hosted-assets reference](../reference/hosted-assets.md) to inspect published asset data.
