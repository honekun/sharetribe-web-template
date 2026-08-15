# eShip Shipping Integration

Live shipping quotes **and** label purchase via the eShip carrier API
([myeship.co](https://myeship.co/docs/en/)), account **"Segmail"**. This is the authoritative
reference for setup, configuration, the request/response shapes we actually rely on, and the
money-flow decisions baked into the code.

> All buyer shipping prices are quoted live. There is no static shipping-price table or fallback.

---

## 1. Overview

Three flows, all server-side:

| Flow                       | When                                      | Endpoint                           | Result                                           |
| -------------------------- | ----------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| **Quote**                  | Buyer enters a MX destination at checkout | `POST {base}/quotation`            | Express/Estándar buckets → buyer price line item |
| **Label purchase**         | Payment confirmed / manual retry          | `POST {base}/shipment`             | `metadata.avLabel` (tracking + label PDF)        |
| **Picked-up notification** | Carrier scans the package                 | `POST /api/shipping/eship-webhook` | One native Sharetribe buyer email                |

eShip bills the **Segmail account directly** for every label — i.e. **AV fronts the carrier cost**,
not the seller. That single fact drives the payout decision in §9.

---

## 2. Environments & credentials

| Environment    | Base URL                        | Dashboard                  |
| -------------- | ------------------------------- | -------------------------- |
| **Production** | `https://api.myeship.co/rest`   | `https://app.myeship.co`   |
| **QA / test**  | `https://apiqa.myeship.co/rest` | `https://appqa.myeship.co` |

- **API keys are per-environment** and per-account. A prod key will **not** authenticate against
  `apiqa` and vice-versa. Retrieve a key from **Settings → API Keys** in the matching dashboard.
- Auth is a Bearer token on every request: `Authorization: Bearer <ESHIP_API_KEY>`.
- QA returns **test rates** (tagged `TESTRATE`, `rate_id` prefixed `TEST…`) and test labels stamped
  _"Test Label - Do not print"_ — safe to exercise end-to-end.
- If your Segmail account has no QA counterpart provisioned, ask the eShip / MBE Global account
  contact to create one and issue a QA key.

---

## 3. Environment variables

| Var                                            | Required           | Default                        | Purpose                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ESHIP_API_KEY`                                | yes (to quote/buy) | —                              | Bearer secret. Without it, shipping purchases fall back to **Contactar AV**.                                                                                                                     |
| `ESHIP_BASE_URL`                               | yes                | **none** (must be set per env) | `…/rest` base. QA `https://apiqa.myeship.co/rest`; prod `https://api.myeship.co/rest`.                                                                                                           |
| `ESHIP_MARKUP_PCT`                             | no                 | `0.18`                         | Buyer markup over raw carrier cost (see §7).                                                                                                                                                     |
| `ESHIP_API_DEBUG`                              | no                 | `false`                        | `true` echoes the carrier's error text in the API response (`{ code, detail }`). Leave off in prod.                                                                                              |
| `AV_SHIPPING_LABELS_ENABLED`                   | yes (explicit)     | `false`                        | Enables the label-purchase capability and its shared Integration API poller path. Independent of notification delivery; it does not enable automatic purchase by itself.                         |
| `AV_ESHIP_TRACKING_EMAILS_ENABLED`             | yes (explicit)     | `false`                        | Accepts durable eShip tracking events and processes the `TRANSIT/picked_up` buyer email through the shared poller.                                                                               |
| `ESHIP_WEBHOOK_SECRET`                         | yes (tracking)     | —                              | At least 32 random bytes. Presented by eShip as the `X-AV-Webhook-Secret` header (preferred) or `?secret=`; the webhook is also verified through an authenticated eShip API read.                |
| `SHIPPING_LABEL_OPERATOR_EMAILS`               | no                 | —                              | Comma-separated emails allowed to retry **any** seller's label. Sellers can always retry their own.                                                                                              |
| `ESHIP_LABEL_AUTOBUY`                          | no                 | `false`                        | `true` → buy the label automatically on `confirm-payment` (poller). Unset/`false` → manual only: the seller buys it via the **Generar guía** button. Requires `AV_SHIPPING_LABELS_ENABLED=true`. |
| `DATABASE_URL`                                 | yes (labels)       | —                              | Shared durable PostgreSQL ledger used by both manual and automatic label purchase. Required whenever `AV_SHIPPING_LABELS_ENABLED=true`.                                                          |
| `AV_SHIPPING_LABEL_STALE_CLAIM_MINUTES`        | no                 | `15`                           | Age at which an interrupted purchase becomes `unknown`; it is never retried automatically.                                                                                                       |
| `SHARETRIBE_INTEGRATION_CLIENT_ID` / `_SECRET` | yes                | —                              | Integration SDK — reads the seller's origin address and writes `metadata.avLabel`.                                                                                                               |

`ESHIP_BASE_URL`, `ESHIP_MARKUP_PCT`, and `ESHIP_API_DEBUG` are **server-only** (no `REACT_APP_`
prefix) — the client never computes prices, it only displays the server-computed ones.

---

## 4. Local env file loading (which file wins)

`server/env.js` mimics create-react-app precedence — files are tried in order and **the first to set
a variable wins** (dotenv never overrides an already-set var):

```
.env.${NODE_ENV}.local   →   .env.local (skipped for test)   →   .env.${NODE_ENV}   →   .env
```

| Scenario                                      | `NODE_ENV`    | File that supplies eShip creds |
| --------------------------------------------- | ------------- | ------------------------------ |
| **Local dev** (`yarn dev`, `yarn dev-server`) | `development` | **`.env.development`**         |
| **Tests** (`yarn test`, `yarn test-server`)   | `test`        | **`.env.test.local`**          |
| Production (Heroku)                           | `production`  | Heroku config vars             |

**Gotchas:**

- All local `.env*` files that carry the key are **gitignored** (`.env`, `.env.development`,
  `.env*.local`). **`.env.test` is tracked** — never put a real key there; it would be committed.
  Local test creds go in **`.env.test.local`**.
- Don't duplicate the eShip block across `.env` _and_ `.env.development` — for dev,
  `.env.development` always wins, so the `.env` copy is dead weight.

Verify what actually loaded (masked) for a given `NODE_ENV`:

```sh
NODE_ENV=development node -e "require('./server/env').configureEnv(); \
  console.log(process.env.ESHIP_BASE_URL, (process.env.ESHIP_API_KEY||'').slice(0,4)+'…')"
```

---

## 5. Architecture & flow

### 5.1 Quote (checkout)

1. An authenticated buyer enters a MX destination in the payment form → client
   `POST /api/shipping/quote` (per-user rate limited).
2. Server resolves the **seller's origin** (`integrationSdk.users.show` →
   `profile.protectedData.shippingOrigin`) and the **parcel**
   (`packageSizes[resolvePackageSize(listing)]`).
3. `POST {base}/quotation` (one call → `rates[]`).
4. Bucket the rates: **`FASTEST` → Express (`nacionalExpress`)**, **`CHEAPEST` → Estándar
   (`nacionalEstandar`)** (`bucketForRate`), apply `applyBuyerMarkup`, cache under a `quoteToken`
   (15-min TTL, 1,000-entry process cap), return buckets. The token is cryptographically bound to
   the listing, seller, parcel, and normalized destination.
5. Buyer picks a bucket → `avShippingType` / `avQuoteToken` / `avDestination` / `buyerEmail` flow
   through `getOrderParams` into `orderData`.

The **authoritative** price is resolved exactly once server-side, then passed to
`transactionLineItems` and persisted. A valid bound token is pinned; an expired, unknown, or
context-mismatched token is re-quoted. For a real payment, the destination is rebuilt from
`protectedData.shippingDetails`, not trusted from the duplicate client `avDestination`. A shipping
transaction without a valid rate and destination is rejected. Out-of-order browser quote responses
are ignored. The chosen rate is persisted to transaction `protectedData.avShipping`:

```
{ bucket, quot_id, rate_id, carrier, servicelevel, amountSubunits, currency }
```

No origin / `especial` size / carrier error → buyer sees **Contactar AV**.

### 5.2 Label purchase

**Auto path (opt-in).** Off by default. Only when **`ESHIP_LABEL_AUTOBUY=true`** (and
`AV_SHIPPING_LABELS_ENABLED=true`) does the shared `eventPoller` call
`shipmentService.maybeBuyLabelForEvent` on `transaction/confirm-payment` (independent of
`AV_NOTIFICATIONS_ENABLED`) → `eshipClient.createShipment({ rateId })` (`POST /shipment`) → writes
`metadata.avLabel`. With `ESHIP_LABEL_AUTOBUY` unset or `false`, the poller never buys a label
automatically — the seller buys it via the manual button below.

```
{ status: 'purchased', shipmentId, trackingNumber, trackingUrlProvider,
  trackingUrlCustom, labelUrl, carrier, servicelevel, purchasedAt }
{ status: 'failed',    error, rate_id, failedAt }
{ status: 'unknown',   error, rate_id, unknownAt }
```

Before any carrier call, PostgreSQL atomically inserts a `processing` claim in
`av_shipping_label_attempts`. Concurrent processes cannot acquire the same transaction. The durable
row is finalized before Sharetribe metadata is synced, so a metadata-write failure cannot cause a
second carrier purchase.

Only paid, non-cancelled transactions are eligible. A carrier 4xx response is `failed`; a timeout,
network/5xx response, malformed 2xx success, or interrupted process is `unknown`. `processing` and
`unknown` attempts fail closed and are never retried automatically because eShip may already have
charged the account.

**Manual retry.** Provider-only `POST /api/shipping/label { transactionId }`. Providers authorize
through their own SDK; allowlisted operators use the Integration SDK so they can act even when they
are not a transaction party. The route is per-user rate limited. `force:true` can retry a definitive
`failed` attempt. After checking the eShip dashboard and confirming no shipment exists, only an
allowlisted operator may send `{ transactionId, "confirmUnknown": true }` to release an `unknown`
attempt.

The application has no operator-facing label UI. `SHIPPING_LABEL_OPERATOR_EMAILS` authorizes the API
route only; cross-seller retries and `confirmUnknown:true` must follow an approved engineering/API
procedure after carrier-dashboard reconciliation.

**UI.** `TransactionPage/AVShippingLabelMaybe/` — `AVShippingLabelSection` (local-state wrapper that
POSTs and prefers the returned `avLabel`) + `AVShippingLabelMaybe` (3-state: **Descargar guía** /
**Generar guía** / hidden for especial). Rendered provider-only via a `shippingLabelSlot` prop
threaded through `TransactionPanel`.

### 5.3 Tracking webhook → native Sharetribe email

eShip sends tracking checkpoints to the public HTTPS endpoint. Its documentation provides a custom
webhook URL but no request-signature scheme, so the integration uses two checks:

1. the request carries a high-entropy shared secret that the server compares in constant time; and
2. the worker re-fetches the shipment with Bearer auth using
   `GET {base}/shipment?shipment_id=…&eventList=true` before trusting the checkpoint, provider, or
   tracking link.

The secret may be presented **either** as a header or in the query string, and either one matching
`ESHIP_WEBHOOK_SECRET` authenticates the request. Configure the header form under **Settings →
webhook/custom tracking URL → Encabezados**:

```text
URL:    https://MARKETPLACE_HOST/api/shipping/eship-webhook
Header: X-AV-Webhook-Secret: ESHIP_WEBHOOK_SECRET
```

**Prefer the header.** Render and Heroku both write the query string into their router logs (and
into any attached log drain), and `@sentry/node` attaches `request.query_string` to every captured
event — so a `?secret=` value comes to rest in third-party retention on any 5xx. Header values are
not sent with `sendDefaultPii: false`, and the `secret` substring in the header name also matches
Sentry's default server-side scrubbing.

The `?secret=` form is retained as a fallback because eShip documents no guarantee that custom
headers survive their retries or redirects:

```text
https://MARKETPLACE_HOST/api/shipping/eship-webhook?secret=ESHIP_WEBHOOK_SECRET
```

If the header form has not been confirmed against a real checkpoint in an environment, configure
both; delivery succeeds as long as one of them matches. Do not log either form, paste it into
tickets, or expose it to the browser. Rotate the secret and update both the host and eShip
immediately if it is disclosed.

The endpoint accepts eShip's documented JSON shape. Only the exact normalized pair below is queued;
all other carrier events return `202` and are ignored:

```json
{
  "object_id": "60e37902e86e1",
  "tracking_number": "281115007045",
  "provider": "FEDEX",
  "status": "TRANSIT",
  "substatus": "picked_up",
  "timestamp": "2026-08-14 12:00:00",
  "timezone": "-06:00"
}
```

PostgreSQL stores one `transit-picked-up` row per shipment. The leader poller claims due rows,
retries transient failures up to eight times with a 30-second-to-one-hour exponential delay, and
reports counts under `database.eshipTrackingByStatus` at `GET /api/notifications/readiness`.
Duplicate webhooks return `200` without creating another transition or email.

The worker maps `object_id` through the label-purchase ledger, verifies the authenticated shipment
and tracking number, prefers `tracking_url_provider` and falls back to `tracking_url_custom`, then
writes `metadata.avTracking`. It executes one of two operator-only self-transitions:

```text
purchased → purchased   transition/eship-picked-up-from-purchased
delivered → delivered   transition/eship-picked-up-from-delivered
```

These transitions exist only to trigger `purchase-order-in-transit-customer`; they do not change the
transaction state, first-entered-state timestamps, stock, refund, payment, or payout. If the seller
marks the order delivered during processing, the worker re-reads once and uses the delivered
self-transition. Received, disputed, canceled, completed, non-purchase, and older process versions
are recorded as ignored.

The hosted `default-purchase` version and its Email texts must be deployed before enabling the flag.
Only transactions initiated on that version can use the new transitions; existing transactions
remain pinned to their original process version.

### 5.4 Module index

| Module                                                                      | Role                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `server/api-util/eshipClient.js`                                            | HTTP: quote, create, and authenticated shipment verification |
| `server/services/shippingQuoteService.js`                                   | Quote orchestration + 15-min cache                           |
| `server/services/shipmentService.js`                                        | Label purchase (idempotent core + poller hook)               |
| `server/services/shippingLabelStore.js`                                     | Durable PostgreSQL purchase claims/outcomes                  |
| `server/migrations/007_shipping_label_attempts.sql`                         | Label purchase ledger schema                                 |
| `server/services/eshipTrackingService.js` + `eshipTrackingStore.js`         | Verified pickup email worker + durable claims                |
| `server/migrations/009_eship_tracking_notifications.sql`                    | Idempotent tracking-notification ledger                      |
| `server/api-util/avShipping.js`                                             | Persist chosen rate → `protectedData.avShipping`             |
| `server/api/shipping-quote/`                                                | `POST /api/shipping/quote`                                   |
| `server/api/shipping-label/`                                                | `POST /api/shipping/label` (+ `rateLimiter.js`)              |
| `server/api/eship-webhook.js`                                               | `POST /api/shipping/eship-webhook`                           |
| `src/config/configAVShipping.js`                                            | Package sizes, markup math, bucket mapping                   |
| `src/containers/CheckoutPage/shippingQuote.duck.js` + `AVShippingSelector/` | Client quote UI (incl. `AVShippingNotice`)                   |
| `src/containers/TransactionPage/AVShippingLabelMaybe/`                      | Provider label control                                       |

Both custom routers mount at `/api/shipping` in `server/customApiRoutes.js` (`/label` falls through
the quote router).

---

## 6. Package sizes & parcel resolution

`resolvePackageSize(publicData)` uses `publicData.avPackageSize` if set, else maps the listing
category via `categoryPackageSizeMap`.

Automatic category rules come from
[`docs/data/categoria-paquete.csv`](../data/categoria-paquete.csv). The code stores only the CSV's
non-`M` category exceptions because `M` is the global fallback. CSV business groupings such as
"Chamarras / Abrigos / Sacos", "Tenis / Sneakers", and the bag sizes are mapped to the corresponding
live Sharetribe category IDs. Categories not covered by the CSV resolve to `M`.

| Size          | Dims (cm)    | Max weight | Packaging                                                             |
| ------------- | ------------ | ---------- | --------------------------------------------------------------------- |
| `S`           | 25 × 20 × 8  | 0.5 kg     | polymailer                                                            |
| `M` (default) | 35 × 30 × 10 | 1.0 kg     | box-medium                                                            |
| `L`           | 50 × 40 × 15 | 1.5 kg     | box-large                                                             |
| `especial`    | —            | —          | Explicit legacy/manual value → **Contactar AV** (no auto quote/label) |

---

## 7. Buyer price math

```
buyerPrice = roundUp( carrierAmount × (1 + ESHIP_MARKUP_PCT) , to nearest 1 peso )
```

`applyBuyerMarkup` (`configAVShipping.js`): markup default `0.18`, rounded **up** to the nearest
peso (`roundUpToSubunits = 100`) so AV never under-recovers and prices look clean.
`eshipAmountIncludesIva = false` — the current calculation treats IVA as part of the markup buffer,
not as already included in the carrier amount. Reconciliation and any future policy change are
tracked in [pending eShip policy](../pending/eship.md).

---

## 8. Verified API shapes (apiqa, 2026-07-20)

Confirmed live against `apiqa` — **the object identifier is `object_id` in both responses; there is
no `quot_id` or `shipment_id`.**

**`/quotation`** top-level: `object_id`, `rates[]`, `messages`, `order_id`, `address_from/to`,
`ship_date`, `parcels`. Each rate:

```json
{ "rate_id": "TEST…", "provider": "Estafeta", "amount": 145, "currency": "MXN",
  "days": 4, "tags": ["TESTRATE","BESTVALUE","CHEAPEST"],
  "servicelevel": { "name": "Terrestre", "token": 70 }, "breakdown": { … } }
```

→ `shippingQuoteService` captures `object_id` as `quot_id`; `bucketForRate` reads `tags`
(`FASTEST`/`CHEAPEST`).

**`/shipment`** request sends **only** `rate_id`:

```json
{
  "object_id": "6a5dd216…",
  "status": "SUCCESS",
  "substatus": "label_created",
  "tracking_number": "5050…",
  "label_url": "https://…/label/….pdf",
  "provider": "Estafeta",
  "amount": 0
}
```

→ `shipmentService` maps `object_id`→`shipmentId`, `tracking_number`→`trackingNumber`,
`tracking_url_provider` / `tracking_url_custom`→the stored tracking links, and
`label_url`→`labelUrl`.

---

## 9. Testing

- **Unit/integration** (mocked `node-fetch` + SDK): `eshipClient.test.js`,
  `shipmentService.test.js`, `shippingQuoteService.test.js`, `shippingLabelStore.test.js`,
  `eshipTrackingService.test.js`, `eshipTrackingStore.test.js`, `eship-webhook.test.js`,
  `shipping-label/index.test.js`, and `lineItems.test.js`. Run `yarn test-server`.
- Run `yarn db:migrate` before enabling labels or tracking email. Migration `009` must be present
  before `AV_ESHIP_TRACKING_EMAILS_ENABLED=true`; readiness includes both label and tracking counts.
- In Test, push the purchase process/templates and Email texts first, configure the QA dashboard
  webhook to the staging URL, then enable the flag. A real `picked_up` checkpoint must produce one
  buyer email, and replaying the same body must not produce a second.
- **Live smoke** (real apiqa call): a standalone script that loads env like the server, then calls
  `eshipClient.quote` / a raw `/shipment` POST, printing the response so field names can be
  re-verified against prod later. Keep such scripts out of the repo (scratchpad only) — they hit a
  live carrier account.

---

## Appendix — Design decisions & reconciliation notes

Non-obvious choices with money/operational implications. Read before changing the shipping line
item, the label flow, or the price math.

### A. Shipping payout — the platform keeps it (not the seller)

**Decision.** The `line-item/shipping-fee` is `includeFor: ['customer']` only
(`server/api-util/lineItems.js`) — the buyer pays it, but it is **not** paid out to the provider.

**Why.** eShip bills the Segmail account directly, so **AV pays the carrier**, not the seller. If
shipping were also `includeFor: 'provider'` (the upstream default, which assumes the _seller_
arranges and pays shipping), the buyer's shipping money would flow to the seller while AV separately
ate the carrier bill — AV would lose the carrier cost on every shipped order. Retaining the fee on
the platform side lets AV cover the label it bought and keep the markup:

```
buyer pays $172  →  platform retains $172  →  AV pays eShip $145  →  AV nets +$27 (markup)
seller payout = item − providerCommission   (no shipping)
```

**Commission is unaffected.** Provider commission is computed on `[order]` only
(`lineItemHelpers.js` `getProviderCommissionMaybe`; the code comment there notes the shipping fee is
excluded from both commissions). So dropping shipping from the provider side does **not** change the
commission base.

**Scope / caveats:**

- **`especial` / Contactar AV**: AV does _not_ buy a label (seller ships manually), so the seller
  arguably _should_ receive shipping money there. Those orders never produce a
  `line-item/shipping-fee` today (no price resolves), so they fall outside this line item — handled
  out-of-band. Make this explicit if especial ever gets an automated price.
- This is a **financial/tax decision**, not just code. Confirm with whoever owns AV's Stripe
  Connect + accounting model before changing it.

### B. `object_id`, not `quot_id` / `shipment_id`

eShip's quote and shipment responses identify their object via **`object_id`**. There is no
`quot_id` or `shipment_id` field (verified on apiqa 2026-07-20). Code maps `object_id` accordingly
and keeps a defensive `|| shipment_id` fallback in case prod ever differs — re-verify against prod
before go-live.

### C. `quot_id` is traceability-only

`/shipment` succeeds with **`rate_id` alone**. We still capture the quotation `object_id` as
`avShipping.quot_id` for audit trails, but a missing/`null` value never blocks a label purchase.

Unresolved cancellation/refund ownership and IVA reconciliation are intentionally separated from
this current-state guide. See [pending eShip policy](../pending/eship.md). Until those decisions are
approved, keep `ESHIP_LABEL_AUTOBUY=false` and reconcile purchased labels manually. eShip's public
guidance says an unused label can be canceled and its balance normally returns to the eShip wallet
within one to three business days, but the current application does not call the cancellation
endpoint or track that credit.
