# Live launch readiness

Status: open. Reviewed 2026-10-09 against `pre-release` at `0bf590fe2`.

This is the work that has to be finished **before** the go/no-go in the
[production release checklist](../operations/release-checklist.md) can start. The release checklist
and the [Heroku Test-to-Live runbook](../operations/heroku-deployment.md) still govern the cutover
itself; this file lists the gaps found in code, configuration, and third-party setup that those
documents assume are already closed. Remove each item when it is done, and delete this file when it
is empty.

Brevo hosted templates are a known missing piece and are tracked in §6.

## 1. Snapshot

| Area                   | State on 2026-10-09                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release branch         | `main` is deployed to Heroku. PR #111 (`pre-release` → `main`) merged as `f27c19cb9` on 2026-10-09; `pre-release` and `main` carry the same code.                                                                                                                               |
| Heroku app             | `archivo-vintach-marketplace`, stack `heroku-26`, one `web` Basic dyno (idle 224 MB / 512 MB), `heroku-postgresql` `essential-0` with daily backups. `www.archivovintach.com` and `archivovintach.com` attached, ACM on, DNS not yet pointed. Runbook phase: **1 (Test mode)**. |
| Heroku providers       | Sharetribe Test credentials, `pk_test_…`, eShip QA base URL.                                                                                                                                                                                                                    |
| Heroku guarded flags   | `AV_SHIPPING_LABELS_ENABLED=true` (2026-10-09, after migrations 001–009); the other six explicitly `false`. Welcome email has not been exercised on Heroku.                                                                                                                     |
| Server tests           | 54 suites / 654 tests pass.                                                                                                                                                                                                                                                     |
| Client tests           | 180 suites / 1920 tests pass with `CI=true`; a single early failure did not recur in eight later full runs (§2.3).                                                                                                                                                              |
| `config-check`         | Passes.                                                                                                                                                                                                                                                                         |
| `env-template-check`   | Passes.                                                                                                                                                                                                                                                                         |
| `av-translation-check` | Passes (336 symmetric keys).                                                                                                                                                                                                                                                    |
| `format-ci`            | Passes (the earlier 43 failures were a stale local `node_modules`).                                                                                                                                                                                                             |
| `yarn audit`           | Was 1 critical, 35 high, 48 moderate, 6 low; after the 2026-10-09 upgrade 0 critical, 1 high (install-time only), 10 moderate (§2.2).                                                                                                                                           |
| Upstream               | Fork is based on v12.1.0; `upstream/main` is v12.4.0 + 126 commits. Merge decided for **after launch** (see [pending README](README.md)).                                                                                                                                       |
| CI                     | No CI pipeline exists (`.github/` has only issue templates). Every gate is run by hand.                                                                                                                                                                                         |

## 2. Blockers — fix before the Heroku Test gate

### 2.1 Missing production configuration on Heroku

Reviewed 2026-10-09. Two findings changed the fix:

- `REACT_APP_SHARETRIBE_USING_SSL` does more than the redirect: it sets the `Secure` flag on the
  session, login-as, and identity-provider cookies (server) and on the browser SDK token cookie
  (`src/index.js`). Until it is set, auth cookies go out without `Secure`.
- `SERVER_SHARETRIBE_TRUST_PROXY=true` is the wrong value behind Heroku. The router appends the real
  client address to whatever `X-Forwarded-For` the client sent, so `true` makes `req.ip` the
  client's own value, and the env string `"1"` is read by Express as an address (trusting nothing,
  breaking `req.secure` and looping the redirect). `server/api-util/trustProxy.js` now turns a
  numeric value into a hop count, and the shared rate limiter keys on `req.ip` instead of the raw
  leftmost header it trusted before. Verified locally: with `1`, `X-Forwarded-Proto: https` serves
  and `http` redirects once.

Remaining:

