# CLAUDE.md

Guidance for Claude Code working in this repository.

## Overview

Customized marketplace ("Archivo Vintach") built on the
[Sharetribe Web Template](https://github.com/sharetribe/web-template) (React + Express SSR). Fork of
`sharetribe/web-template`. Render.com is the current Test staging host. The approved initial Live
plan validates one Heroku app against Test services, then converts that same app and dyno formation
to Live while reusing a reset, clean PostgreSQL add-on. Stripe Connect payments use Sharetribe
Marketplace API.

- GitHub: https://github.com/honekun/sharetribe-web-template
- Upstream: https://github.com/sharetribe/web-template
- Staging: https://archivo-vintach.onrender.com/
- Docs: https://www.sharetribe.com/docs/

## Commands

```sh
yarn run dev              # Frontend (3000) + backend API (3500) concurrently
yarn run dev-frontend     # Frontend only (webpack-dev-server)
yarn run dev-backend      # Backend API server only (nodemon)
yarn run dev-server       # Production-like SSR with hot reload (4000)
yarn start                # Production server (node server/index.js)

yarn run build            # build-web && build-server
yarn run clean            # Remove build directory

yarn test                                  # Frontend tests, interactive watch
yarn test -- --watchAll=false              # Run all tests once
yarn test -- --testPathPattern=auth        # Match "auth" in path
yarn test -- --testNamePattern="login"     # Match "login" in name
yarn test-server                           # Server tests only
yarn test-ci                               # CI: server then client (--runInBand)

yarn run format / format-ci                # Prettier (write / check)
yarn run config                            # Config validation/setup wizard
yarn run translate                         # Translation management
yarn av-translation-check                  # en_av.json / es_av.json key symmetry
```

**Node:** `>=18.20.1 <23.2.0` | **Package manager:** Yarn

## Architecture

**Routing & data loading** — Routes in `src/routing/routeConfiguration.js`: each has `path`, `name`
(for `NamedLink`/`NamedRedirect`), a `@loadable/component`, and an optional `loadData` thunk.
`loadData` runs on both server (`server/dataLoader.js`, before render) and client
(`RouteComponentRenderer` in `Routes.js`, on mount/nav). Each container exports `loadData` via
`src/containers/pageDataLoadingAPI.js`.

**Redux ducks** — Self-contained modules (`@reduxjs/toolkit` `createSlice`/`createAsyncThunk`).
Global ducks in `src/ducks/` (`auth`, `user`, `ui`, `stripe`, `marketplaceData`, …); container ducks
colocated. SDK injected as `thunkAPI.extra`. Entities normalized in `marketplaceData.duck.js`
(containers hold IDs). Errors via `storableError()`.

**SSR** — Express in `/server/`: `index.js` (middleware/CSP/routes/renderer), `renderer.js` (store +
`StaticRouter` → HTML), `dataLoader.js`, `auth.js` (Passport social), `api-util/sdk.js` (cookie
token store), `api-util/cache.js` (in-memory LRU, Heroku-safe), `csp.js`. **Guard all browser APIs
(`window`/`document`/`localStorage`) behind `typeof window !== 'undefined'`.**

**Container/Page pattern** — `PageName.js` (component + `mapStateToProps` +
`compose(connect(...))`), `PageName.duck.js` (state + `loadData`), `PageName.module.css`, optional
sub-components.

**PageBuilder** (`src/containers/PageBuilder/`) — Renders dynamic pages from Sharetribe hosted
assets. `SectionBuilder.js` maps section configs → components (delegates token parsing to
`extensions/pageBuilder/av/sectionStyles.js`); `AVSectionContainer.js` is the AV drop-in replacement
for upstream `SectionContainer`, handling all display-option tokens. Section appearance encoded in
`sectionName` via `- Token` flags (see Section Display-Option Tokens). Custom sections registered
via `options.sectionComponents`.

**Transaction processes** (`src/transactions/transaction.js`) — `default-purchase` (ITEM),
`default-booking` (DAY/NIGHT/HOUR/FIXED), `default-inquiry` (INQUIRY), `default-negotiation`
(OFFER/REQUEST). State machines in `transactionProcess*.js`. CheckoutPage →
`CheckoutPageWithPayment` (Stripe) or `CheckoutPageWithInquiryProcess`. Timings live in
`ext/transaction-processes/*/process.edn` (deployed via `flex-cli process push` +
`process update-alias`; in-flight transactions keep their old version). AV `default-purchase`:
seller shipping window **P7D** (`transition/auto-cancel`; reminders P3D + P5D
`purchase-shipping-reminder[-final]`); buyer confirm window **P7D** (`auto-mark-received`, reminder
P5D `purchase-mark-order-received-reminder`) — both were P14D before 2026-08-14. A reminder is
pinned to its deadline, so moving a window means moving its reminder too.

**SDK** — `sharetribe-flex-sdk`; client wrapper `src/util/sdkLoader.js`, server
`server/api-util/sdk.js`. Tokens in HttpOnly cookies (auto-refresh). Hosted assets via
`sdk.assets.search()`, cached 1hr server-side.

**Config** (`src/config/`) — Built-in config merged with hosted Sharetribe config at runtime via
`util/configHelpers.js`; access via `useConfiguration()`. AV-specific:

- `configListingDisplay.js` — client-only render override map swapping inputs for hosted listing
  fields (`all_sizes`→`groupedMultiSelect`, `color`→`colorGridPicker`, `brand`→`searchableSelect`).
  Read by `EditListingDetailsForm`; does NOT change backend search schema.
- `configAV.js` — AV defaults kept out of upstream files: `defaultCountry` (Stripe payment/payout,
  `REACT_APP_AV_DEFAULT_COUNTRY`); `sellerUserTypes` + `canShowOriginalPrice()` (originalPrice
  gate); `storeSellerUserType`/`storeTypeFieldKey`/`getStoreTypeTags()` (StoreTypeTags gate/labels);
  `welcomePopupUserTypes`/`canShowWelcomePopup()`/`welcomePopupSuppressedPaths` (AVWelcomePopup
  gate); `storeSellerHiddenNavPages`/`isNavPageHiddenForUser()` (hides the buyer-side menu entries —
  MyAddresses, Favorites, and the inbox sidebar's Orders tab keyed `InboxPage:orders` — from
  `vendedor-tienda`; the inbox envelope itself stays, and Topbar resolves `inboxTab` away from a
  hidden tab; **visibility only**, every route stays registered and reachable by URL);
  `moveListingFieldToEnd()` (keeps `tags` last; called from `configHelpers`);
  `brandFieldKey`/`mergeHostedBrandOptions()` (folds the Console `brand` field's
  `enumOptions` into the code-defined field from `configListingAV.js` before
  `configHelpers`' field-level union discards them — Console wins per option, the
  field's own config stays code-owned, result sorted by label with `other` first;
  `brand` only, `color`/`all_sizes` are untouched); The four gates are
  intentionally separate.

**Styling** — CSS Modules (`*.module.css`, `className={css.root}`). Globals in `src/styles/`:
`marketplaceDefaults.css`, `avBrandOverrides.css`, `customMediaQueries.css`. Theme vars
`--marketplaceColor[Dark|Light]`. Dark theme via `css.darkTheme` (section `textColor: 'white'`).
**Topbar breakpoint:** desktop topbar shows at `--viewportLarge` (1024px); pages passing
`mobileRootClassName={css.mobileTopbar}` must hide `.mobileTopbar` at `--viewportLarge` too (not
`--viewportWide`/1600px) or both topbars render on tablet.

**CSS placement (keep upstream files clean).** Never edit an upstream `*.module.css` just to restyle
it. Instead:

- **Restyle an existing upstream class/element** (color, spacing, font, layout) → add a global
  override to `src/styles/avBrandOverrides.css`. Reach scoped classes with
  `:root [class*='Component_localClass__'] { … }` — the `:root` raises specificity to (0,2,0) so it
  beats the module's own `.localClass` (0,1,0) regardless of source order (CSS Modules load after
  the globals). Brand vars (`--av*`) and global element rules also live here.
