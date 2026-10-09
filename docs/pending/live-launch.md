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

| Area                   | State on 2026-10-09                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release branch         | `pre-release` is deployed to Heroku. `origin/main` is 46 commits behind it; PR #111 (`pre-release` → `main`) is open and is the release merge.                                                                  |
| Heroku app             | `archivo-vintach-marketplace`, stack `heroku-26` (upgraded 2026-10-09), one `web` Basic dyno, `heroku-postgresql` `essential-0`. Only the `herokuapp.com` domain is attached. Runbook phase: **1 (Test mode)**. |
| Heroku providers       | Sharetribe Test credentials, `pk_test_…`, eShip QA base URL.                                                                                                                                                    |
| Heroku guarded flags   | `AV_SHIPPING_LABELS_ENABLED=true` (2026-10-09, after migrations 001–009); the other six explicitly `false`. Welcome email has not been exercised on Heroku.                                                     |
| Server tests           | 54 suites / 654 tests pass.                                                                                                                                                                                     |
| Client tests           | 180 suites / 1920 tests pass with `CI=true`; a single early failure did not recur in eight later full runs (§2.3).                                                                                              |
| `config-check`         | Passes.                                                                                                                                                                                                         |
| `env-template-check`   | Passes.                                                                                                                                                                                                         |
| `av-translation-check` | Passes (336 symmetric keys).                                                                                                                                                                                    |
| `format-ci`            | Passes (the earlier 43 failures were a stale local `node_modules`).                                                                                                                                             |
| `yarn audit`           | Was 1 critical, 35 high, 48 moderate, 6 low; after the 2026-10-09 upgrade 0 critical, 1 high (install-time only), 10 moderate (§2.2).                                                                           |
| Upstream               | Fork is based on v12.1.0; `upstream/main` is v12.4.0 + 126 commits. Merge decided for **after launch** (see [pending README](README.md)).                                                                       |
| CI                     | No CI pipeline exists (`.github/` has only issue templates). Every gate is run by hand.                                                                                                                         |

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
- [ ] `REACT_APP_SENTRY_DSN` — create a Sentry project and set its DSN before launch; production has
      no error monitoring without it.
- [ ] Brevo welcome: `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, and `BREVO_TEMPLATE_SELLER_WELCOME`
      (required by `notificationConfig.js` once welcome email is on). Blocked on the hosted
      seller-welcome template (§6). `BREVO_WEBHOOK_SECRET` and the seven campaign IDs wait for
      campaigns.
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
names.

- [ ] Decide the untracked files: `docs/pending/listings-sheet-proposal.md` (+ two PDFs), and
      `docs/reference/{email,marketplace}-texts-es_OLD.json`. Commit the proposal if it is to be
      tracked; Git history already archives the old text references, so delete the `_OLD` copies.
- [ ] Push `pre-release` to `origin`, review and merge PR #111 into `main`, and deploy the release
      from that merge.

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
- Heroku's Test database had **never been migrated** (`readiness.database.migrated: false`), so the
  label and tracking tables did not exist. Migrations 001–009 were run and
  `AV_SHIPPING_LABELS_ENABLED=true` set; readiness is `200` with one poller leader and no poll
  errors. `ESHIP_LABEL_AUTOBUY` stays `false`, so **Generar guía → Descargar guía** can now be
  tested against QA.

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

Known missing: the hosted Brevo templates.

- [ ] Brevo account can send transactional email; production sending domain authenticated
      (SPF/DKIM/DMARC valid); sender address verified.
- [ ] Seller welcome template created from
      [the Spanish copy](../integrations/brevo-templates-es.md), activated, and its ID set as
      `BREVO_TEMPLATE_SELLER_WELCOME`. This is the only template launch needs.
- [ ] The seven campaign templates (with unsubscribe link and legal footer), the webhook, and its
      secret — needed only before `AV_BREVO_CAMPAIGNS_ENABLED=true`, which stays `false` at launch.
- [ ] Production marketing list ID set as `BREVO_LIST_ID` (footer newsletter uses it at launch).
- [ ] Sharetribe Live outgoing email uses the production domain (separate from Brevo).
- [ ] Record the Brevo owner, key-rotation date, list ID, and template IDs in the team's secret
      inventory (not in the repository).

## 7. Heroku and domain

- [ ] Run the Heroku Test gate in full (release checklist §2). Migrations, readiness, and poller
      leadership are verified (2026-10-09, §5); welcome email and the manual label flow are not yet.
- [ ] Dyno size: Basic is 512 MB. Measure memory during a maximum-size bulk import; move to
      Standard-2X if it approaches the limit.
- [ ] PostgreSQL `essential-0`: confirm `pg:backups:capture` works on this plan **before** the
      cutover (runbook §5.2 depends on it) and that 1 GB / 20 connections fits the expected volume.
- [ ] Add the production domain(s), enable ACM, prepare apex/`www` DNS; set
      `REACT_APP_MARKETPLACE_ROOT_URL` to the canonical HTTPS URL at cutover.
- [ ] Instagram feed: generate a token for the production account and confirm migration 008 stores
      it ([Instagram](../integrations/instagram.md)).

## 8. Content, SEO, and operations

- [ ] Social profile links in `configDefault.js` (`siteInstagramPage`, `siteFacebookPage`) are
      `null`; set them for structured data and sharing previews.
- [ ] `robots.txt` and the sitemap are served from the production root URL; staging on Render should
      not be indexed (consider `BASIC_AUTH_USERNAME/PASSWORD` on Render after launch).
- [ ] Bulk-import sample `NEOCHILANGO.zip` and the CSV template use option keys valid in Live.
- [ ] Spanish shareable operator guide is still a draft (see [pending README](README.md)); decide
      whether operators get the English edition at launch.
- [ ] Assign the launch roles from the runbook §1 (operator, approver, rollback owner, monitoring
      owner) and the observation window.

## 9. Documentation drift found in this review

- `CLAUDE.md` listed Node `>=18.20.1 <23.2.0`. Corrected; `engines.node` is now pinned to `24.x`
  because Heroku warns on upstream's wide `^22.22.0 || >=24.0.0` range and caps it at the active LTS
  anyway.
- The release checklist and runbook ran `yarn test-ci` without `CI=true`. Locally that leaves the
  client half in Jest watch mode, which only runs tests for changed files and never exits — the
  1,918 client tests were silently skipped. Corrected to `CI=true yarn test-ci`, and `format-ci` /
  `av-translation-check` were added to the code gate.
- `.env-template` labels `INSTAGRAM_ACCESS_TOKEN` with the WhatsApp comment ("Meta Cloud API
  credentials for sending WhatsApp notifications"). Cosmetic; fix with the next template edit.