Done on Heroku 2026-10-09: the trust-proxy change was deployed first, then
`REACT_APP_ENV=production`, `REACT_APP_SHARETRIBE_USING_SSL=true`,
`SERVER_SHARETRIBE_TRUST_PROXY=1`, and `REACT_APP_CSP=report` were set (runbook §3.2) and the app
rebuilt. HTTPS serves, HTTP redirects once, the SDK token cookie is `Secure`, and CSP runs in
report-only mode. Live must carry the same four values.

- [ ] Render staging: set `SERVER_SHARETRIBE_TRUST_PROXY` to Render's proxy hop count. The limiter
      now keys on `req.ip`, so without it every staging visitor shares one rate-limit bucket.
- [ ] Render staging: set `REACT_APP_SHARETRIBE_USING_SSL=true` and `AV_NOINDEX=true`, then rebuild.
      Its sitemap still advertises `http://` URLs (so its auth cookies are not `Secure` either), and
      it is fully crawlable.
- [ ] `REACT_APP_SENTRY_DSN` — create a Sentry project and set its DSN before launch; production has
      no error monitoring without it.
- [x] Brevo welcome: `BREVO_TEMPLATE_SELLER_WELCOME` (`BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME` are
      set; all three are required by `notificationConfig.js` once welcome email is on). The hosted
      template exists as ID 6 (§6); `BREVO_TEMPLATE_SELLER_WELCOME=6` set 2026-10-10.
      `BREVO_WEBHOOK_SECRET` and the seven campaign IDs wait for campaigns.
- [ ] `SHIPPING_LABEL_OPERATOR_EMAILS` — optional; set it if support staff must retry a seller's
      label.
- [ ] Optional analytics: `REACT_APP_GOOGLE_ANALYTICS_ID` or `REACT_APP_PLAUSIBLE_DOMAINS`.

Not needed: `REACT_APP_MAPBOX_ACCESS_TOKEN`. The Test Console's only listing type, `av-listing`, has
location, shipping, and pickup off, search is keyword-only, and there is no hosted map asset.
Recheck only if Live adds a location-based listing type or location search.

### 2.2 Remaining dependency advisories

Every critical/high advisory on the request path was cleared on 2026-10-09 (`multer` 2.4.0,
`adm-zip` 0.6.1, `compression` 1.8.2, `proxy-addr` 2.0.8, `path-to-regexp` 8.4.2/1.9.0, `axios`
1.20.0, `sharetribe-flex-sdk` 1.24.2 with `js-cookie` 3, `qs` 6.16.0, `csv-parse` 7). Express stays
on 5.2.1, and `@babel/runtime` on 7.29.7, because their newest releases were under two weeks old.
`yarn audit --groups dependencies` now reports 1 high and 10 moderate:

- `braces` (high, no patched release) reaches production only through `patch-package`, which runs at
  install time. Nothing to do until upstream publishes a fix.
- Seven `@opentelemetry/*` packages (moderate) come from `@sentry/node` 10. The fix is Sentry 11, a
  major upgrade that upstream v12.4.0 already made; take it with the post-launch upstream merge (see
  [pending README](README.md)) rather than separately.

The upgraded upload path (`multer`, `adm-zip`, `csv-parse`) was confirmed on 2026-10-09 with a real
ZIP and a bare-CSV import on the Heroku Test-mode app.

### 2.3 Repository gates

Closed on 2026-10-09: `yarn format-ci` passes (the 43 failures came from a stale local
`node_modules`, not the repository); the one-off client failure did not recur in eight full runs and
coincided with a still-running watch-mode Jest, so it is treated as contention; and `.env.test` no
longer carries the Stripe key (it lives in `.env.test.local`) or the forbidden `REACT_APP_BREVO_*`
names. The listings-sheet proposal is committed, and the untracked
`docs/reference/{email,marketplace}-texts-es_OLD.json` copies were deleted (both are byte-identical
to blobs already in Git history). `pre-release` was pushed, PR #111 ("Release: pre-release → main")
merged into `main` as `f27c19cb9`, and Heroku redeployed from `main`. Nothing in this section
remains open.

## 3. Sharetribe Live environment