- **Add a new component-specific class** consumed by JS → put it in a new co-located AV module
  (`<Component>.av.module.css`) imported by the (already-forked) component, not in the upstream
  `.module.css`. A global override can't apply a class the module never declares.
- **Pristine upstream baseline: always `upstream/main`, never a hardcoded SHA.**

  ```sh
  git fetch upstream
  git diff upstream/main -- <file>   # empty = clean
  ```

  Do **not** diff or revert against `a252774a`. That was the merge-base before the v12.1.0 merge
  and `upstream/main` is now ~275 commits past it, so `git checkout a252774a -- <file>` silently
  throws away merged upstream work — it did exactly that to `EditListingPhotosForm` and
  `CustomLinksMenu/`, which were already clean. Any SHA written down here goes stale the next time
  upstream is merged; resolve the baseline at the time you use it.

  The big forked files (TopbarDesktop/MobileMenu/SearchForm, SectionBuilder, SectionFeatures/Footer,
  vendored `image-gallery.css`) are intentionally kept as-is.

## Custom AV Components

`src/components/`:

- `AVListingCard/` — listing card; overlays `StoreTypeTags` for `vendedor-tienda` authors
- `AVUserCard/` — profile card for `SectionSelectedUser`
- `AVCategoryCard/` — category card for `SectionSelectedCat`; links to `/s?pub_categoryLevel1=<id>`
- `FieldSwatch/` — color swatch display (14 color mappings)
- `FieldColorDropdown/` — dropdown color picker (reuses FieldSwatch colors); Final Form
- `FieldGroupedMultiSelect/` — grouped multi-select, removable yellow chips (`all_sizes`)
- `FieldSearchableSelect/` — searchable single-select combobox (`brand`)
- `NewsletterForm/` — Brevo subscribe; posts `/api/brevo/subscribe`
- `StoreTypeTags/` — colored tag chips for `vendedor-tienda`; values from `tipoTienda` user field;
  gate/labels in `configAV.getStoreTypeTags()`; needs `profile.publicData.{userType,tipoTienda}` in
  `fields.user` (added to `SearchPage.duck.js` + `extensions/landingPage/av/listings.js`)
- `AVWelcomePopup/` — one-time onboarding modal for new sellers, rendered by `TopbarContainer`; all
  content via `AVWelcomePopup.<userType>.*` translation keys (empty = hidden); dismissal persists
  `publicData.onboardingCompleted` via `markVendedorOnboarded`. See `memory/welcome-popup`.
- `IconChat/` — chat bubble SVG; the carousel's "Chat" button (OrderPanel `secondaryCtaButton`)
- `BalanceSummary/`, `PayoutItem/`, `TransactionFilters/` — MyBalancePage UI

**Shared field-controls pattern** (FieldGroupedMultiSelect, FieldColorDropdown,
FieldSearchableSelect): clear (×) + toggle (▼/▲) in `.controls` flex group, 32×32px,
`border-radius: 4px`. Required translation keys: `expand`/`collapse` (all three); `clearAll`
(grouped + color); `clear` (searchable).

`src/containers/ListingPage/AVListingDetails/` — curated attribute summary
(brand/sizes/condition/colors/category/género) as `/s?pub_*` links + description excerpt with show
more/less; rendered via OrderPanel `detailsSlot`.

**Custom pages:** `MakeOfferPage`, `RequestQuotePage`, `ManageAccountPage` (negotiation);
`MyPurchasesPage`, `MySalesPage`, `MyBalancePage`; `BulkImportPage` (`/admin/bulk-import`, CSV+image
import open to any signed-in user — listings author to the current user;
`BULK_IMPORT_OPERATOR_EMAILS` flags "admin" users who may add a `user_id` column to author for
others. Tiered limits + per-user hourly rate limit + magic-byte image sniffing; blue CTA on
`/l/new`. See `docs/implementation/bulk-import.md`).

