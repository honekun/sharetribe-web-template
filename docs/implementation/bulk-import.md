# Bulk Listing ZIP Importer

Tool for creating multiple marketplace listings at once from a single ZIP file containing a CSV and
all required images. Available at `/admin/bulk-import`.

Any signed-in user can bulk-import listings **for themselves** — every listing is created with the
current user as its author. "Admin" users (emails listed in `BULK_IMPORT_OPERATOR_EMAILS`) may add a
`user_id` column to the CSV to create listings on behalf of other users.

---

## Quick Start

1. **Set environment variables** (see [Environment Variables](#environment-variables))
2. Start the dev server: `yarn run dev`
3. Navigate to `/admin/bulk-import`
4. Sign in (any user able to create listings); listings will be authored to you
5. Open the template (the page links it in Google Drive), download a copy from there, fill it in
6. Pack your completed CSV and all image files into a single `.zip` archive
7. Select the ZIP file and click "Start Import", then monitor progress

---

## Architecture

```
Browser (BulkImportPage)             Server (Express)
  |                                    |
  |-- Current session --------------> POST /api/bulk-import/authorize
  |                                    |-- Verify Sharetribe session (any signed-in user)
  |                                    |-- Return short-lived action token + isAdmin flag
  |                                    |
  |-- FormData(zipFile) -----------> POST /api/bulk-import/start
  |                                    |-- Verify session + X-Bulk-Import-Token
  |                                    |-- Extract & validate ZIP (zipExtractor)
  |                                    |-- Parse CSV, validate rows
  |                                    |-- Start async worker
  |                                    |-- Return { jobId } (HTTP 202)
  |                                    |
  |-- Poll every 2s ----------------> GET /api/bulk-import/status/:jobId
  |                                    |-- Return progress, results, errors
  |                                    |
```

Note the page does **not** call `GET /api/bulk-import/template`. That endpoint still exists and
still generates a CSV — headers plus one example row (`server/api/bulk-import/index.js`) — but
nothing links to it at runtime: the template button points at Google Drive (see
[below](#example-csv)) and previously pointed at a static file. It is left routed because it is
public, tested, and harmless, but treat it as orphaned rather than as the template source of
record.

Processing is **asynchronous** so uploads do not depend on a hosting platform's HTTP request
timeout. The server accepts the upload, returns a job ID immediately, and processes rows in the
background. The client polls for status updates.

### Worker Flow (per CSV row, sequential)

1. Upload images in slot order (`front` → `back` → `horizontal` → `details`) via Integration SDK
   `images.upload()`
2. Create listing via Integration SDK `listings.create()` with author relationship
3. Set stock via Integration SDK `stock.compareAndSet()` (only when `stock > 0`)
4. Publish listing via Integration SDK `listings.open()` (only when `publish` column is `yes`)
5. 500ms delay before next row (rate limiting)

Rows are processed sequentially. If a row fails, the error is recorded and processing continues with
the next row.

---

## ZIP File Structure

The uploaded ZIP must contain exactly one CSV file and all image files referenced by that CSV.
Images may be placed in subdirectories — they are matched by filename only (basename), not by path.

### Example layout

```
listings.zip
├── listings.csv          # The one required CSV (any name, any depth)
├── front_dress.jpg
├── back_dress.jpg
├── photos/
│   ├── jacket_front.jpg
│   ├── jacket_back.jpg
│   └── jacket_horizontal.jpg
└── details/
    └── jacket_details.jpg
```

### ZIP validation rules

The server validates the ZIP before starting any import. All checks run synchronously and return
HTTP 400 if they fail.

| Rule                   | Requirement                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Valid archive          | File must be a valid `.zip` format                                                                                  |
| Exactly one CSV        | ZIP must contain exactly one `.csv` file (case-insensitive extension)                                               |
| Unique image basenames | Two images cannot share the same filename even in different directories                                             |
| No path traversal      | Entry names must not contain `..` as a path segment (e.g. `../../etc/passwd`)                                       |
| Entry count            | Maximum 401 entries total (1 CSV + 400 images)                                                                      |
| Non-empty CSV          | The CSV file inside the ZIP cannot be zero bytes                                                                    |
| Image magic bytes      | Each image's bytes must match its extension (JPEG/PNG/WebP) — renamed non-images are rejected (`imageValidator.js`) |
| Max ZIP size           | 50 MB compressed upload (hard ceiling; smaller per-tier caps apply — see [Limits](#limits))                         |

macOS `__MACOSX/` metadata directories and `._` resource fork files are silently ignored.

In addition to these archive-level checks, **per-user tiered limits** (ZIP size, image count, row
count, imports-per-hour) are enforced after authentication — see [Limits](#limits).

---

## Environment Variables

| Variable                               | Required | Description                                                                                                                                                                                    |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BULK_IMPORT_OPERATOR_EMAILS`          | No       | Comma-separated emails of "admin" users. Admins may set a CSV `user_id` column to author listings on behalf of other users. Not an access gate — any signed-in user can import for themselves. |
| `BULK_IMPORT_LISTING_TYPE`             | No       | Listing type identifier. Default: `product-selling`                                                                                                                                            |
| `BULK_IMPORT_TRANSACTION_ALIAS`        | No       | Transaction process alias. Default: `default-purchase/release-1`                                                                                                                               |
| `BULK_IMPORT_UNIT_TYPE`                | No       | Unit type for pricing. Default: `item`                                                                                                                                                         |
| `SHARETRIBE_INTEGRATION_CLIENT_ID`     | Yes      | Sharetribe Integration API client ID (shared with AV-noti event poller).                                                                                                                       |
| `SHARETRIBE_INTEGRATION_CLIENT_SECRET` | Yes      | Sharetribe Integration API client secret.                                                                                                                                                      |

Add these to `.env.development` for local development and to Heroku/Render config vars for deployed
environments.

### Example `.env.development` additions

```sh
# Optional: emails of admin users who may set a CSV `user_id` column.
BULK_IMPORT_OPERATOR_EMAILS=admin@example.com
BULK_IMPORT_LISTING_TYPE=product-selling
BULK_IMPORT_TRANSACTION_ALIAS=default-purchase/release-1
BULK_IMPORT_UNIT_TYPE=item
```

---

## CSV Format

### Required Columns

| Column        | Type   | Description                                                                                                                                                                                                                                         |
| ------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | string | Listing title. Cannot be empty.                                                                                                                                                                                                                     |
| `description` | string | Listing description. Cannot be empty.                                                                                                                                                                                                               |
| `price`       | number | Price in major currency units (e.g., `450.00` for 450 MXN). Must be positive. A leading currency token and thousands separators are stripped automatically, so `$4,500.00` → `4500` and `$99.50` → `99.5` (the remaining `.` is the decimal point). |

### Optional Core Columns

| Column             | Type             | Default      | Description                                                                                                                                                                                        |
| ------------------ | ---------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`          | UUID string      | current user | Admin-only. Sharetribe user UUID to author the listing on behalf of. Ignored (and rejected) for non-admin uploads; everyone else authors to themselves. `author_id` is accepted as a legacy alias. |
| `currency`         | string           | `MXN`        | ISO 4217 currency code.                                                                                                                                                                            |
| `publish`          | `yes` / `no`     | `yes`        | Publish immediately or leave as closed.                                                                                                                                                            |
| `shipping_enabled` | `true` / `false` | `true`       | Enable shipping delivery.                                                                                                                                                                          |
| `pickup_enabled`   | `true` / `false` | `false`      | Enable pickup delivery.                                                                                                                                                                            |
| `location_address` | string           | _(empty)_    | Human-readable address.                                                                                                                                                                            |
| `location_lat`     | number           | _(empty)_    | Latitude for geolocation.                                                                                                                                                                          |
| `location_lng`     | number           | _(empty)_    | Longitude for geolocation.                                                                                                                                                                         |

> **No `stock` column.** `av-listing` uses `stockType: oneItem` (each listing is a unique single
> item). Stock is always set to 1 automatically.

### Image Columns

The current template numbers the four labeled slots `imagen_1`–`imagen_4`. The legacy
`image_front`/`image_back`/`image_horizontal`/`image_details` headers are also accepted.

| Column                          | Slot       | Description                                       |
| ------------------------------- | ---------- | ------------------------------------------------- |
| `imagen_1` (`image_front`)      | Front      | Filename of the front image. Required.            |
| `imagen_2` (`image_back`)       | Back       | Filename of the back image. Required.             |
| `imagen_3` (`image_horizontal`) | Horizontal | Filename of the horizontal/wide image. Required.  |
| `imagen_4` (`image_details`)    | Details    | Filename of the details/close-up image. Optional. |

Image filenames must exactly match the basenames of image files inside the ZIP (case-sensitive, path
is ignored). Every row must define the front, back, and horizontal images. These map to the
`publicData.imageSlots` system used by the listing detail page.

### Extended Data Columns (`pub_*`)

Any column prefixed with `pub_` (or the legacy `pd_`) is stored in listing `publicData`. The prefix
is stripped to form the key (e.g. `pub_brand` → `brand`):

| CSV Column           | publicData Key   | Required | Example Value           | Notes                                                                                                                                          |
| -------------------- | ---------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pub_categoryLevel1` | `categoryLevel1` | Yes      | `ropa`                  | Console category key                                                                                                                           |
| `pub_categoryLevel2` | `categoryLevel2` | Yes      | `ropa-vestidos`         | Console category key                                                                                                                           |
| `pub_categoryLevel3` | `categoryLevel3` | No       | `ropa-vestidos-midi`    | Optional sub-category                                                                                                                          |
| `pub_color`          | `color`          | Yes      | `azul` or `azul\|negro` | **Multi-enum.** One or more option keys, pipe-separated. Always stored as an array.                                                            |
| `pub_all_sizes`      | `all_sizes`      | Yes      | `s\|m\|l`               | **Multi-enum.** Valid keys: `xs`, `s`, `m`, `l`, `xl`, `mx_32`, `mx_shoes_24x`, `curvy_2x`, etc.                                               |
| `pub_brand`          | `brand`          | Yes      | `levi-s`                | Option **slug** — not the display name (use `levi-s`, not `Levi's`)                                                                            |
| `pub_genero`         | `genero`         | Yes      | `mujer`                 | Options: `hombre`, `mujer`, `unisex`                                                                                                           |
| `pub_estado`         | `estado`         | Yes      | `como-nuevo`            | Options: `nuevo-sin-etiqueta`, `nuevo-con-etiqueta`, `como-nuevo`, `buen-estado`, `usado`                                                      |
| `pub_estilo`         | `estilo`         | Yes      | `vintage`               | **Multi-enum.** Options: `vintage`, `urbano_streetwear`, `fiesta_noche`, `formal`, `casual`, `boho`, `retro`, `oficina`, `vacaciones`, `seda`  |
| `pub_temporada`      | `temporada`      | No       | `invierno`              | Season slug (`primavera`/`verano`/`otono`/`invierno`/`todo-el-ano`). Saved as public data but **not** currently a configured/searchable field. |
| `pub_originalPrice`  | `originalPrice`  | No       | `650.00`                | Strike-through "was" price in major currency units. Must be > `price` to display. Converted to `{ amount, currency }` automatically.           |

**Multi-enum fields** (`color`, `all_sizes`, `estilo`): pipe-separated values become arrays — e.g.
`azul|negro` → `["azul", "negro"]`. A single value (e.g. `azul`) is also stored as an array
`["azul"]`. The Sharetribe API requires arrays for multi-enum fields.

**Option keys vs labels**: All enum/multi-enum fields require the Console option **key** — not the
display label. E.g. `azul` not `Azul`; `levi-s` not `Levi's`.

The publicData keys must match the field keys configured in Sharetribe Console → Build → Listing
fields.

### Automatic package size

The importer does not require or trust an `avPackageSize` CSV column. Before creating each listing,
it derives and persists `publicData.avPackageSize` from `pub_categoryLevel1`, `pub_categoryLevel2`,
and `pub_categoryLevel3` using the rules in
[`docs/data/categoria-paquete.csv`](../data/categoria-paquete.csv). Categories without an S/L
exception use the default package size `M`.

### Example CSV

This is the current seller-template format: `pub_*` attribute columns and `imagen_1..4`, with no
author column (listings author to the signed-in user). Admins who need to import for another seller
add a `user_id` column.

```csv
title,description,price,pub_brand,pub_categoryLevel1,pub_categoryLevel2,pub_categoryLevel3,pub_color,pub_all_sizes,pub_genero,pub_estado,pub_estilo,pub_temporada,imagen_1,imagen_2,imagen_3,imagen_4
"Vestido Vintage Años 80","Hermoso vestido vintage",450.00,zara,ropa,ropa-vestidos,ropa-vestidos-midi,rosa|crema,s|m,mujer,como-nuevo,vintage,otono,vestido-1.jpg,vestido-2.jpg,vestido-3.jpg,
"Jeans Levi's Retro","Jeans de los 90s en buen estado","$950.00",levi-s,ropa,ropa-jeans,ropa-jeans-momfit,azul,mx_28,unisex,buen-estado,retro,todo-el-ano,jeans-1.jpg,jeans-2.jpg,jeans-3.jpg,
```

The template link on the import page opens the seller template in Google Drive
(`https://drive.google.com/file/d/1pucBkweZnTQVy4-91CN0HBvDiANbZDXc/view?usp=sharing`, hardcoded in
`BulkImportPage.js`), in a new tab. Hosting it there rather than in `public/static/files` means a
corrected template reaches operators without a deploy — the trade is that the link now lands on
Drive's preview page and the operator uses Drive's own download control, rather than the file
arriving directly. The link therefore carries `target="_blank"` and no `download` attribute: that
attribute is ignored on a cross-origin href.

The file must stay shared as "anyone with the link"; if it is un-shared or removed, the control
silently leads to a Drive permission wall and nothing in the app will report it.

Nothing links to `public/static/files/PLANTILLA_CARGA_MASIVA.csv` at runtime any more — not the
page, not `docs/operator-guide.md`. It is still *named* in several places, which is why it should not
simply be deleted on sight: `csvParser.js` calls one of its recognised header dialects after it (and
`csvParser.test.js` pins that), `index.js` cites it as what the `/template` endpoint mirrors, and the
column-alias table [below](#google-sheets--spanish-column-names) uses it as a column heading. The
file is kept on disk so an operator holding an old direct link gets a file rather than a 404; retiring
it means renaming that dialect too, not just removing the file.

The import page's help bar also links a ready-to-upload **example ZIP** at
`public/static/files/ZIP_CARGA_MASIVA.zip` (10 listings + 40 images). Its `user_id` column is left
empty so any non-admin can download it and upload as-is (listings author to themselves). The
new-listing wizard (`/l/new`) shows a blue **"Bulk import"** CTA (desktop only) linking to this
page.

### Google Sheets / Spanish Column Names

The importer also accepts the Spanish column names exported by the Archivo Vintach Google Sheets
operator template. Column normalisation runs automatically — operators can export the sheet as CSV
and upload without any manual renaming.

Two Spanish header dialects are recognised (both map to the canonical keys above via
`COLUMN_ALIASES` in `server/api/bulk-import/csvParser.js`):

| Operator CSV template (`PLANTILLA_CARGA_MASIVA.csv`) | Google Sheets export   | Canonical key       |
| ---------------------------------------------------- | ---------------------- | ------------------- |
| `Nombre de Producto*`                                | `Título`               | `title`             |
| `Descripción*`                                       | `Descripción`          | `description`       |
| `Precio Venta (MXN)*`                                | `Precio Venta (mxn)`   | `price`             |
| `Marca*`                                             | `Marca`                | `pd_brand`          |
| `Categoría`                                          | `Categoría`            | `pd_categoryLevel1` |
| `Subcategoría`                                       | `Subcategoría 1`       | `pd_categoryLevel2` |
| `Color`                                              | `Color`                | `pd_color`          |
| `Talla`                                              | `Talla`                | `pd_all_sizes`      |
| `Género*`                                            | `Genero`               | `pd_genero`         |
| `Estado`                                             | `Estado`               | `pd_estado`         |
| `Estilo`                                             | `Estilo`               | `pd_estilo`         |
| `Temporada`                                          | _(n/a)_                | `pd_temporada`      |
| `Nombre imagen 1*`                                   | `Imagen 1: Frontal*`   | `image_front`       |
| `Nombre imagen 2`                                    | `Imagen 2: Posterior*` | `image_back`        |
| `Nombre imagen 3`                                    | `Imagen 3: Detalle*`   | `image_horizontal`  |
| `Nombre imagen 4`                                    | `Imagen 4: opcional`   | `image_details`     |

The table above is the current mapping. Use it and the downloadable template instead of older
operator spreadsheets, which may contain obsolete access rules or filename restrictions.

---

## API Endpoints

All protected endpoints require a signed-in Sharetribe session (any user). Upload and status
requests also require a short-lived `X-Bulk-Import-Token` issued by `/authorize`; this token is kept
in memory by the page and is not persisted in browser storage.

### `POST /api/bulk-import/authorize`

Issues a short-lived action token for any signed-in session. The response includes an `isAdmin` flag
(true when the user's email is in `BULK_IMPORT_OPERATOR_EMAILS`).

**Response** (HTTP 200):

```json
{
  "ok": true,
  "token": "short-lived-token",
  "expiresAt": "2026-05-17T12:00:00.000Z",
  "isAdmin": false
}
```

### `POST /api/bulk-import/start`

Start a new import job.

**Content-Type**: `multipart/form-data`

**Form fields**:

- `zipFile` (file, required) — a `.zip` archive containing one CSV and all referenced images (max 50
  MB compressed)

**Response** (HTTP 202):

```json
{
  "jobId": "a1b2c3d4-...",
  "total": 3,
  "message": "Import started. Poll /api/bulk-import/status/:jobId for progress."
}
```

**Error responses**:

- `400` — No ZIP file uploaded
- `400` — ZIP validation failed (corrupt archive, no CSV, multiple CSVs, duplicate image filenames,
  path traversal, too many entries, empty CSV)
- `400` — CSV validation failed; `details` array lists all per-row and per-column errors (missing
  required columns, empty required fields, invalid price, missing
  `image_front`/`image_back`/`image_horizontal`, image filename not found in ZIP, invalid
  geolocation)
- `400` — A non-admin upload set a `user_id` column (author override is admin-only)
- `400` — Over a per-tier limit (ZIP bytes, image count, or row count exceeds your tier — see
  [Limits](#limits))
- `401` — Missing signed-in session or invalid/expired action token
- `409` — You already have an import in progress (one active job per user)
- `429` — Over the hourly import cap for your tier (3/hour standard, 20/hour admin)
- `503` — Global import capacity is full (max 3 concurrent jobs across all users); retry shortly

### `GET /api/bulk-import/status/:jobId`

Poll import progress. **Owner-scoped:** jobs created by another user return `404` (not `403`), so a
user can never poll or confirm the existence of someone else's import.

**Response** (HTTP 200):

```json
{
  "id": "a1b2c3d4-...",
  "status": "processing",
  "total": 3,
  "processed": 2,
  "succeeded": 1,
  "failed": 1,
  "errors": [{ "row": 3, "title": "Bad Listing", "error": "API error message" }],
  "results": [
    { "row": 2, "title": "Vintage Levi's 501", "listingId": "uuid-...", "status": "published" }
  ]
}
```

**Status values**: `processing`, `completed`, `failed`

Job data expires after **1 hour**.

### `GET /api/bulk-import/template`

Download a sample CSV file. No authentication required.

---

## Limits

Limits are **tiered**. Standard = any signed-in user (imports for themselves); admin = emails in
`BULK_IMPORT_OPERATOR_EMAILS`. The per-tier caps are enforced after authentication in `/start`
(`limits.js`); the ZIP extractor enforces the absolute archive ceilings regardless of tier.

| Limit                | Standard | Admin |
| -------------------- | -------- | ----- |
| Max rows per CSV     | 25       | 100   |
| Max images in ZIP    | 100      | 400   |
| Max ZIP upload size  | 20 MB    | 50 MB |
| Max imports per hour | 3        | 20    |

| Absolute ceiling (all tiers) | Value            |
| ---------------------------- | ---------------- |
| Max ZIP entries              | 401              |
| Multer hard upload cap       | 50 MB compressed |
| Total uncompressed size      | 100 MB           |
| Active jobs per user         | 1 (else 409)     |
| Global concurrent jobs       | 3 (else 503)     |
| Rate between rows            | 500 ms           |
| Job data TTL                 | 1 hour           |

The hourly rate limit (`rateLimiter.js`) is per-user and in-memory (resets on server restart). It is
only consumed when an import actually starts — failed validations do not count against the cap.

Jobs are **owner-scoped**: each job records the `ownerId` of the user who created it. A user may
have only one active import at a time (409), the server caps total concurrent imports at 3 (503),
and polling `/status/:jobId` for a job owned by another user returns 404.

> ⚠️ **Single-dyno assumption.** Owner-scoping, the per-user `409`, the global `503` cap, and the
> hourly `429` limit are all enforced in **in-process memory** — correct on one web dyno, but they
> reset on dyno restart and are not shared across dynos if you scale `web` past 1. See
> [the scaling guide](../operations/scaling.md) for the impact and Redis/worker-dyno remedies.

The extractor rejects more than 100 MB total uncompressed data, but process peak memory also depends
on the compressed upload buffer, extraction copies, image upload concurrency, and other server
traffic. Monitor real dyno memory and size vertically from measured peaks; the implementation does
not guarantee that a particular Heroku dyno class is sufficient.

---

## Using with curl

```sh
# Pack CSV + images into a ZIP, then start an import
zip -j listings.zip listings.csv photos/*.jpg

TOKEN=$(curl -s -X POST http://localhost:3500/api/bulk-import/authorize \
  --cookie "st-session=YOUR_SIGNED_IN_SESSION_COOKIE" | jq -r '.token')

curl -X POST http://localhost:3500/api/bulk-import/start \
  -H "X-Bulk-Import-Token: $TOKEN" \
  --cookie "st-session=YOUR_SIGNED_IN_SESSION_COOKIE" \
  -F "zipFile=@listings.zip"

# Poll for status
curl http://localhost:3500/api/bulk-import/status/JOB_ID_HERE \
  -H "X-Bulk-Import-Token: $TOKEN" \
  --cookie "st-session=YOUR_SIGNED_IN_SESSION_COOKIE"

# Download template
curl -O http://localhost:3500/api/bulk-import/template
```

---

## Implementation map

```
server/
  services/
    integrationSdk.js              # Shared Integration SDK singleton (lazy init, cached)
  api/
    bulk-import/
      index.js                     # Express router (endpoints + auth/limit/rate-limit middleware)
      auth.js                      # Session check (any user) + admin flag (BULK_IMPORT_OPERATOR_EMAILS)
      limits.js                    # Tiered limits (standard vs admin)
      rateLimiter.js               # Per-user rolling-hour import counter
      imageValidator.js            # Magic-byte image sniffing (shared with zipExtractor)
      csvParser.js                 # CSV parsing + validation (parseCsv, validateRows)
      importWorker.js              # Async per-row listing creation (processImportJob)
      jobStore.js                  # In-memory job state (Map + 1hr TTL); per-job ownerId, per-user + global concurrency helpers
      zipExtractor.js              # ZIP extraction + validation (extractZip)
      *.test.js                    # Co-located unit tests (auth/limits/rateLimiter/imageValidator/csvParser/jobStore/importWorker/zipExtractor)

src/
  containers/
    BulkImportPage/
      BulkImportPage.js            # Upload form + progress UI (React, local state only — no Redux duck)
      BulkImportPage.module.css    # Styles
      BulkImportPage.test.js       # Co-located UI tests
```

The feature also connects to these shared files:

- `server/index.js` mounts the `/api/bulk-import` router.
- `src/routing/routeConfiguration.js` registers `/admin/bulk-import`.
- `src/translations/en.json` and `src/translations/es.json` provide the UI strings.

---

## How It Works Internally

### Authentication

The importer uses the normal Sharetribe browser session — any signed-in user is allowed, and
listings default to that user as author. The browser never receives the Integration API credentials
or a long-lived import secret. Before upload, the page requests a short-lived action token from
`/api/bulk-import/authorize`; the token is stored only in React state and sent as
`X-Bulk-Import-Token` on `/start` and `/status/:jobId`. Admin users (email in
`BULK_IMPORT_OPERATOR_EMAILS`) may additionally set a `user_id` column to author on behalf of
others.

### ZIP Extraction

When a ZIP is uploaded, `zipExtractor.js` runs synchronously before any CSV parsing or job creation:

1. Validates the archive is a parseable ZIP
2. Enforces entry count limit (≤ 401)
3. Scans entries — skips directories, `__MACOSX/` metadata, and `._` resource fork files
4. Checks each entry for path traversal segments (`..`)
5. Collects exactly one CSV entry; throws if zero or more than one
6. Checks for duplicate image basenames across all directories
7. Extracts CSV as a `Buffer` and images into a `Map<basename, Buffer>`

The resulting `{ csvBuffer, imageMap }` is passed directly to the existing `parseCsv` /
`validateRows` pipeline.

### Image Upload

Images are uploaded to Sharetribe via the Integration SDK's `images.upload()` method. Each image is
sent as a Node.js Buffer (from the in-memory ZIP extraction). The returned UUID is:

1. Added to the listing's `images` array (controls display order)
2. Saved to `publicData.imageSlots` mapping (e.g., `{ front: "uuid", back: "uuid" }`)

The `imageSlots` mapping is used by the listing detail page (`ListingImageGallery`) to show labeled
captions below each photo.

### Listing Creation

Listings are created via the **Integration SDK** (`integrationSdk.listings.create()`), not the
Marketplace SDK. This allows:

- Creating listings on behalf of any user via the `authorId` parameter
- No per-user authentication required
- Server-to-server communication with higher rate limits

Each listing is created with:

- Core fields: `title`, `description`, `price` (converted to subunits)
- `publicData`: listing type, transaction process, unit type, shipping/pickup, image slots,
  location, and all `pub_*`/`pd_*` extended data fields
- `geolocation`: lat/lng if provided
- Stock set via `stock.compareAndSet()` after creation (skipped when `stock` is 0)
- Published via `listings.open()` if `publish=yes`

### Error Handling

- **ZIP validation errors** are returned synchronously before CSV parsing starts (HTTP 400, single
  `error` string)
- **CSV validation errors** are returned synchronously before processing starts (HTTP 400, `details`
  array)
- **Per-row errors** are captured and stored in the job state; processing continues with the next
  row
- A failed row does not affect other rows
- Orphaned images (from partially failed rows) are harmless in Sharetribe

---

## Testing

```sh
# Server tests (zipExtractor, csvParser, jobStore, importWorker, router)
yarn test-server --testPathPattern=bulk-import

# Client test (BulkImportPage rendering)
yarn test -- --watchAll=false --testPathPattern=BulkImportPage

# All tests
yarn test-ci
```

---

## Troubleshooting

| Problem                                                                             | Cause                                                                                                                                                         | Fix                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP 401 on `/authorize`                                                            | No signed-in Sharetribe session                                                                                                                               | Sign in to the marketplace                                                                                                                  |
| HTTP 401 on `/start` or `/status`                                                   | Missing or expired action token                                                                                                                               | Reload the page or start the upload again                                                                                                   |
| HTTP 400 `"user_id" override is not permitted`                                      | A non-admin upload set a `user_id` column                                                                                                                     | Remove the `user_id` column, or import as an admin (email in `BULK_IMPORT_OPERATOR_EMAILS`)                                                 |
| HTTP 400 "ZIP exceeds your N MB limit" / "Too many images" / "Your limit is N rows" | Over a per-tier limit                                                                                                                                         | Split into smaller batches, or import as an admin for the larger caps                                                                       |
| HTTP 429 "Too many imports"                                                         | Over the hourly import cap (3/hr standard, 20/hr admin)                                                                                                       | Wait up to an hour and retry                                                                                                                |
| HTTP 409 "already have an import in progress"                                       | The same user started a second import                                                                                                                         | Wait for the current import to finish before starting another                                                                               |
| HTTP 503 "capacity is full"                                                         | 3 imports already running across all users                                                                                                                    | Retry in a few minutes                                                                                                                      |
| HTTP 400 "Invalid ZIP file"                                                         | Uploaded file is not a valid ZIP                                                                                                                              | Re-create the archive with a standard ZIP tool                                                                                              |
| HTTP 400 "ZIP contains no .csv file"                                                | CSV missing from archive                                                                                                                                      | Ensure exactly one `.csv` is included at any level inside the ZIP                                                                           |
| HTTP 400 "ZIP contains N .csv files"                                                | Multiple CSVs in archive                                                                                                                                      | Remove extra CSV files — only one is allowed                                                                                                |
| HTTP 400 "duplicate image filename"                                                 | Two images share the same basename                                                                                                                            | Rename images so all basenames are unique across all directories                                                                            |
| HTTP 400 "path traversal"                                                           | ZIP entry contains `..` segment                                                                                                                               | Repackage the ZIP using a standard tool; do not manually craft entry names                                                                  |
| HTTP 400 "ZIP contains N entries. Maximum allowed is 401"                           | Too many files in ZIP                                                                                                                                         | Split into smaller batches (max 400 images + 1 CSV per import)                                                                              |
| Image "not found in uploaded files"                                                 | Filename mismatch between CSV and ZIP                                                                                                                         | Ensure CSV `image_*` values exactly match image basenames inside the ZIP (case-sensitive)                                                   |
| Job not found (404)                                                                 | Job expired                                                                                                                                                   | Jobs expire after 1 hour; re-run the import                                                                                                 |
| All rows fail with auth error                                                       | Invalid Integration SDK credentials                                                                                                                           | Check `SHARETRIBE_INTEGRATION_CLIENT_ID` and `SHARETRIBE_INTEGRATION_CLIENT_SECRET`                                                         |
| All rows fail `409 user-not-found` on `authorId`                                    | Integration API points at a **different marketplace** than the signed-in browser user (test↔live or wrong marketplace), so that user UUID doesn't exist there | Make `SHARETRIBE_INTEGRATION_CLIENT_ID/SECRET` and the frontend `REACT_APP_SHARETRIBE_SDK_CLIENT_ID` all belong to the **same** marketplace |
| Server memory issues                                                                | ZIP too large or too many large images                                                                                                                        | Keep ZIP under 50 MB compressed; reduce image file sizes or batch size                                                                      |