Nothing is copied automatically from Test. Users, listings, transactions, and Stripe accounts never
move. Once Live has a Marketplace API client ID, check every Console item below at once with
`yarn run config:compare <testClientId> <liveClientId>` (`scripts/compare-hosted-config.js`; public
client IDs only, read-only). Branding image URLs and page listing/user IDs are expected to differ;
anything else is a setup gap.

Verified or prepared in Test on 2026-10-09:

- **Commission is 22 %**, not 10 % (Test `commission.json`). The earnings estimator reads it from
  Console; the code fallback is now 22 % too. The \$20 minimum still covers the \$15 fee (floor
  \$19.24).
- **User types** are `vendedor` and `vendedor-tienda` only; there is no buyer type.
- **Search schemas:** `color` and `all_sizes` (code-defined, shown as search filters) and
  `avPlaceholderImage` had **no schema**, so the Marketplace API silently ignored those filters and
  returned every listing. Created in Test; color/size filters now narrow results (e.g. 281 → 30).
  The `userType` user schema is created by Console automatically.
- **`default-purchase`** in Test (v3) matched the repository exactly. Upstream v12.4.0's five
  purchase-template fixes were applied to the repository (now byte-identical to upstream), including
  the reminder date's `YYYY` → `yyyy` week-year bug, pushed to Test as **v4**, and `release-1` moved
  to it.
- **Email texts reference** corrected: all 36 `YYYY` date skeletons, `rechazó to` → `rechazó tu`,
  and two operator-declined texts that said _aceptó_.
- **Marketplace texts reference** re-reconciled with Test (2,008 keys).

Remaining (Console or owner actions):

- [ ] Sharetribe subscription is on a plan that permits Live, and the Live environment is opened.
- [ ] Marketplace settings: name, Marketplace URL (production domain), localization (`es`, `MXN`,
      first day Monday), branding (logo, favicon, colours, social share image), and the
      outgoing-email sender and reply-to mailbox. The dispute acknowledgement relies on replies
      reaching a monitored Archivo Vintach mailbox.
- [ ] User types `vendedor` ("Persona") and `vendedor-tienda` ("Tienda"); user fields `tipoTienda`
      (private enum) and `localDesign` (metadata enum), both limited to `vendedor-tienda`. Keep the
      phone field out — WhatsApp is release-locked.
- [ ] Listing type `av-listing` → `default-purchase/release-1`, unit type `item`, stock enabled;
      location, shipping, and pickup off.
- [ ] Categories (5 top-level, 150 total) and Console listing fields (`genero`, `brand`, `estado`,
      `estilo`, `temporada`, `tags`) exactly as in Test. Bulk-import option keys in the operator
      guide §8.5 must match Live.
- [ ] **`tags`: turn on "include in search" (indexForSearch) in Console, in Test and Live.** It is
      off, so the `pub_tags` query behind the tag carousels and the Hot List (`av-tag-listings`) is
      ignored and those sections show arbitrary listings. The CLI cannot change a Console-owned
      field.
- [ ] `transactions/commission.json` **22 %** and **Minimum transaction size `$20.00`** (`2000`
      subunits), as in Test.
- [ ] Push the process to Live and create its alias (confirm the Live marketplace ID in Console →
      Build → Advanced; Test is `archivovintach-test`):

      ```sh
      flex-cli process create --process default-purchase \
        --path ext/transaction-processes/default-purchase -m LIVE_ID
      flex-cli process create-alias --process default-purchase --alias release-1 --version 1 -m LIVE_ID
      ```

      If Live already has a `default-purchase`, use `process push` and `update-alias` to the new
      version instead. Push `default-inquiry`/`default-negotiation`/`default-booking` only if a
      listing type uses them.

- [ ] Search schemas in Live:

      ```sh
      flex-cli search set --key color --scope public --type multi-enum --schema-for listing -m LIVE_ID
      flex-cli search set --key all_sizes --scope public --type multi-enum --schema-for listing -m LIVE_ID
      flex-cli search set --key avPlaceholderImage --scope public --type boolean --schema-for listing -m LIVE_ID
      ```

- [ ] Marketplace texts: paste
      [`marketplace-texts-es.json`](../reference/marketplace-texts-es.json).