### Custom PageBuilder sections (`SectionBuilder/`)

| Section                      | type / sectionId prefix                   | Notes                                               |
| ---------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `SectionHeroCustom2`         | `avHero2` / `av-hero2-*`                  | 2 CTAs, optional mobile bg + bgLink                 |
| `SectionHeroCustom3`         | `avHero3` / `av-hero3-*`                  | block-based; each block = image strip + overlay     |
| `SectionVideoSection`        | `avVideo` / `av-video-*`                  | 50/50 video+text; URL from translation key          |
| `SectionSelectedListings`    | `av-selections`                           | block `blockName` = listing UUID                    |
| `SectionRecommendedListings` | `av-recommendeds`                         | block names = listing UUIDs                         |
| `SectionTagCatListings`      | `av-tag-listings`                         | first block `blockName` = `tag:<v>`/`cat:<v>`/plain |
| `SectionSelectedCat`         | `av-selected-cats`                        | AVCategoryCard; block = category id + title + media |
| `SectionSelectedUser`        | `avSelectedUsers` / `av-selected-users-*` | block names = user UUIDs                            |
| `SectionInstaGrid`           | `avInstaGrid` / `av-insta-grid-*`         | 2–6 col image grid                                  |

**Custom blocks** (`BlockBuilder/`). Upstream's `BlockBuilder.js`, `BlockDefault.js` and
`BlockFooter.js` are **byte-identical to upstream** — AV plugs in entirely through
`options.blockComponents`, which `SectionBuilder` injects from
`extensions/pageBuilder/av/blocks.js` `getAvBlockComponents()`. SectionBuilder is the choke point
every section's `<BlockBuilder options={options}>` flows through, so this reaches all eight
`<PageBuilder>` call sites — including ToS/Privacy/Fallback pages, which pass no options of their
own. Caller-supplied `blockComponents` are spread last and still win. SectionBuilder also runs each
section's blocks through `normalizeAvBlockTypes()`: upstream's BlockBuilder resolves the component
from `blockType` alone, so a block relying only on an AV `blockId`/`blockName` shorthand is typed
`defaultBlock` there — without it the block would warn and render nothing instead of reaching the
dispatcher. A type-less block matching no shorthand is left alone and still warns.

```
upstream BlockBuilder → options.blockComponents
  ├─ defaultBlock → AVBlockDefault (dispatcher) → AVBlockDefaultView | an AV block below
  ├─ footerBlock  → AVBlockFooter
  └─ blockPhotoSlider · blockInstagramFeed · blockMarkdownTable · blockBrevoForm
```

`AVBlockDefault` is a dispatcher, not a renderer. It calls `buildAvBlockProps` (token props + CTA
class layering, both in `av/blocks.js`) and `resolveAvBlockComponent` (routes by `blockId` /
`blockName`), then renders either the matched AV block or `AVBlockDefaultView`. **AV blocks must
render `AVBlockDefaultView`, never `AVBlockDefault`** — otherwise a `photoSlider ::` block
dispatches to itself forever. `AVBlockDefaultView` / `AVBlockFooter` are deliberate forks; see
Deliberate forks below.

`AVPhotoSliderBlock` (`blockPhotoSlider`; reached by the `photoSlider ::` blockName token) renders
`AVPhotoSlider` into `AVBlockDefaultView`'s `mediaSlot` prop — the seam kept for a stand-in media
element — so the title/text/CTA still come from the view. Slides come from
`PhotoSlider.<blockId>.image_1…4` microcopy; blank keys are dropped and an entirely unset slider
falls back to the block's own media field. Slides mount only as they are first shown, so an unseen
slide is never fetched. blockName tokens (parsed in
`extensions/pageBuilder/av/blocks.js` `createBlockCustomProps`): `smallerTitles ::` (mirrors
`- SmallerTitles`), `mediaTitle ::` (renders media between the title and the rest of the content:
title → media → text/CTA), `blueTitle ::` (mirrors `- BlueTitle` but colors only that block's own
title, not body-markdown headings); `fullLinks ::` (applies `word-break: keep-all` to links in the
block's body `<p>` elements so a word/URL is never broken mid-character — a too-long link overflows
at full size instead of splitting); `imgTop ::` (applies `object-position: top` to the block media
img/video so cropped media anchors to the top instead of center).

### ListingPage carousel layout (AVListingPageCarousel)

`src/containers/ListingPage/AVListingPageCarousel.js` is active when
`layoutConfig.listingPage?.variantType === 'carousel'`, else `ListingPageCoverPhoto`. (Unused non-AV
`ListingPageCarousel.js` also exists.) OrderPanel becomes a fixed bottom-bar modal below 1024px, so
the order column is desktop-only. **Sticky-gallery gotcha:** `.reviewsBlock` is kept a sibling
_outside_ `.galleryColumn` (full-width grid row 2) so it can't inflate the sticky gallery's
containing block. OrderPanel accepts `detailsSlot`/`footerSlot`/`hideAuthor`/`secondaryCtaButton`
props to restructure without forking. Full detail: `memory/listing-page-carousel-layout`.

### My Purchases / Sales / Balance

`/my-purchases` + `/my-sales` reuse `InboxItem` + `getStateData` from InboxPage; ducks hard-code
`only: 'order'` / `only: 'sale'`. `/my-balance` is a seller financial dashboard: **no direct Stripe
balance API** — totals computed client-side from transaction `payoutTotal` via `Promise.all` of
paginated + 3 summary `sdk.transactions.query()` calls. Shared util
`src/transactions/transactionHelpers.js`: `getStatusFromLastTransition`, `getCompletedTransitions`,
`getRefundedTransitions`, `buildFilteredQueryParams`. All three registered in
`routeConfiguration.js`/`pageDataLoadingAPI.js`/`reducers.js`; linked from TopbarDesktop,
TopbarMobileMenu, UserNav.

## Extensions

AV keeps upstream files unmodified via extension architecture in `src/extensions/`. Hooks:
`loadDataExtension`, `selectExtensionProps`, `getPageBuilderOptions`, `transformPageData`.

