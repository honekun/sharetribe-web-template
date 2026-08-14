# Sharetribe Asset Delivery API (hosted config endpoints)

Quick reference for reading the marketplace's **hosted configuration** (categories, listing fields
and their select/multiselect options, listing types, user fields, branding, etc.) directly from
Sharetribe's public CDN — no auth, no SDK required.

This is how you get, for example, the real `categoryLevel1/2/3` ids used by
`src/config/configAVShipping.js` (`categoryPackageSizeMap`) or the `enumOptions` for an
`enum`/`multi-enum` listing field.

> Hosted data is not authoritative for the code-owned `color`, `all_sizes`, and `brand` listing
> fields. `src/config/configListing.js` intentionally overrides hosted fields with those keys, so
> inspect or change their local definitions instead. Hosted field options remain authoritative for
> the other Console-managed listing fields.

## Endpoint

Public CDN (Asset Delivery API). Only the **public** SDK client id is needed
(`REACT_APP_SHARETRIBE_SDK_CLIENT_ID`; safe to expose).

```
# Latest published version (by alias):
https://cdn.st-api.com/v1/assets/pub/{CLIENT_ID}/a/latest/{ASSET_PATH}

# A specific version (by version hash, from a previous response's meta):
https://cdn.st-api.com/v1/assets/pub/{CLIENT_ID}/v/{VERSION}/{ASSET_PATH}
```

`{ASSET_PATH}` is the path from `appCdnAssets` in `src/config/configDefault.js` **without** the
leading slash (e.g. `listings/listing-categories.json`).

Every response is wrapped as `{ "data": { ... } }`.

### In-app equivalent

The app fetches the same assets via the SDK (`src/ducks/hostedAssets.duck.js`):

```js
sdk.assetByAlias({ path: '/listings/listing-categories.json', alias: 'latest' });
```

The path list lives in `configDefault.js` → `appCdnAssets`, fetched on boot in `src/index.js` via
`fetchAppAssets(...)`, then merged into the runtime config by `src/util/configHelpers.js`.

## Asset paths (from `configDefault.js` → `appCdnAssets`)

| Asset              | Path                                         | What it contains                                           |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------- |
| **Categories**     | `listings/listing-categories.json`           | Nested category tree (ids + names)                         |
| **Listing fields** | `listings/listing-fields.json`               | Custom listing fields incl. **select/multiselect options** |
| **Listing types**  | `listings/listing-types.json`                | Listing types + transaction process aliases                |
| **Listing search** | `listings/listing-search.json`               | Search/filter config                                       |
| **User fields**    | `users/user-fields.json`                     | Custom user (profile) fields incl. enumOptions             |
| **User types**     | `users/user-types.json`                      | User types                                                 |
| Translations       | `content/translations.json`                  | Hosted translation overrides                               |
| Footer             | `content/footer.json`                        | Footer content                                             |
| Top bar            | `content/top-bar.json`                       | Topbar/nav content                                         |
| Branding           | `design/branding.json`                       | Brand colors, logos, images                                |
| Layout             | `design/layout.json`                         | Layout variants                                            |
| Localization       | `general/localization.json`                  | Locale + first day of week                                 |
| Access control     | `general/access-control.json`                | Private-marketplace settings                               |
| Commission         | `transactions/commission.json`               | Provider/customer commission                               |
| Min tx size        | `transactions/minimum-transaction-size.json` | Listing minimum price                                      |
| Analytics          | `integrations/analytics.json`                | GA id, etc.                                                |
| Maps               | `integrations/map.json`                      | Map provider config                                        |

(CMS/landing pages are separate content assets, e.g. `content/pages/<slug>.json`.)

## Recipes

Set the client id once:

```sh
CID=$(grep REACT_APP_SHARETRIBE_SDK_CLIENT_ID .env | cut -d= -f2)
BASE="https://cdn.st-api.com/v1/assets/pub/$CID/a/latest"
```

### Get all categories (ids + names, nested)

```sh
curl -s "$BASE/listings/listing-categories.json" \
  | python3 -c "import sys,json
def walk(cs,d=0):
  for c in cs:
    print('  '*d + c['id'] + '  —  ' + c['name'])
    walk(c.get('subcategories',[]),d+1)
walk(json.load(sys.stdin)['data']['categories'])"
```

Category node shape: `{ "id": "ropa-tops", "name": "Tops", "subcategories": [...] }`. A listing
stores its chosen path as `publicData.categoryLevel1/2/3` (the ids).

### Get listing fields + their select/multiselect options

```sh
curl -s "$BASE/listings/listing-fields.json" \
  | python3 -c "import sys,json
for f in json.load(sys.stdin)['data']['listingFields']:
  opts = f.get('enumOptions')
  print(f\"{f['key']}  [{f['schemaType']}]\" + (('  -> ' + ', '.join(o['option'] for o in opts)) if opts else ''))"
```

Field shape:

```json
{
  "key": "genero",
  "label": "Género",
  "scope": "public",
  "schemaType": "enum",                 // enum | multi-enum | long | boolean | text
  "enumOptions": [
    { "option": "hombre", "label": "Hombre" },
    { "option": "mujer",  "label": "Mujer"  }
  ],
  "saveConfig": { ... },
  "filterConfig": { ... }
}
```

- **Select** (single) → `schemaType: "enum"`; **multiselect** → `schemaType: "multi-enum"`.
- Each option is `{ option, label }` — `option` is the stored value (e.g.
  `publicData.genero = "mujer"`), `label` is the display text.
- ⚠️ A listing field whose `key` is `color`, `all_sizes`, or `brand` is replaced by the complete
  local object from `src/config/configListing.js`/`configListingDisplay.js`. For those keys, hosted
  `enumOptions` do **not** define the valid values; use the code-owned lists documented in the
  operator guide.

### User (profile) fields + options

```sh
curl -s "$BASE/users/user-fields.json" | python3 -m json.tool | head -60
```

Same shape as listing fields (this is where e.g. `tipoTienda` options live — see
`configAV.getStoreTypeTags`).

## Notes

- **No auth**: published assets are world-readable via the CDN; only the public client id is
  required. Do not use any secret/Integration credentials here.
- **`a/latest` vs `v/{version}`**: `latest` always returns the current published config. Responses
  include version metadata you can pin with `v/{version}` for reproducibility.
- **Server-side**: `server/api-util/sdk.js` + `sdkCacheProxy.js` cache `sdk.assetByAlias` for ~1h;
  prefer the SDK in app code. Use the raw curl endpoints above for one-off inspection / scripts /
  populating config maps.
- **404?** Check the path has no leading slash after `a/latest/` and matches an entry in
  `appCdnAssets`.