- [ ] Email texts: paste the corrected [`email-texts-es.json`](../reference/email-texts-es.json)
      into Live **and re-paste it into Test** (Test still has 19 `YYYY` values). Send previews with
      `flex-cli notifications send` for each purchase template.
- [ ] Content pages: landing, `acerca-archivo-vintach`, `como-funciona`, `como-vender-persona`,
      `contacto`, `faqs`, **terms of service**, and **privacy policy** (must cover Brevo marketing
      consent, Stripe, and eShip address sharing), plus footer and top bar. Test UUIDs do not exist
      in Live, so the hand-picked sections must be rebuilt after real listings exist.
- [ ] Fix Test's landing page, which has 8 references that no longer resolve: 3 listings in
      `av-selections-nuevo-drop` (`69e27e64…`, `69e25c40…`, `69e27942…`), 3 in
      `av-selections-favoritos` (`69e25a4d…`, `69e25b5e…`, `69e25b9d…`), and 2 users in
      `av-selected-users-closets-destacados` (`69e25982…`, `69eb22db…`). A listing that is closed
      rather than deleted also reports as missing.
- [ ] Marketplace API application (client ID + secret) and Integration API application, both from
      **Live**.
- [ ] Social login (Google, Facebook): production apps, Live callback URLs on the production domain.
- [ ] At least one operator admin account and the `BULK_IMPORT_OPERATOR_EMAILS` /
      `SHIPPING_LABEL_OPERATOR_EMAILS` users created in Live.
- [ ] Run `yarn run config:compare <testClientId> <liveClientId>` and resolve every unexpected
      difference.

## 4. Stripe

Checked in code on 2026-10-09: Mexico is a supported Connect country (`configStripe.js`, `MXN`),
payout onboarding defaults to `MX` (`configAV.defaultCountry`), Test localization is `MXN`, and
Heroku still carries `pk_test_…` as it should until cutover. The earnings estimator for `av-listing`
(stock-managed products, `EditListingPricingAndStockForm`) shows only the 22 % + \$15 commission and
never deducts a Stripe fee — correct, because the platform pays Stripe out of its commission. The
US-style `REACT_APP_STRIPE_FEE_*` defaults reach only the unused booking form.

- [ ] Stripe platform account fully activated for live payments in Mexico (business details, bank
      account, Connect platform profile and branding).
- [ ] Live secret key entered in Sharetribe **Live** Console; `pk_live_…` set on Heroku only at
      cutover.
- [ ] Connect onboarding tested with a real MX seller and the payout schedule confirmed.
- [ ] Finance confirms platform margin per sale covers Stripe's Mexico processing fee on the full
      charge, shipping included (the platform, not the seller, pays it).
- [ ] Confirm the Stripe API version Sharetribe Live uses (`flex-cli stripe update-version` only if
      Sharetribe asks).

## 5. eShip

Checked on 2026-10-09:

- QA still identifies a quotation by `object_id` (no `quot_id`) and each rate by `rate_id`; a CDMX →
  Guadalajara quote through `server/api-util/eshipClient.js` returned four Estafeta/FedEx rates.
- The production base URL `https://api.myeship.co/rest` is live (`POST /quotation` without a key
  returns `401`).
- Migrations 001–009 were run on Heroku's Test database (idempotent; readiness had shown
  `migrated: false` only because it skips the database check while no database-backed feature is on,
  and part of the schema already existed) and `AV_SHIPPING_LABELS_ENABLED=true` set. Readiness now
  confirms the schema and returns `200` with one poller leader and no poll errors.
  `ESHIP_LABEL_AUTOBUY` stays `false`, so **Generar guía → Descargar guía** can now be tested
  against QA.

Remaining:

- [ ] Test **Generar guía → Descargar guía** on Heroku against QA with a paid test order.
- [ ] Production API key and `ESHIP_BASE_URL=https://api.myeship.co/rest`; `ESHIP_API_DEBUG` unset.
- [ ] Re-run the quote check with the production key and confirm `object_id`/`rate_id` and real
      (non-`TEST`) rates.
