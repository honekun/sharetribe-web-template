# Live launch readiness

Status: open. Reviewed 2026-10-09 against `pre-release` at `0bf590fe2`; re-checked 2026-10-10
against `pre-release` at `94c6e320d`; re-checked 2026-10-15 after the Live cutover, against `main`
at `cdb36026c`, the public Heroku and Render endpoints, and both hosted Console configurations.

**Production is deployed but not signed off.** Heroku was converted to Sharetribe Live on 2026-10-12
and serves `https://www.archivovintach.com`. Render is the Test environment. This file lists the
gaps that block the Live validation sign-off: the Render Test gate (release checklist §2) and the
Live smoke gate (§5). The cutover itself is recorded in the
[Heroku runbook](../operations/heroku-deployment.md). Remove each item when it is done, and delete
this file when it is empty.

Brevo campaign templates are a known missing piece (post-launch, §6).

## 0. Finalization tracker (2026-10-15)

Every open item across `docs/`, in the order it should be closed. Details are in the linked
sections. **Owner** is who can act: _Console_ (Sharetribe Console), _Ops_ (Heroku/Render/DNS
dashboards), _Dev_ (repository), _Business_ (decision or sign-off).

### A. Release mechanics

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                      | Owner | Where            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------- |
| A3  | ✅ Code gate re-run on `pre-release` at `df0cd65e6` (tree `978e54f70`, the Talla filter fix; the last code change) on 2026-10-19: server 61 suites / 782 tests, client 190 suites / 1,999 tests / 168 snapshots, `format-ci`, `av-translation-check`, `config-check`, `env-template-check`, `build`. No migrations since `009`; the Brevo fixes (PRs #133–#134) are server-only, and the filter fix restores labels operators already expect. Later commits are docs only. Re-run if the candidate changes. | Dev   | checklist §1     |
| A4  | Rebuilt 2026-10-16: v50 set `REACT_APP_GOOGLE_ANALYTICS_ID`, v51 deployed `main` at `08db5ebf8` (bundle `main.9ab84f88.js`). Verified: `pk_live_` and the Live client ID only, the #118 bag fix, the GA ID; one web dyno; readiness `200` with an active poller owner; no `CSP:` or 5xx log lines (only C1's landing 404s). v52 deployed `main` at `f6cde567b` (PR #128, bulk-import value validation; bundle `main.ad24b9f3.js`) the same evening: clean boot, poller leadership acquired, readiness and `/api/bulk-import/template` `200`, no 5xx. v53 (2026-10-19, `cdc6bcdce`) was docs only, same bundle. v54 set the seven `BREVO_TEMPLATE_*` IDs. v55 deployed `b9a8693b6` (PR #133, webhook unlinks suppressed addresses from the Brevo list) and v56 `6cb1ac358` (PR #134, re-consent clears Brevo's transactional block; verified on Live with TEST STORE): both server-only, same bundle, clean boot, poller leadership acquired, readiness `200`, no 5xx. v57 deployed `main` at `c37b994d8` (PR #135, the Talla filter fix; bundle `main.639f579a.js`) and v58 set `ESHIP_MARKUP_PCT=0` (2026-10-19): clean restarts, poller leadership reacquired, readiness `200`, bundle with `pk_live_`, the Live client ID and GA only, no 5xx, H-code, R14 or `CSP:` lines; on `www` the Talla dropdown shows its 6 labelled groups and 56 sizes, and M returns 10 results (the API agrees). Record **v58** as the first known-good Live release once §5 passes; roll back only to v49, v51–v58, never past v48. | Ops   | checklist §4, §5 |

### B. Render Test gate — must pass before Live sign-off

✅ Passed 2026-10-16: every item in release checklist §2 is ticked, and neither Render's nor
Heroku's logs contain a `CSP:` violation line.

### C. Live content and configuration (Console) — fix before announcing

✅ Closed 2026-10-18: every item is done, accepted as is, or moved to after launch (F). C5, the
Live outgoing email, was the last: Sharetribe sends through SendGrid from the verified
`archivovintach.com` domain, and Live previews passed SPF, DKIM and DMARC with the set sender and
reply-to.

### D. Live configuration to confirm (not readable from outside)

✅ Closed 2026-10-19. D2, D3 and D5 were confirmed by the operator and Fernanda, D6 is recorded
(boot logs clean; the cutover `web=0` happened but was not recorded), and D1 and the launch roles
moved to F. D4 was the last: after the Live Console got its Google identity provider, a Google
sign-up created a Live account (`Alejandro C`); the Facebook IdP entry and Heroku variables are set,
and a Facebook sign-in is part of E1.

### E. Live smoke and sign-off (release checklist §5)

| #   | Item                                                                                                                                               | Owner    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E1  | Login, search, and CMS pages on `www`. **Done 2026-10-18/19:** home, the six CMS pages, terms, privacy, `/login`, `/signup`, a profile, a listing page, sitemap and `robots.txt` serve SSR in ~0.5 s; search filters return the expected counts (30 all, 22 `yiknal`, 27 `ropa`, 5 `invierno`, 10 `negro`); Google sign-up and sign-in work. The **Talla** filter showed blank size groups and options (a regression from `00aa95edf`, 2026-06-24); fixed in `df0cd65e6` and verified locally: 6 labelled groups, 56 options, selecting M filters to `pub_all_sizes=has_any:m`. Re-checked on `www` at v57. Email/password login works (TEST STORE, 2026-10-19). **Left:** a Facebook sign-in. Content follow-up (not a gate): the About, Terms and Privacy page titles are still in English. | Ops      |
| E2  | One real seller with real Stripe Connect onboarding and a complete shipping origin; one approved listing. **Blocked 2026-10-20:** Stripe refuses to create live connected accounts until the Connect platform profile is completed (§4). | Business |
| E3  | One approved low-value purchase with a production eShip quote; verify order math, retained shipping fee, payout, `avShipping`. Run by the client with a real buyer; with `ESHIP_MARKUP_PCT=0` the buyer's shipping is the carrier rate rounded up to the peso. | Business |
| E4  | Buy and download the production label manually; record the carrier charge and compare it with the shipping the buyer paid (with no markup, this is the IVA check: [pending eShip](eship.md) §2). | Ops      |
| E5  | Welcome email and built-in Sharetribe emails use the production sender and `www` links; dispute reply with an image reaches the monitored mailbox. | Ops      |
| E6  | Approved refund/cancellation test; reconcile the label separately. Run and owned by the client, who also owns the eShip cancellation policy ([pending eShip](eship.md) §1). | Business |
| E7  | Record evidence and sign-off: Alex approves the tests the AV team runs, the client approves the tests they run and gives the overall launch approval (2026-10-19). Then start the post-launch observation window (checklist §6). | Business |

### F. After launch (does not block sign-off)

Fill the Live landing's Nuevo Drop, Favoritos and Closets Destacados sections with Live listings
and users, and tag Hot List / ofertas listings (§3); legal review of the terms of service and
privacy policy (Brevo consent, Stripe, eShip address sharing; §3); real photos for the 22 Live Yiknal
listings, which still show the bulk-import placeholder (their values and categories were fixed in
place on 2026-10-17; the seller replaces the photo in each listing's edit form); the Live
operator/admin account and the `BULK_IMPORT_OPERATOR_EMAILS` / `SHIPPING_LABEL_OPERATOR_EMAILS`
users (§2.1, §3); Sentry error monitoring (`REACT_APP_SENTRY_DSN` and a rebuild, §2.1); the
launch roles from the runbook §1 (operator, independent approver, rollback owner, monitoring owner)
and the observation window (§8, checklist §4); real `TRANSIT` webhook test and enabling tracking emails on Live (checklist §5, eShip §5.3); Brevo
campaigns (Phase B; templates 7–13 active with the approved footer since 2026-10-19); eShip cancellation policy (owner: the client) and IVA ([pending eShip](eship.md)); WhatsApp
WA-01–08 ([notifications](notifications.md)); upstream v12.4.0 merge and Sentry 11; Spanish
shareable operator guide; per-seller commission override; bulk-import scaling
([scaling](scaling.md)); listings-sheet and bidding decisions.

## 1. Snapshot

| Area                   | State (re-checked 2026-10-15)                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release branch         | Heroku **v48** runs `cdb36026c` (PR #114), the Live build (2026-10-12; docs-only changes from the Test-mode v36). `main` is now `cd843da16` (PR #115, bulk-import fix), not yet on Heroku.                                                                                                        |
| Heroku app (Live)      | `archivo-vintach-marketplace`, stack `heroku-26`, one `web` Basic dyno, `heroku-postgresql` `essential-0` with daily backups (`b007` is the last Test backup). Serves `https://www.archivovintach.com`; apex `301` to `www`. Runbook phase: **cutover done, Live validation pending**.            |
| Heroku providers       | Sharetribe Live credentials (v42), `pk_live_…` in the bundle (v38), eShip production key and base URL (v39–v40), enforcing CSP (v47), `AV_NOINDEX` removed (v46).                                                                                                                                 |
| Heroku guarded flags   | Notifications, shipping labels, and welcome email on (v49); campaigns, tracking emails, and WhatsApp off. Readiness `200`, `migrated: true`, one poller owner, no deliveries or labels yet, no Test rows (2026-10-15).                                                                            |
| Render app (Test)      | `https://archivo-vintach.onrender.com/`, `pk_test_…`, `AV_NOINDEX` in effect. New Postgres `archivovintach_v102026` migrated 001–009 and redeployed (2026-10-15): readiness `200`, one poller owner, `/api/brevo/health` `200`. Welcome email and tracking emails on; campaigns and WhatsApp off. |
| Hosted config          | `config:compare` Test → Live: all 23 assets identical (2026-10-15).                                                                                                                                                                                                                               |
| Server tests           | 59 suites / 738 tests pass (`CI=true yarn test-server`, 2026-10-16, `pre-release` at `741187829`).                                                                                                                                                                                                |
| Client tests           | 187 suites / 1978 tests / 168 snapshots pass with `CI=true` (2026-10-16, `741187829`).                                                                                                                                                                                                            |
| `config-check`         | Passes (2026-10-16).                                                                                                                                                                                                                                                                              |
| `env-template-check`   | Passes (2026-10-16).                                                                                                                                                                                                                                                                              |
| `av-translation-check` | Passes (342 symmetric keys, 2026-10-16).                                                                                                                                                                                                                                                          |
| `format-ci`            | Passes (2026-10-16). `yarn run build` also passes.                                                                                                                                                                                                                                                |
| `yarn audit`           | Was 1 critical, 35 high, 48 moderate, 6 low; after the 2026-10-09 upgrade 0 critical, 1 high (install-time only), 10 moderate (§2.2).                                                                                                                                                             |
| Upstream               | Fork is based on v12.1.0; `upstream/main` is v12.4.0 + 126 commits. Merge decided for **after launch** (see [pending README](README.md)).                                                                                                                                                         |
| CI                     | `.circleci/config.yml` runs `format-ci`, `test-ci`, `build`, `av-translation-check`, and `env-template-check` on Node 24, but no check reported on PR #116 (2026-10-16), so CircleCI is not yet connected to the repository. Until it reports on PRs, every gate is run by hand.                  |

## 2. Blockers — configuration

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

- [x] Render staging: `SERVER_SHARETRIBE_TRUST_PROXY=3` since 2026-10-16. Render puts Cloudflare and
      an internal proxy in front of the app, so the client is the third hop. Measured by posting an
      empty body to `POST /api/brevo/engagement` (it `400`s after the rate limiter records `req.ip`)
      and reading `av_rate_limit.identifier`, with no `X-Forwarded-For` and with a forged two-entry
      one: the old value trusted the forged leftmost entry; `1` gave Render-internal `10.x`
      addresses; `2` gave Cloudflare addresses; `3` gave the real client address for all three
      requests.
- [x] Render staging: `REACT_APP_SHARETRIBE_USING_SSL=true` and `AV_NOINDEX=true` are in effect
      (verified 2026-10-10 from outside): canonical, `og:url`, and the sitemap index use `https://`,
      `http://` answers `301`, every response carries `X-Robots-Tag: noindex, nofollow`, and
      `robots.txt` is `Disallow: /`.
- [ ] `REACT_APP_SENTRY_DSN` — create a Sentry project and set its DSN on Heroku (a rebuild is
      needed); production has no error monitoring without it. The Live bundle has no Sentry DSN
      (2026-10-15). Moved to after launch (§0 F, 2026-10-19).
- [x] Brevo welcome: `BREVO_TEMPLATE_SELLER_WELCOME` (`BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME` are
      set; all three are required by `notificationConfig.js` once welcome email is on). The hosted
      template exists as ID 6 (§6); `BREVO_TEMPLATE_SELLER_WELCOME=6` set 2026-10-10.
      `BREVO_WEBHOOK_SECRET` and the seven campaign IDs wait for campaigns.
- [ ] `SHIPPING_LABEL_OPERATOR_EMAILS` — optional; set it if support staff must retry a seller's
      label.
- [x] Optional analytics: `REACT_APP_GOOGLE_ANALYTICS_ID` set at v50; the Live bundle and page
      carry `G-TKT6Q39QEG` (2026-10-18).

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
move. Check every Console item at once with `yarn run config:compare <testClientId> <liveClientId>`
(`scripts/compare-hosted-config.js`; public client IDs only, read-only; take them from the Render
and Heroku bundles). Branding image URLs and page listing/user IDs are expected to differ; anything
else is a setup gap.

Checked 2026-10-15: all 23 assets are **identical**, including the landing page. That confirms the
Console copy, and it also means Test's open content defects are now in Live too: the landing page
references Test listings and users, its meta description is still the placeholder, the email texts
still carry 36 `YYYY` skeletons, and `tags` is still not searchable (each listed below).

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

- [x] Sharetribe subscription is on a plan that permits Live, and the Live environment is opened.
- [x] Localization and branding match Test (`config:compare`, 2026-10-15).
- [ ] Marketplace settings not covered by `config:compare`: name, and the outgoing-email sender and
      reply-to mailbox. The dispute acknowledgement relies on replies reaching a monitored Archivo
      Vintach mailbox. The site address itself comes from `REACT_APP_MARKETPLACE_ROOT_URL` (custom
      code); confirm that Live's built-in emails link to `https://www.archivovintach.com`.
      Sender and reply-to set on 2026-10-18 (§6); the name, the `www` links and a reply reaching the
      mailbox are checked with E5.
- [x] User types `vendedor` ("Persona") and `vendedor-tienda` ("Tienda"); user fields `tipoTienda`
      (private enum) and `localDesign` (metadata enum), both limited to `vendedor-tienda`. Keep the
      phone field out — WhatsApp is release-locked. (Identical to Test, 2026-10-15.)
- [x] Listing type `av-listing` → `default-purchase/release-1`, unit type `item`, stock enabled;
      location, shipping, and pickup off. (Identical to Test; the alias itself is checked below.)
- [x] Categories (5 top-level, 150 total) and Console listing fields (`genero`, `brand`, `estado`,
      `estilo`, `temporada`, `tags`) exactly as in Test. Bulk-import option keys in the operator
      guide §8.5 must match Live. (Identical to Test, 2026-10-15.)
- [x] **`tags` is searchable in Test and Live** (2026-10-17): both now have the Console-owned
      `metadata` multi-enum schema, so the `meta_tags` query behind the tag carousels and the Hot
      List (`av-tag-listings`) narrows results instead of being ignored. No listing carries
      `hot-list` or `ofertas` yet in either marketplace, so those sections stay empty until an
      operator tags listings in Console.
- [x] `transactions/commission.json` **22 %** and **Minimum transaction size `$20.00`** (`2000`
      subunits), as in Test. (Identical, 2026-10-15.)
- [x] Process and alias in Live (`archivovintach`): `default-purchase` v1 with
      `default-purchase/release-1`, created 2026-10-12. Its `process.edn` and templates are
      identical to Test's v4 and to the repository (formatting only) (2026-10-15). For a future
      process change, push to Test first, then Live:

      ```sh
      flex-cli process create --process default-purchase \
        --path ext/transaction-processes/default-purchase -m LIVE_ID
      flex-cli process create-alias --process default-purchase --alias release-1 --version 1 -m LIVE_ID
      ```

      If Live already has a `default-purchase`, use `process push` and `update-alias` to the new
      version instead. Push `default-inquiry`/`default-negotiation`/`default-booking` only if a
      listing type uses them.

- [x] Search schemas in Live: `color`, `all_sizes` (multi-enum) and `avPlaceholderImage` (boolean)
      exist, alongside the Console-owned fields (`flex-cli search -m archivovintach`, 2026-10-15).
      Commands, for reference:

      ```sh
      flex-cli search set --key color --scope public --type multi-enum --schema-for listing -m LIVE_ID
      flex-cli search set --key all_sizes --scope public --type multi-enum --schema-for listing -m LIVE_ID
      flex-cli search set --key avPlaceholderImage --scope public --type boolean --schema-for listing -m LIVE_ID
      ```

- [x] Marketplace texts: identical to Test (2026-10-15).
- [x] Email texts: the corrected [`email-texts-es.json`](../reference/email-texts-es.json) is in
      **Test and Live** (2026-10-17): both hold the reference's 604 keys with identical values and
      no `YYYY` date skeleton. Previews of `purchase-mark-order-received-reminder` (the only
      purchase email that prints a date) and `purchase-new-order` were sent from Test.
- [ ] Optional: re-paste the marketplace texts reference
      ([`marketplace-texts-es.json`](../reference/marketplace-texts-es.json), 2,009 keys) into Test
      and Live. Both hosted copies have 1,992 keys and lack `BrandFilter.noResults`; until then the
      bundled `es_av.json` value applies (2026-10-17).
- [x] Content pages, footer, and top bar copied: landing, `acerca-archivo-vintach`, `como-funciona`,
      `como-vender-persona`, `contacto`, `faqs`, terms of service, and privacy policy are identical
      to Test (2026-10-15).
- [ ] Review the terms of service and privacy policy for Live. They must cover Brevo marketing
      consent, Stripe, and eShip address sharing. Moved to after launch (§0 F, 2026-10-18).
- [x] **Live landing page:** the 20 Test references were removed in Console on 2026-10-17, and the
      `av-landing-listings-failed` / `av-landing-user-failed` log lines stopped. Accepted as is for
      launch: `av-selections-nuevo-drop` and `av-selections-favoritos` show their heading and "Ver
      todo" with no listings, and `av-selected-users-closets-destacados` renders nothing. Filling
      them with Live listings and users is listed under §0 F.
- [x] Test's landing page fixed in Console (2026-10-17): its 8 dead references are gone and all 12
      remaining hand-picked references resolve. A listing that is closed rather than deleted also
      reports as missing, so recheck after closing a featured listing.
- [x] Marketplace API application (client ID + secret) and Integration API application, both from
      **Live** (Heroku v42).
- [x] Social login (Google, Facebook): production apps, Live callback URLs on the production domain.
      Google sign-up works on Live (2026-10-19); Facebook's Live IdP entry and Heroku variables are
      set, and its sign-in is tested in E1.
      Google: client ID set at v45, and `/api/auth/google` redirects with the `www` callback
      (2026-10-15); a real sign-in proves the secret. Facebook: an app ID is in the Live bundle;
      confirm it is the production app with the `www` callback, or remove it.
- [ ] At least one operator admin account and the `BULK_IMPORT_OPERATOR_EMAILS` /
      `SHIPPING_LABEL_OPERATOR_EMAILS` users created in Live. Moved to after launch (§0 F, 2026-10-18).
- [x] Run `yarn run config:compare <testClientId> <liveClientId>` and resolve every unexpected
      difference. No differences (2026-10-15).

## 4. Stripe

Checked in code on 2026-10-09: Mexico is a supported Connect country (`configStripe.js`, `MXN`),
payout onboarding defaults to `MX` (`configAV.defaultCountry`), and Test localization is `MXN`.
Heroku carries `pk_live_…` since v38. The earnings estimator for `av-listing` (stock-managed
products, `EditListingPricingAndStockForm`) shows only the 22 % + \$15 commission and never deducts
a Stripe fee — correct, because the platform pays Stripe out of its commission. The US-style
`REACT_APP_STRIPE_FEE_*` defaults reach only the unused booking form.

- [ ] Stripe platform account fully activated for live payments in Mexico (business details, bank
      account, Connect platform profile and branding). Confirmed by Fernanda (2026-10-19), but **E2
      found the Connect platform profile incomplete** (2026-10-20): a seller's payout setup on `www`
      fails with Stripe's "You must complete your platform profile to use Connect and create live
      connected accounts". Complete the Connect questionnaire, the Connect payout settings and
      Accounts V1 in the Live Stripe dashboard (Stripe-side only; no Heroku or Console change),
      then retry the seller's payout setup.
- [x] Live secret key entered in Sharetribe **Live** Console (confirmed by Fernanda, 2026-10-19).
      `pk_live_…` is on Heroku (v38); a Live payout onboarding or purchase (E2/E3) proves the pair
      matches.
- [ ] Connect onboarding tested with a real MX seller (E2). The payout schedule is confirmed
      (Fernanda, 2026-10-19).
- [x] Finance confirms platform margin per sale covers Stripe's Mexico processing fee on the full
      charge, shipping included (the platform, not the seller, pays it). Confirmed 2026-10-19: the
      commission covers Stripe's fee and the shipping margin (the eShip markup is 0).
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

- [x] Test **Generar guía → Descargar guía** on **Render** against QA with a paid test order. Done
      2026-10-16 on order `6ad26852…` (release checklist §2).
- [x] Production API key and `ESHIP_BASE_URL=https://api.myeship.co/rest`; `ESHIP_API_DEBUG` unset.
      Key and base URL set at v39–v40; the operator confirmed the values, debug unset and
      `ESHIP_LABEL_AUTOBUY=false` on Heroku (2026-10-19).
- [ ] Re-run the quote check with the production key and confirm `object_id`/`rate_id` and real
      (non-`TEST`) rates.
- [x] eShip production wallet funded; billing owner: Fernanda (2026-10-19).
- [x] Buyer markup decided 2026-10-19: **0 %**, the client's commission already includes the margin.
      `ESHIP_MARKUP_PCT=0` set on Heroku at v58 (set it on Render too, to match). The buyer pays the
      carrier rate rounded up to the peso.
- [ ] Every launch seller has a complete shipping origin (`/account/shipping-origin`).
- [ ] New production `ESHIP_WEBHOOK_SECRET`; production dashboard webhook with the
      `X-AV-Webhook-Secret` header — only after `AV_ESHIP_TRACKING_EMAILS_ENABLED=true`.
- [ ] Approve or replace the cancellation/refund policy and name owners ([pending eShip](eship.md)
      §1). Launch can proceed with `ESHIP_LABEL_AUTOBUY=false`, but the first real cancellation
      needs an owner.
- [ ] IVA treatment remains open ([pending eShip](eship.md) §2). With no markup there is no IVA
      buffer: if eShip charges IVA on top of the quoted amount, the commission absorbs it, which the
      client accepts (2026-10-19). E4 compares the wallet charge with the buyer's shipping.

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
- [x] Phase A11 (cutover): `BREVO_LIST_ID` is `6` ("Live ArchivoVintach") and the transactional
      webhook URL points at `www.archivovintach.com` (operator, 2026-10-19).
- [x] Render (Test): Brevo configured for the welcome email (2026-10-15): readiness shows it enabled
      with nothing missing and `/api/brevo/health` returns `200`. The forbidden public
      `REACT_APP_BREVO_LIST_ID` (it was `9` in the Render bundle) is gone from the rebuilt bundle.
- [x] Sharetribe Live outgoing email uses the production domain (separate from Brevo), with the same
      visible sender name and reply-to mailbox as Brevo's `hola@archivovintach.com` sender (Brevo
      guide, "Which system sends which email"). Done 2026-10-18: Sharetribe sends through SendGrid,
      and `em7377` (return path, own SPF), `flx._domainkey` and `flx2._domainkey` are CNAMEs to
      `u116477629.wl130.sendgrid.net`. The domain is verified in Console, the sender and reply-to
      are set, and Live previews of `purchase-new-order` and
      `purchase-mark-order-received-reminder` passed SPF, DKIM (`d=archivovintach.com`) and DMARC.
- [ ] Campaigns (Phase B: seven templates, capacity, smoke tests) wait until after launch;
      `AV_BREVO_CAMPAIGNS_ENABLED` stays `false`.

## 7. Hosting: Heroku (Live), Render (Test), and domain

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
  **Open (2026-10-19):** the apex forward only covers `/`. `https://archivovintach.com/` answers
  `301` to `www`, but any other apex path gets a `404` from the forwarder (`/s`,
  `/admin/bulk-import`, `/api/bulk-import/template`), so a link someone shares or types without
  `www` breaks. The app is fine: the same paths on `www` and Render return `200`. Fix it at GoDaddy,
  by making the forward keep the path if it can, or else by moving DNS to a provider that can point
  the apex at Heroku (ALIAS/flattened CNAME) together with an app-side apex→`www` redirect, which
  the app does not have today.
- **Instagram**: the feed works on Heroku (12 posts); the stored token was refreshed 2026-10-12,
  expires 2026-12-11, and auto-refreshes under 20 days. `INSTAGRAM_ACCESS_TOKEN` is an older seed
  than the stored token, so the runbook (§5.2) now copies the stored token into it before
  `pg:reset`. On 2026-10-16 the same stored row was copied into Render's new database (its seed had
  expired); both environments now refresh their own copy independently.

Remaining:

- [x] **Render database:** the old free Postgres had stopped accepting connections. It was replaced
      by `archivovintach_v102026`, migrations 001–009 were applied with the `migrate-test-db`
      procedure, and the web service's `DATABASE_URL` now uses the internal URL. After the redeploy,
      readiness returns `200` with `migrated: true`, one poller owner, and clean polls (2026-10-15).
      This free database expires on **2026-11-14** (Render dashboard). Replace it a few days before
      (by 2026-11-10): create a new free Postgres, apply migrations with the `migrate-test-db`
      procedure, set the web service's `DATABASE_URL` to the new internal URL, copy the
      `av_instagram_token` row from production's database (the Render seed token is expired), and
      redeploy; then check readiness `200` and the Instagram feed. The poller restarts from its
      10-minute lookback, and the old delivery ledger, consent records, and label attempts are not
      carried over.
- [x] Render's tracking emails are off: `AV_ESHIP_TRACKING_EMAILS_ENABLED=false` since 2026-10-16
      (readiness `eshipTracking.enabled: false`; the webhook returns `404`). To test them later,
      first point the eShip **QA** dashboard webhook at
      `https://archivo-vintach.onrender.com/api/shipping/eship-webhook` with the
      `X-AV-Webhook-Secret` header (rotate `ESHIP_WEBHOOK_SECRET` if the URL ever carried
      `?secret=`), and confirm the hosted `default-purchase` has the `eship-picked-up-*` transitions
      and Email texts; then set the flag to `true`.
- [x] Run the Test gate in full on **Render** (release checklist §2); passed 2026-10-16 (§0 B). It was never completed on
      Heroku: the Stripe test purchase with a QA quote, **Generar guía → Descargar guía**,
      `Contactar AV`, a formal restart/no-duplicate check, and the remaining functional checks are
      open. The Heroku Test-mode infrastructure results (migrations, readiness, Brevo A9) don't
      carry over to Render.
- [ ] Run the Live smoke gate on Heroku (release checklist §5) and record the first known-good
      Live-configured release (candidate v58).
- [ ] Watch `sample#memory_total` and R14 during a large bulk import; revisit Standard-2X (1 GB,
      preboot) or a lower concurrent-import cap if it nears 512 MB.
- [x] GoDaddy DNS pointed as in runbook §5.7: `www` resolves to its Heroku target and serves valid
      HTTPS, and the apex answers `301` to `https://www.archivovintach.com` (2026-10-15). The
      Google Workspace MX and SPF records still resolve (2026-10-18).
- [x] `REACT_APP_MARKETPLACE_ROOT_URL` set at v37, before the Live build; the canonical link is
      `https://www.archivovintach.com/`. Console has no editable Marketplace URL for a custom-code
      marketplace; see
      [deployment topology](../operations/deployment.md#where-the-marketplace-url-is-defined).
- [x] DMARC record added (`_dmarc.archivovintach.com`, `p=none`) with the Brevo domain (§6, Brevo
      guide step A1). Re-checked after Sharetribe's SendGrid records were added (2026-10-18):
      unchanged, and the apex keeps a single SPF record (Google Workspace only; Brevo and SendGrid
      use their own return-path domains).
- [x] Before `pg:reset`, carry the Instagram token across (runbook §5.2): done at v43–v44.

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
- [x] `AV_NOINDEX` removed at v46: `www` serves the normal `robots.txt`, and the herokuapp host
      still sends `X-Robots-Tag: noindex, nofollow` (2026-10-15).
- [x] Render: `AV_NOINDEX=true` is in effect (verified 2026-10-10, see §2.1).
- [x] Console (Test and Live): the landing page description and the **social** description (SEO &
      Social → "Page description for social media") are written, and the footer's TikTok URL no
      longer has a trailing space (2026-10-17). `www` serves the new text as `description`,
      `og:description` and `twitter:description`. The copy is interim; the final text is pending.
- [ ] Spanish shareable operator guide is still a draft (see [pending README](README.md)); decide
      whether operators get the English edition at launch.
- [ ] Assign the launch roles from the runbook §1 (operator, approver, rollback owner, monitoring
      owner) and the observation window. Moved to after launch (§0 F, 2026-10-19).

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