- `landingPage/av/` — `constants.js`, `sections.js`, `listings.js`
  (`queryListingsByIds`/`queryListingsByFilter`/`parseFilterFromBlockName`), `transform.js`,
  `index.js` (registers AV sections + wires hooks). `LandingPage.js`/`LandingPage.duck.js` contain
  **only the extension wiring** (the `mapStateToProps`/`loadData` seam) — add features via the
  registry, never inline.
- `pageBuilder/av/` — registers `avHero2`/`avHero3`/`avVideo` for CMSPage; `sectionStyles.js`
  (`parseSectionCustomOptions`, `parseSectionCtaClass`); `constants.js`; `transform.js`.
- `accountNav/` (`getAccountSettingsTabs()`), `topbar/` (custom link config +
  `topbarDataProvider.js`), `searchFilters/`.
- `topbar/topbarDataProvider.js` — single source for the topbar's category-dropdown config and
  local-design users. The desktop menu and the (closed but mounted) mobile menu both live on every
  page, so each fetching for itself doubled every request; both now share one in-flight promise,
  cached 5 min. Server side, `/api/topbar/local-design-users` coalesces concurrent loads and narrows
  the query with `pub_userType`, falling back to a full user scan (and remembering that) when the
  marketplace has no schema for it.
- Redux: `src/ducks/avExtension.duck.js` — `avLandingExtension` slice (`tagListingIds`), SSR-safe,
  registered in `ducks/index.js`.

## AV-noti: Notifications (Welcome Email + WhatsApp)

Server-side in `server/services/`. `eventPoller.js` polls the Integration API every 5 min when
`AV_NOTIFICATIONS_ENABLED=true` or `AV_SHIPPING_LABELS_ENABLED=true` and readiness passes. Its
PostgreSQL cursor survives restarts; the 10-minute lookback only seeds an environment with no saved
cursor. `welcomeEmailService.js` handles Brevo email + PDF, `pdfGenerator.js` returns a PDFKit
`Promise<Buffer>`, and `whatsappService.js` contains the retained Meta Cloud API template sender.
WhatsApp is release-locked off in `notificationConfig.js` for the first release, and delivery also
blocks operator retries. Enabled email channels reject incomplete production configuration instead
of silently disabling sends.

The dormant WhatsApp mapping is: `user/created` → admin & user; `transaction/transitioned` →
buyer/seller by transition; `message/created` → other party. Signup phone component imports/usages
are commented for the first release. **Never import `server/services/*` in client code.**

Env vars: `SHARETRIBE_INTEGRATION_CLIENT_ID`, `SHARETRIBE_INTEGRATION_CLIENT_SECRET`,
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_PHONE` (E.164),
`BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.

WhatsApp templates (need Meta approval): `av_welcome_user`, `av_admin_new_user`,
`av_purchase_confirmed`, `av_sale_received`, `av_delivered`, `av_cancelled`, `av_booking_accepted`,
`av_booking_declined`, `av_new_message`.

## Live Shipping Quotes (eShip / myeship.co)

Buyer shipping price is **quoted live at checkout** from the eShip carrier API (account "Segmail");
there is no static shipping-price table or fallback. Flow: buyer enters MX destination in the
payment form → client `POST /api/shipping/quote` → server resolves the seller's stored origin
(`integrationSdk.users.show` → `profile.protectedData.shippingOrigin`) + the parcel
(`packageSizes[resolvePackageSize(listing)]`) → eShip `POST /rest/quotation` (one call → `rates[]`)
→ bucket **FASTEST→Express (`nacionalExpress`)** / **CHEAPEST→Estándar (`nacionalEstandar`)**, apply
`applyBuyerMarkup` (markup + round up) → cache under a `quoteToken` (15-min TTL) → return buckets +
raw rates. Buyer picks a bucket → `avShippingType`/`avQuoteToken`/`avDestination`/`buyerEmail` flow
through `getOrderParams` into `orderData`.

Authoritative price is server-derived in **`transactionLineItems` (now `async`)** via
`shippingQuoteService.resolveBucketPrice` (cache hit → pinned; **miss → re-quote**); the client
price is never trusted. The 3 callers (`transaction-line-items.js`, `initiate-privileged.js`,
`transition-privileged.js`) now `await` it. Chosen rate persisted to transaction
`protectedData.avShipping` (for labels + payout). No static-grid fallback: no origin / `especial` /
carrier error → buyer sees **Contactar AV** (retry on transient). **Payout:** the
`line-item/shipping-fee` is `includeFor: ['customer']` only (`server/api-util/lineItems.js`) — AV
buys the label centrally so the platform (not the seller) retains the shipping fee; provider
commission is on `[order]` only so it's unaffected. Current rationale is in
`docs/integrations/eship.md`; open refund/IVA policy is in `docs/pending/eship.md`.

### Label purchase (post-payment)