- [ ] eShip production wallet funded; billing owner named.
- [ ] Confirm the buyer markup: `ESHIP_MARKUP_PCT` is unset, so the code default **18 %** applies.
- [ ] Every launch seller has a complete shipping origin (`/account/shipping-origin`).
- [ ] New production `ESHIP_WEBHOOK_SECRET`; production dashboard webhook with the
      `X-AV-Webhook-Secret` header — only after `AV_ESHIP_TRACKING_EMAILS_ENABLED=true`.
- [ ] Approve or replace the cancellation/refund policy and name owners ([pending eShip](eship.md)
      §1). Launch can proceed with `ESHIP_LABEL_AUTOBUY=false`, but the first real cancellation
      needs an owner.
- [ ] IVA treatment remains open ([pending eShip](eship.md) §2); confirm finance accepts launching
      with the markup buffer.

## 6. Email (Brevo + Sharetribe native)

Audited 2026-10-09; full state and the step-by-step procedure are in the
[Brevo guide](../integrations/brevo.md#setup-status-audited-2026-10-09). In short: Heroku now uses a
key from a dedicated ARCHIVO VINTACH Brevo account (free plan, 300 sends/day) with list 7 "Test
ArchivoVintach" for the Test phase (6 "Live ArchivoVintach" at cutover); the footer newsletter works
and was verified on Heroku on 2026-10-10. `archivovintach.com` is authenticated (DKIM + DMARC green)
and the sender `hola@archivovintach.com` is active. The seller welcome (template 6) is on, the
transactional webhook is wired, and readiness passes (2026-10-10). End-to-end tests passed (A9,
Heroku v36). Inventory recorded (A10). The old Retop MX key that leaked through the Render bundle
was deleted on 2026-10-10.

- [x] Sending identity decided: `hola@archivovintach.com` on a dedicated ARCHIVO VINTACH account.
- [x] Test-phase list: `BREVO_LIST_ID=7` ("Test ArchivoVintach"); a Heroku footer signup reached it
      (2026-10-10).
- [x] Brevo account owner confirmed (Brevo guide decision 2; recorded in the A10 inventory).
- [x] Welcome step 3 updated for eShip (shipping origin, prepaid guía, 7 days) in template 6 (Brevo
      guide decision 6, 2026-10-10).
- [x] Phase A1–A2: `archivovintach.com` authenticated through GoDaddy DNS (DKIM + DMARC) and the
      sender `hola@archivovintach.com` is active (2026-10-09); a test send passed SPF, DKIM and
      DMARC in Gmail (2026-10-10).
- [x] Phase A3: Heroku key replaced; the old Retop MX key that leaked through the Render bundle was
      deleted (2026-10-10).
- [x] Phase A5: seller welcome template created and active as ID 6 (2026-10-10, via API). Still to
      do: a test send from the Brevo editor, and deleting the empty draft ID 5.
- [x] Phase A7: `BREVO_TEMPLATE_SELLER_WELCOME=6` set and `AV_NOTIFICATIONS_ENABLED` plus
      `AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED` turned on (2026-10-10, v33–v34).
- [x] Phase A6: transactional webhook ID 2241911 created with its header secret; it matches Heroku
      `BREVO_WEBHOOK_SECRET` (2026-10-10).
- [x] Phase A8: readiness verified — `/api/brevo/health` ready and enabled, readiness `200`, webhook
      rejects requests without the secret (`401`), poller logs clean (2026-10-10).
- [x] Phase A9: end-to-end tests passed on Heroku v36 (2026-10-10). Covered: the welcome to both
      seller types, the footer signup, the signup opt-in, Contact Details opt-in and opt-out, and
      Inbox delivery with SPF/DKIM/DMARC passing in Gmail and Outlook. The JSON-body bug that had
      blocked the opt-in is fixed in PR #112.
- [x] Phase A10: inventory recorded outside the repository (2026-10-10). Owner, key name, mailbox
      readers and domain holder confirmed. Domain renews 2027-10-22; confirm auto-renew.
- [ ] At cutover (Phase A11): `BREVO_LIST_ID=6` ("Live ArchivoVintach"), webhook URL moved to
      `www.archivovintach.com`.
- [ ] Sharetribe Live outgoing email uses the production domain (separate from Brevo), with the same
      visible sender name and reply-to mailbox as Brevo's `hola@archivovintach.com` sender (Brevo
      guide, "Which system sends which email").
- [ ] Campaigns (Phase B: seven templates, capacity, smoke tests) wait until after launch;
      `AV_BREVO_CAMPAIGNS_ENABLED` stays `false`.

## 7. Heroku and domain

Checked and prepared on 2026-10-09:

- **Backups work on `essential-0`**: `pg:backups:capture` completed (`b001`, `b002`), and a daily
  backup is now scheduled at 04:00 America/Mexico_City (none existed). The schedule belongs to the
  add-on, so it carries into Live. Database: PG 18.3, 8.6 MB of 1 GB, 0/20 connections.
- **Memory**: `log-runtime-metrics` is on. After warm-up the Basic dyno idles at **224 MB of 512
  MB**; no R14/R15 in recent logs. Decision: keep Basic and monitor. Worst case is three concurrent
  admin imports (each up to a 50 MB ZIP plus 100 MB extracted), which would exceed the quota; Basic
  also has no preboot, so every deploy drops in-flight imports.
- **Domains**: `www.archivovintach.com` (canonical) and `archivovintach.com` are attached and ACM is
  enabled. DNS is at GoDaddy (`domaincontrol.com`), which has no ALIAS/ANAME, so `www` is a CNAME to
  Heroku and the apex is forwarded to it (runbook §4 step 9 and §5.7). Today both still serve the
  GoDaddy placeholder site, with HSTS `includeSubDomains`.
- **Instagram**: the feed works on Heroku (12 posts); the stored token expires 2026-11-28 and
  auto-refreshes under 20 days. `INSTAGRAM_ACCESS_TOKEN` is an older seed than the stored token, so
  the runbook (§5.2) now copies the stored token into it before `pg:reset`.

Remaining:

- [ ] Run the Heroku Test gate in full (release checklist §2). Migrations, readiness, and poller
      leadership are verified; welcome email and the manual label flow are not yet.
- [ ] Watch `sample#memory_total` and R14 during a large bulk import; revisit Standard-2X (1 GB,
      preboot) or a lower concurrent-import cap if it nears 512 MB.
- [ ] At cutover, point GoDaddy DNS as in runbook §5.7: `www` CNAME to its `heroku domains` target,
      apex forwarding to `https://www.archivovintach.com` over HTTPS, MX/SPF untouched. Confirm
      `heroku certs:auto` shows `www` issued.
- [ ] Set `REACT_APP_MARKETPLACE_ROOT_URL=https://www.archivovintach.com` and the Sharetribe Live
      Marketplace URL to match, before the Live build.
- [x] DMARC record added (`_dmarc.archivovintach.com`, `p=none`) with the Brevo domain (§6, Brevo
      guide step A1). Re-check it when adding Sharetribe's Live sending-domain records.
- [ ] Before `pg:reset`, carry the Instagram token across (runbook §5.2), or mint one if Live uses a
      different account.

## 8. Content, SEO, and operations

Checked and fixed on 2026-10-09:

- **Indexing.** Render staging is crawlable (normal `robots.txt`, `http://` sitemap) — the earlier
  belief that it was not came from a cold-start placeholder — and so is the Heroku Test app. After
  cutover the `*.herokuapp.com` name would also stay reachable as a duplicate of `www`. New
  `server/api-util/searchIndexing.js` (mounted in `server/index.js` before `/robots.txt`) sends
  `X-Robots-Tag: noindex, nofollow` and a `Disallow: /` robots file when `AV_NOINDEX=true` or when
  the request host is not the `REACT_APP_MARKETPLACE_ROOT_URL` host. Verified locally for the
  canonical host, the herokuapp host, and the flag.