Once a purchase is paid, the chosen rate is exchanged for a real eShip label. **Auto path (opt-in —
`ESHIP_LABEL_AUTOBUY=true`, off by default):** the `eventPoller` calls
`shipmentService.maybeBuyLabelForEvent` on `transaction/confirm-payment` (independent of the
WhatsApp gate; gated by `ESHIP_LABEL_AUTOBUY` — unset/false means the seller buys the label via the
manual button instead) → `eshipClient.createShipment({ rateId, quotId })` (`POST /rest/shipment`) →
result written to transaction `metadata.avLabel`
(`{ status:'purchased', shipmentId, trackingNumber, labelUrl, carrier, servicelevel, purchasedAt }`
or `{ status:'failed', error, rate_id, failedAt }`). Buying is **idempotent**
(`buyLabelForTransaction` short-circuits on `status:'purchased'`, never re-buys; auto path also
skips `failed`). **Manual retry:** provider-only `POST /api/shipping/label { transactionId }`
(`server/api/shipping-label/`) — authorizes via the caller's SDK (provider or
`SHIPPING_LABEL_OPERATOR_EMAILS`), per-user hourly rate limit, then
`buyLabelForTransaction(..., { force:true })` (retries a `failed` marker, still can't double-buy).
Client: `TransactionPage/AVShippingLabelMaybe/` — `AVShippingLabelSection` (local-state wrapper,
POSTs + prefers the returned `avLabel`) + `AVShippingLabelMaybe` (3-state: Descargar guía / Generar
guía / hidden for especial); rendered provider-only via a `shippingLabelSlot` prop threaded through
`TransactionPanel`. **Verified on apiqa** (2026-07-20): `/quotation` and `/shipment` both identify
their object via **`object_id`** (there is **no** `quot_id`/`shipment_id`) — `shippingQuoteService`
captures the quotation `object_id` as `quot_id`, `shipmentService` maps the shipment `object_id` to
`shipmentId`. `/shipment` needs only the rate's `rate_id` (the `quot_id` is traceability-only).
`tracking_number`/`label_url` are as named. QA returns test rates tagged `TESTRATE` with `TEST…`
rate_ids and a "Test Label - Do not print" label.

Modules: `server/api-util/eshipClient.js` (HTTP: `quote` + `createShipment`),
`server/services/shippingQuoteService.js` (orchestration + cache),
`server/services/shipmentService.js` (label purchase), `server/api/shipping-quote/`
(`/api/shipping/quote`) + `server/api/shipping-label/` (`/api/shipping/label`, both AV-owned in
`customApiRoutes.js`), `server/api-util/avShipping.js` (persist helper). Client:
`CheckoutPage/shippingQuote.duck.js` (global reducer), `CheckoutPage/AVShippingSelector/` (buckets +
`AVShippingNotice` + raw list + retry/Contactar AV; `IconSpinner` passed `rootClassName` so it
replaces the icon's own 28px `.root` rather than tying on specificity),
`ShippingOriginPage` (`/account/shipping-origin`, seller origin in
`protectedData.shippingOrigin`), `ManageListingsPage/ShippingOriginBanner/` (missing-origin nudge),
`util/shippingOrigin.js` (`hasCompleteShippingOrigin`). **Watchlist:** `StripePaymentForm.js` now
hosts the selector slot + surfaces address values via `FormSpy` + gates the Pay button
(`submitDisabledExtra`); `transactionLineItems` is async.

### Tracking webhook (buyer pickup email)

`POST /api/shipping/eship-webhook` (`server/api/eship-webhook.js`) takes eShip's tracking
checkpoints, queues only `TRANSIT`/`picked_up` in PostgreSQL (migration `009`), and lets the poller
send one native buyer email; everything else is `202`-ignored and duplicates return `200`. Auth is a
shared secret presented **either** as the `X-AV-Webhook-Secret` header or `?secret=`, compared in
constant time — `requestSecretMatches` accepts whichever matches, so a stale header next to a valid
URL still delivers. Configure eShip with the header: Render/Heroku router logs and `@sentry/node`'s
`request.query_string` both persist query strings. The route 404s unless
`AV_ESHIP_TRACKING_EMAILS_ENABLED=true`, so enable the flag before saving the dashboard webhook.

Env vars: `ESHIP_API_KEY` (server secret, required to quote), `ESHIP_BASE_URL` (required; no
hardcoded default — set per env: QA `https://apiqa.myeship.co/rest` on test, production
`https://api.myeship.co/rest` live), `ESHIP_MARKUP_PCT` (optional, default `0.18`),
`ESHIP_API_DEBUG` (optional; `true` echoes the carrier error text in the `/api/shipping/quote`
response as `{ code: 'ESHIP_ERROR', detail }` — default/false keeps the opaque live response),
`SHIPPING_LABEL_OPERATOR_EMAILS` (optional; comma-separated emails allowed to retry any seller's
label — sellers can always retry their own), `ESHIP_LABEL_AUTOBUY` (optional, default `false`;
`true` auto-buys the label on `confirm-payment`, otherwise the seller buys it via the Generar guía
button), `ESHIP_WEBHOOK_SECRET` (required for the tracking email; ≥32 bytes, else the route 503s),
`AV_ESHIP_TRACKING_EMAILS_ENABLED` (default `false`). Quoting and label purchase also need the
Integration credentials (`SHARETRIBE_INTEGRATION_CLIENT_ID/SECRET`) to read seller origin and write
`metadata.avLabel`.

## Listing Form Customizations (Edit Listing Wizard)

- **Two-column grid** — only the Details panel uses `.fieldsGrid` (1fr 1fr at `--viewportMedium`,
  from the AV-owned `editListingGridAV.module.css`); every direct child spans the full row and only
  `.customField` wrappers (`DisplayOverrideField`) opt into half width. The Delivery and Location
  forms carried the same wrapper but rendered a single column with it, so they were reverted to
  pristine upstream — do not re-add a grid wrapper there.
- **Photos in Details** — when `requireListingImage(listingTypeConfig)`, the Photos step is hidden
  and a `PhotoGallerySection` (free-form, max 10, drag-reorder via `@dnd-kit`; merge logic in
  `reconcileOrderedImages.js`) goes in Details. Otherwise standalone `EditListingPhotosPanel` +
  `ImageSlot` (4 labeled slots → `publicData.imageSlots`, captions rendered by
  `ListingImageGallery.js`).
- **Original price** — `publicData.originalPrice` `{amount,currency}`, must exceed `price`; renders
  as strike-through "was" in OrderPanel + cards. Who may set it is gated by
  `configAV.canShowOriginalPrice()` (both pricing forms hide the field, and both panels drop the
  value on submit). The "must exceed" rule is enforced on every write path:
  `util/avValidators.originalPriceAbovePrice` on the two forms, and row validation in
  `bulk-import/csvParser.js` (which also normalises `$1,000.00` to a number, since the worker
  re-parses with `parseFloat`). Display still requires `originalPrice > price`, so a stored
  violation would silently never render.
- **EarningsEstimator** — fee breakdown below price input (simple price only). Fees from
  `config.earningsEstimate` (`configDefault.js`), env overrides
  `REACT_APP_PROVIDER_COMMISSION_PERCENTAGE` (10), `REACT_APP_STRIPE_FEE_PERCENTAGE` (2.9),
  `REACT_APP_STRIPE_FEE_FIXED_AMOUNT` (30¢).

## Testing Conventions

Every new AV component/page ships a co-located `.test.js`. Use `renderWithProviders` from
`src/util/testHelpers` (RTL + Redux store + router).

```js
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import '@testing-library/jest-dom';
const { screen } = testingLibrary;
```

Minimum: `AV*` components → render + props + snapshot; `*Page/` containers → smoke + snapshot;
`util/*.js` → unit tests per export; `extensions/*` → registry/detection tests. Ducks/utils → pure
unit tests. Always run `yarn test -- --watchAll=false` before declaring done.

**Gotchas (upstream v11.x merges):**

- `formatMoney(intl, money)` (`util/currency.js`) uses `new Intl.NumberFormat('en-US')` directly —
  ignores `intl`. Assert formatted strings (`'$20.00'`; negatives `-$2.00`).
- `currencyDisplay: 'narrowSymbol'` → MXN renders as `$` (not `MX$`) in en-US. Regenerate old
  snapshots (`yarn test -u`).
- `validSchemaOptions` needs `enumOptions[].option` to be a **string** —
  `{ option: '29', label: '29' }`, not numeric (silently dropped + warns).
- `ResponsiveImage` builds `srcset`, not `src`. Assert `'srcset'`; mocked variant keys must match
  the consumer's `variants` prop.
- `ProfileSettingsForm` renders `bioHeadingVendedor`/`bioHeadingTienda` per-userType (no single
  `bioHeading`, no `bioLabel` — textarea uses a placeholder).
- `Unsupported listing extended data configurations detected` warning (`configHelpers.js:874`) is
  upstream signal, not noise — fires when narrow test listingTypes don't intersect default fixtures.
  Don't broaden fixtures.

## Section Display-Option Tokens

Encode in `sectionName` as `- Token` suffixes (space-dash-space). Parsed by
`parseSectionCustomOptions()` in `extensions/pageBuilder/av/sectionStyles.js` — **never read
`sectionName` directly in section components.**

Operator-facing reference for the full set lives in `docs/operator-guide.md` §5.1.

| Token                                    | Property                                 | Effect                                                                                 |
| ---------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `- Large`                                | `isLarge`                                | Wider content area (max 1370px)                                                        |
| `- FullW`                                | `isFullW`                                | Full width, edge to edge                                                               |
| `- FullWHeader`                          | `isFullWHeader`                          | Header children span full width                                                        |
| `- ShortHero`                            | `isShortHero`                            | Reduced hero height (avHero2; consumed in SectionHeroCustom2)                          |
| `- 2/3 cols`                             | `isTwoThirdsCols`                        | One-third/two-thirds split (SectionColumns)                                            |
| `- AvFeature` / `- ReverseFeature`       | `isAvFeature` / `isReverseFeature`       | Feature layout (SectionFeatures); AvFeature also sets full-bleed in AVSectionContainer |
| `- BlueTitle` / `- WhiteTitle`           | `isBlueTitle` / `isWhiteTitle`           | Title color                                                                            |
| `- CenterTitleText` / `- CenterDescText` | `isCenterTitleText` / `isCenterDescText` | Center title / description                                                             |
| `- LargeDesc`                            | `isLargeDesc`                            | Wider description max-width                                                            |
| `- SmallerTitles`                        | `isSmallerTitles`                        | All headings down one level (H1→30/H2→20/H3→18/H4→16/H5→14px)                          |
| `- NoPaddings`                           | `hasNoPaddings`                          | Remove all paddings                                                                    |
| `- SmallGapCols`                         | `hasSmallGapCols`                        | Column/grid sections: 8px column gap (sets `--avSectionColGap`)                        |
| `- SmallGapRows`                         | `hasSmallGapRows`                        | Column/grid sections: 8px row gap (sets `--avSectionRowGap`)                           |
| `- NoGapCols`                            | `hasNoGapCols`                           | Column/grid sections: 0 column gap (sets `--avSectionColGap`)                          |
| `- NoGapRows`                            | `hasNoGapRows`                           | Column/grid sections: 0 row gap (sets `--avSectionRowGap`)                             |

**CTA tokens** (`parseSectionCtaClass`): `- SectionCtaBtn{Blue,LightBlue,Purple,Pink,Yellow}`.
**Modifiers:** `- RoundedFull`, `- Rounded`, `- Square`, `- Dashed`, `- Solid`, `- NoOutline`,
`- HeadingFont`, `- BodyFont`, `- AccentFont`, `- CtaBtnCenter`.

To add a token: add `hasToken(sectionName, 'MyToken')` in `parseSectionCustomOptions()` + a CSS
class in `AVSectionContainer` (and document it in operator-guide §5.1).

## Coding Conventions

- Sharetribe conventions: CSS Modules, functional React, Redux ducks.
- Client env vars use `REACT_APP_` prefix; server secrets do not.
- Prefer extending over overriding core template files (reduces merge conflicts).
- Always use Stripe Connect — never direct charges.
- Heroku filesystem is ephemeral — never write files to disk at runtime.
- **Translations:** AV keys go in the `src/translations/{en,es}_av.json` overlays, never in
  `en.json`/`es.json`/`de.json`/`fr.json` — those four are byte-identical to upstream and mixing AV
  keys in made every upstream translation update a conflict. `app.js` merges the overlay over
  `en.json`. Keep the two overlays symmetric and run `yarn av-translation-check`.

## Upstream File Policy

**Do not modify upstream Sharetribe files unless there is no alternative.** First ask: can this be a
custom component, config file, extension hook, or CSS override instead? Only touch upstream files
when genuinely required (new route, nav link). Keep changes minimal — add, don't rewrite.

Preferred order when an upstream component needs to behave differently:

1. **Swap at the composition root.** Copy the leaf to an `AV*` sibling, change the behaviour there,
   and repoint the parent's import (one line). Example: `OrderBreakdown.js` imports
   `AVLineItemProviderCommissionMaybe`; upstream's own `LineItemProviderCommissionMaybe.js` stays
   pristine. Worth it when the leaf diff is large; a handful of lines merges more easily inline than
   a full fork that silently misses upstream fixes.
2. **Move helper bodies to AV modules** and import them back, so the upstream file keeps a one-line
   call instead of a block (e.g. `configAV.moveListingFieldToEnd` used by `util/configHelpers.js`).
3. **Never wrap upstream JSX just for layout.** A wrapper `<div>` re-indents the whole subtree and
   makes every future upstream hunk conflict. Style the existing element from `avBrandOverrides.css`
   instead.
4. **An AV import added to an upstream file goes after that file's own import groups**, not sorted
   into them — even though that reads as out-of-order by the convention AV-owned files follow. The
   appended line sits outside the blocks upstream edits; sorted in, it sits inside one. Import-order
   sweeps are scoped to files absent from `upstream/main` for the same reason, so
   `ManageListingsPage.js`, `ProfilePage.js` and `SearchResultsPanel.js` keep their trailing
   `avGridSizes` imports deliberately. This is a decision, not an oversight — don't "fix" it.

### Deliberate forks — diff these on every upstream sync

These are option 1 taken all the way: a full copy, swapped in at the composition root, with the
upstream original left byte-identical. Upstream fixes therefore **do not** reach them automatically.
On each sync, diff the upstream original against its fork commit and hand-apply anything relevant.

| AV fork                                                      | Upstream original                        | Forked from upstream |
| ------------------------------------------------------------ | ----------------------------------------- | --------------------- |
| `PageBuilder/BlockBuilder/AVBlockDefault/AVBlockDefaultView` | `BlockBuilder/BlockDefault/BlockDefault` | `832f8d66f` (v12.1.0) |
| `PageBuilder/BlockBuilder/AVBlockFooter/AVBlockFooter`       | `BlockBuilder/BlockFooter/BlockFooter`   | `832f8d66f` (v12.1.0) |

The "forked from" SHA is a historical fact — it does not go stale. To see what upstream has changed
in the original since the fork, and hand-apply what matters:

```sh
git fetch upstream
git diff 832f8d66f upstream/main -- src/containers/PageBuilder/BlockBuilder/BlockDefault/
```

### Watchlist — high merge-conflict risk

**This table is the only watchlist under version control.** `.codex/reference/upstream-sync.md`
carries a short form of the same guidance, but `.codex/` is gitignored (`.gitignore:18`), so that
copy is machine-local: it is invisible to CI, to a fresh clone, and to anyone else's checkout, and
it drifts from this table without anything failing. Keep this table authoritative, and treat the
`.codex` copy as a local convenience that may already be stale.

Corollary: **do not describe edits to ignored paths in a commit message.** `1cfb8d6ac` says it added
three checkout files to `.codex/reference/upstream-sync.md`; its diffstat is `CLAUDE.md | 1 +`,
because the other edit was silently dropped. The message records work the repository does not
contain.

| File                                                                                    | Why touched                                                                                                     |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `components/CustomExtendedDataField/CustomExtendedDataField.js`                         | `groupedMultiSelect` + `colorGridPicker` branches                                                               |
| `components/FieldCurrencyInput/FieldCurrencyInput.js`                                   | Price inputs forced to `en-US` (`$1,325.00`) to match `formatMoney` display — was locale-dependent `1.325,00 $` |
| `util/configHelpers.js`                                                                 | Listing field merge (code wins over Console, except `brand` options — `configAV.mergeHostedBrandOptions`)       |
| `containers/SearchPage/FilterComponent.js`                                              | Custom filter type branches (delegates to `searchFilters/avFilters`)                                            |
| `containers/SearchPage/SearchPageWithGrid.js`                                           | Grouped-sizes filter injection (`injectAvFilters`)                                                              |
| `PageBuilder/SectionBuilder/SectionBuilder.js`                                          | Custom section registration + AV `blockComponents` injection                                                    |
| `CheckoutPage/CheckoutPageWithPayment.js`                                               | Default Stripe country (`configAV.defaultCountry`)                                                              |
| `CheckoutPage/CheckoutPage.module.css`                                                  | 2-column layout from `--viewportMedium` (not `--viewportLarge`) + fluid `--avCheckoutRamp` sizing               |
| `CheckoutPage/DetailsSideCard.js`                                                       | Breakdown loading overlay (`speculateInProgress`) + 4:3 image box from `avListingImage.js`                      |
| `CheckoutPage/MobileListingImage.js`                                                    | 4:3 image box from `avListingImage.js`                                                                          |
| `TopbarContainer/Topbar/Topbar.js`                                                      | Mobile bag/favorites/inbox icon group + absolutely-centred logo (`Topbar.av.module.css`); `inboxTab` gate       |
| `containers/InboxPage/InboxPage.js`                                                     | Orders tab hidden for `vendedor-tienda` (`configAV.isNavPageHiddenForUser`)                                     |
| `EditListingWizard/EditListingWizard.js`                                                | Default Stripe Connect payout country; blue "Bulk import" CTA (`NamedLink`) on new-listing flow                 |
| `EditListingWizard/EditListingWizardTab.js`                                             | `currentUser` prop drilling for pricing                                                                         |
| `EditListingWizard/EditListingDetailsPanel/EditListingDetailsForm.js`                   | Two-column grid + `PhotoGallerySection`                                                                         |
| `EditListingWizard/EditListingPricingPanel/EditListingPricing{Panel,Form}.js`           | `originalPrice` field (gated by `configAV`)                                                                     |
| `ManageListingsPage/ManageListingsPage.js`                                              | "Create listing" `NamedLink` heading                                                                            |
| `components/UserNav/UserNav.js`                                                         | Active-state expanded to all account pages; AV tabs from `useAvProfileLinks()`                                  |
| `containers/ProfilePage/ProfilePage.js`                                                 | `ListingCard` → `AVListingCard` swap                                                                            |
| `containers/AuthenticationPage/UserFieldDisplayName.js`                                 | Per-userType display-name label (store sellers)                                                                 |
| `containers/ListingPage/SectionHero.js`                                                 | `StoreTypeTags` overlay on the gallery hero                                                                     |
| `containers/ListingPage/CustomListingFields.js`                                         | Force-show the hosted-hidden `tags` field                                                                       |
| `PageBuilder/SectionBuilder/SectionColumns/SectionColumns.js`                           | `AVSectionContainer` + `2/3 cols` token                                                                         |
| `PageBuilder/SectionBuilder/SectionCarousel/SectionCarousel.js`                         | `AVSectionContainer` + `useDebouncedWindowResize`                                                               |
| `components/CustomExtendedDataSection/CustomExtendedDataSection.js`                     | Custom `color`/`all_sizes` display dispatch (key→component map)                                                 |
| `components/LayoutComposer/LayoutSideNavigation/LayoutWrapperAccountSettingsSideNav.js` | Account tabs from `getAccountSettingsTabs()` extension, fed `currentUser` from the store                        |

Also high-conflict on sync: `SearchResultsPanel.js` (AVListingCard swap), `CMSPage.js` (section
injection), `TopbarDesktop.js`/`TopbarMobileMenu.js`/`UserNav.js` (nav links),
`EditListingPricingAndStockPanel.js` (EarningsEstimator + originalPrice),
`SectionGallery.js`/`ListingImageGallery.js` (imageSlots captions), `OrderBreakdown.js`
(`extraOrderBreakdownLineItems` seam + the `AVLineItemProviderCommissionMaybe` import swap),
`OrderPanel.js` (originalPrice), `configDefault.js` (earningsEstimate),
`CheckoutPage/ShippingDetails/ShippingDetails.js` (MX-only address layout: Calle/Número
Exterior+Interior/Colonia/C.P.+Ciudad/Estado-select/Teléfono; AV `ShippingDetails.mx*` keys; states
from `config/configMxStates.js`), `CheckoutPage/StripePaymentForm/StripePaymentForm.js`
(shipping→billing copy maps colonia→line2, country→'MX'), `TransactionPage/TransactionPage.js` +
`TransactionPanel/TransactionPanel.js` (provider-only `shippingLabelSlot` for the Spec B eShip label
control). Small CSS-module forks (restyles kept inline due to scoped-class/var coupling — see the
`AV:` comments in each): `SectionContainer.module.css`, `SectionListings.module.css`,
`FilterPlain.module.css`.

**Already restored to pristine — do not re-dirty, and do not re-add to the watchlist.** Verify with
`git diff upstream/main -- <file>` before assuming any of these still carries AV code.

| Upstream file                                | Where the AV code lives now                                             |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `translations/{en,es,de,fr}.json`            | `translations/{en,es}_av.json` overlays (see Coding Conventions)        |
| `TopbarDesktop/CustomLinksMenu/*`            | `TopbarDesktop/AVLinksMenu/` (`AVCustomLinksMenu`/`AVPriorityLinks`/…)  |
| `EditListingWizard/EditListingPhotosPanel/`  | `EditListingDetailsPanel/PhotoGallerySection.js` + `reconcileOrderedImages.js` (`avPhotoSlots.js` was deleted in `016d428c2`) |
| `CheckoutPage/CheckoutPageTransactionHelpers.js` | `CheckoutPage/avMxAddress.js` (`getShippingDetailsMaybe`, `getBillingDetails`, `copyShippingAddressToBilling`) |
| `BlockBuilder/{BlockBuilder,BlockDefault,BlockFooter}` | `options.blockComponents` → `AVBlockDefault`/`AVBlockFooter`   |
| `styles/marketplaceDefaults.css`, `TabNavHorizontal.module.css` | `avBrandOverrides.css` (commit `c3bfa1b06`)           |

### Unavoidable upstream files — append AV additions at the bottom

| File                               | AV addition                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `routing/routeConfiguration.js`    | Custom page routes                                                                               |
| `containers/pageDataLoadingAPI.js` | `loadData` exports                                                                               |
| `containers/reducers.js`           | Custom page reducers                                                                             |
| `ducks/index.js`                   | `avExtension` duck                                                                               |
| `server/index.js`                  | AV-noti poller + `mountCustomApiRoutes(app)` (before `app.use('/api', apiRouter)`)               |
| `server/customApiRoutes.js`        | AV-owned: `/api/brevo`, `/api/instagram`, `/api/my-balance`, `/api/bulk-import`, `/api/shipping` |

## Deployment

- **Approved initial Live cutover:** follow `docs/operations/heroku-deployment.md`. Deploy one
  Heroku app with Sharetribe Test, Stripe test, and eShip QA; after approval, scale it down, back up
  and reset the same PostgreSQL add-on, replace every environment-bound value with Live values,
  rebuild, migrate, and reopen it as production.
- **Steady-state staging (Render.com):** Sharetribe Test, Stripe test, and eShip QA; may cold-start.
- **Steady-state production (Heroku):** Sharetribe Live, Stripe live, and eShip production. Build
  independently because `REACT_APP_*` values are compiled into the browser bundle.

## Upstream Sync

```sh
git remote add upstream https://github.com/sharetribe/web-template.git
git fetch upstream && git merge upstream/main
```

Resolve conflicts reviewing customized areas first: `src/config`, `src/components`, customized
containers, `src/extensions/`. See the Watchlist above for the highest-risk files.

## Documentation

Start with `docs/README.md`. The canonical operator source remains `docs/operator-guide.md`; current
technical guides are grouped by purpose, and unresolved work is under `docs/pending/`. Implemented
plans and resolved audit histories do not remain under `docs/`; use Git history when needed.