- **Structured data.** The Organization `sameAs` list was empty because `siteFacebookPage` and
  `siteInstagramPage` were `null`; both now carry the profiles the hosted footer already links.
  There is no X/Twitter account, and TikTok is not part of that schema. The other SEO tags (title,
  Open Graph, Twitter card, 1200×800 share image, favicons, manifest, canonical) are present.
- **Bulk-import samples.** `NEOCHILANGO.zip`, `ZIP_CARGA_MASIVA.zip`, `PLANTILLA_CARGA_MASIVA.csv`,
  and both `docs/data` test CSVs parse cleanly and use only option keys that exist in Test.
- **Operator guide §8.5** told operators to type values that do not exist: categories
  `home_antiques` and `ropa-debano` (Test: `home-antiques`, `ropa-de-bano`), and temporada display
  names such as `Otoño` (keys are `otono`, …, plus the missing `todo-el-ano`). Bulk import stores
  such values as typed, so those listings fall outside their category and filters. The category
  table is regenerated from Test (150 ids; it lacked 46, mostly level 3) and the temporada table
  corrected. The local generator (`.claude/commands/scripts/generate_bulk_import.py`, untracked) had
  the same category errors plus non-existent sizes (`mx_36`, `curvy_6x`); fixed, and a 100-row
  sample now validates.

Remaining:

- [x] Deployed 2026-10-09 with `AV_NOINDEX=true` on Heroku: `robots.txt` is `Disallow: /`, every
      response carries `X-Robots-Tag: noindex, nofollow`, and `sameAs` lists both profiles.
- [ ] At cutover remove `AV_NOINDEX` (runbook §5.4); the herokuapp host stays noindexed on its own.
- [ ] Render: `AV_NOINDEX=true` (see §2.1).
- [ ] Console (Test and Live): write a real Spanish meta description for the landing page — it is
      currently `Archivo Vintach Marketplace` — and remove the trailing space in the footer's TikTok
      URL.
- [ ] Spanish shareable operator guide is still a draft (see [pending README](README.md)); decide
      whether operators get the English edition at launch.
- [ ] Assign the launch roles from the runbook §1 (operator, approver, rollback owner, monitoring
      owner) and the observation window.

## 9. Documentation drift found in this review

All corrected on 2026-10-09; nothing in this section remains open.

- `CLAUDE.md` listed Node `>=18.20.1 <23.2.0`. `engines.node` is now pinned to `24.x` because Heroku
  warns on upstream's wide `^22.22.0 || >=24.0.0` range and caps it at the active LTS anyway.
- The release checklist, runbook, and `CLAUDE.md` ran `yarn test-ci` without `CI=true`. Locally that
  leaves the client half in Jest watch mode, which only runs tests for changed files and never exits
  — the client tests were silently skipped. All now say `CI=true yarn test-ci`, and `format-ci` /
  `av-translation-check` joined the code gate.
- `.env-template` labelled `INSTAGRAM_ACCESS_TOKEN` with the WhatsApp comment; it now explains that
  the variable is only the seed for the Postgres-stored, self-refreshing token.
- Commission was documented as 10 %; Console charges **22 %** (operator guide, `CLAUDE.md`, code
  fallback, this checklist).
- A `comprador` user type was documented (operator guide §14.3, runbook, this checklist); Console
  has only `vendedor` and `vendedor-tienda`. `vendedor-stock` remains as a legacy value in the
  original-price rule only.
- Operator guide §8.5 gave category ids and temporada values that do not exist (§8 above); the
  category table is now generated from Test.
- The operator guide did not say the Hot List needs `tags` to be searchable, and §9 did not cover
  HTTPS, proxy hops, CSP, or `AV_NOINDEX`; both added.
- This checklist itself first claimed Render staging was not indexable and that Heroku's database
  had never been migrated; both came from misread signals (a cold-start page, and a readiness check
  that skips the database while it is not required) and are corrected in §5 and §8.

A sweep for broken relative links in `docs/`, `CLAUDE.md`, and `README.md`, and for environment
variables documented but unknown to the code or `.env-template`, found none.
