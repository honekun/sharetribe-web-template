# Production release checklist

Use this go/no-go checklist for every production release. **Render** is the Test environment
(Sharetribe Test, Stripe test mode, eShip QA), and **Heroku** is production (Sharetribe Live, Stripe
live, eShip production). Confirm the actual state in the [deployment record](deployment.md).

Initial launch status (2026-10-15): the Heroku app was converted to Live on 2026-10-12 and is
deployed at `https://www.archivovintach.com`. §4 records the cutover. The **Render Test gate (§2)
and the Live validation (§5) are still open**, and the launch is not signed off until both pass.
Open gaps are in [Live launch readiness](../pending/live-launch.md).

## Release record

- Release version/tag:
- Test commit SHA and tree hash: Render — not yet recorded
- Live commit SHA and tree hash: `cdb36026c` (Heroku v48, 2026-10-12)
- Pull request:
- Heroku app, dyno type, and PostgreSQL add-on: `archivo-vintach-marketplace`, one Basic `web`,
  `heroku-postgresql` `essential-0`
- Sharetribe Test and Live application/integration records: Test marketplace `archivovintach-test`
  (Render); Live credentials on Heroku since v42
- Completed Test database backup ID: `b007` (2026-10-12 17:19 -0600)
- Database reset and migration evidence: readiness `migrated: true` with no Test rows (2026-10-15)
- Live Heroku release ID: v48 (build), v49 (flags)
- Release operator:
- Approver: Alex for the tests the AV team runs; the client for the tests they run and the
  overall launch approval (2026-10-19)
- Started/completed time and timezone:
- First known-good Live-configured rollback release: pending Live validation (candidate v58)

## 1. Code and configuration gate

Run 2026-10-19 on the Live candidate (v57/v58 code).

- [x] The reviewed release branch is merged and the worktree is clean. Merged to `main` with the
      Talla fix PR.
- [x] Record the tested commit and Git tree hash. If an empty release commit is required to trigger
      the Live rebuild, require the same tree hash. Commit `df0cd65e6`, tree `978e54f70`; later commits
      are docs only.
- [x] `CI=true yarn test-ci` passes. Without `CI=true` the client half runs in Jest watch mode,
      tests only changed files, and never exits. Server 61 suites / 782 tests; client 190 suites /
      1,999 tests / 168 snapshots.
- [x] `yarn format-ci` and `yarn av-translation-check` pass.
- [x] `yarn run config-check` passes.
- [x] `yarn run env-template-check` passes.
- [x] `yarn run build` passes.
- [x] Database migrations and rollback implications are reviewed. None since `009`; v49–v56 share
      the schema, so any of them is a valid rollback.
- [x] Operator-visible changes are documented in [`operator-guide.md`](../operator-guide.md), the
      English shareable guide is regenerated, and every translated edition intended for this release
      is synchronized. The per-page SEO section shipped in PR #130; PRs #133–#134 are server-only
      Brevo fixes with nothing operator-visible. The Spanish edition is a draft (tracker F).

## 2. Render Test gate

Run on `https://archivo-vintach.onrender.com/` with [test accounts](test-accounts.md). Before the
initial launch, the Heroku app passed the infrastructure checks below in Test mode (v36,
2026-10-10), but those results describe Heroku, not Render. Re-run them on Render. The functional
checks were never completed in any hosted Test environment.

- [x] Deploy the release candidate to Render with Test variables and record its commit and tree.
      Redeploy and re-run this gate if the candidate changes. Render deploys `main`; since
      2026-10-16 it serves bundle `main.20acea97.js`, which carries #118's bag-owner key. #118
      (`1a6e0198e` on `pre-release`) is the last code change; #119–#123 are docs and an
      `.env-template` comment only.
- [x] Confirm the application uses Test Marketplace/Integration credentials, Stripe test mode
      (bundle carries `pk_test_…`, verified 2026-10-15), eShip QA, the Render root URL, and
      `AV_NOINDEX=true`. eShip QA confirmed 2026-10-16: quotes return `TESTRATE` rates.
- [x] Run `yarn db:migrate` against Render's database before relying on notifications or labels. New
      database `archivovintach_v102026`, migrations 001–009 via the `migrate-test-db` procedure
      (2026-10-15).
- [x] Configure the Test-phase Brevo values on Render. Welcome email enabled, nothing missing
      (2026-10-15).
- [x] Confirm all guarded flags are explicit. Readiness shows all six set (2026-10-15).
      `ESHIP_LABEL_AUTOBUY` is off (paid orders got no label until **Generar guía**), and tracking
      emails were switched off on 2026-10-16 (`eshipTracking.enabled: false`, webhook `404`).
- [x] Confirm `SERVER_SHARETRIBE_TRUST_PROXY` is a hop count, not `true`. Render needs `3`
      (Cloudflare and an internal proxy in front), measured 2026-10-16 with a forged
      `X-Forwarded-For` probe (live-launch §2.1); it previously trusted the forged entry.
- [x] Confirm exactly one web process, per [scaling constraints](scaling.md). Render runs one
      instance (dashboard, 2026-10-16).
- [x] `GET /api/notifications/readiness` returns `200` and one process owns poller leadership.
      (2026-10-15)
- [x] `GET /api/brevo/health` returns `200` for enabled Brevo features. (2026-10-15)
- [x] Check one built-in Sharetribe Test email: Console's Test Marketplace URL can't be edited, so
      its links may point at the `…mysharetribe-test.com` address rather than Render. Record which.
      Checked 2026-10-16: Test emails link to `https://archivovintach-test.mysharetribe-test.com`,
      not Render. Accepted as a Test-only limit; when testing from an email, open the same path on
      `https://archivo-vintach.onrender.com` instead.
- [x] Verify SSR, search/filters, signup, email verification, and login, in Spanish (the only
      configured locale). Done 2026-10-16: SSR of the landing, CMS, legal, search, and auth routes
      (`200`); search 276 results, with keyword, `genero`, `brand`, `all_sizes`, `color`, and
      category filters narrowing; the brand filter's "Sin resultados". `pub_tags` is ignored until
      `tags` is searchable (live-launch C3). Signup and the verification email confirmed 2026-10-16
      with a new account (`alex+buyer@rewav.co`); login worked throughout. There is no second
      language: the Console localization asset sets a single locale (`es`) and the app has no
      language switcher.
- [x] Verify seller payout onboarding, shipping origin, listing create/edit/publish, and welcome
      popup. Store seller `alex+av_store1@rewav.co` completed Stripe test payout onboarding and
      saved a Guadalajara origin on 2026-10-16: `/account/payments` reports the account up to date,
      and `/account/shipping-origin` reloads the saved address. Welcome popup (2026-10-16, seller
      `alex+vendedor_av@rewav.co` with `onboardingCompleted` cleared through the Integration API):
      it showed on the home page, and **Subir mi primer drop** saved `onboardingCompleted: true` and
      opened the wizard. Listing `6ad2a742…` created through the wizard: one photo was rejected
      ("Agrega almenos 3 fotos"), three were accepted; category, brand search, sizes, color, and the
      other fields saved; the estimator showed \$350 − \$92 (22 % + \$15) = \$258; the package size
      offers only S/M/L (`especial` is not seller-selectable). Publishing first stopped at the
      payout modal because Stripe asked this seller for more verification ("Completa la
      verificación"); after **Verifícate** it published (`published`, stock 1, three images,
      original-price strike-through). Editing the price to \$380 saved and shows on the listing
      page.
- [x] Verify live eShip quote, one Stripe test purchase, order breakdown, and
      `protectedData.avShipping`. Quote done 2026-10-16 (CDMX seller → `64000` Monterrey): four QA
      rates; Estándar = cheapest (Estafeta 6 d, 145 → \$172.00), Express = fastest, cheapest on a
      tie (Estafeta 3 d, 237.80 → \$281.00); the 18 % markup rounds up. Checkout opens from the
      listing and survives a full reload (#117 seed fix). Purchase done 2026-10-16 with the saved
      Stripe test card: order `6ad1d15e…` reached `transition/confirm-payment`; payin \$672.00 (item
      \$500.00 + Estándar \$172.00), shipping fee customer-only, commission \$110.00 (22 %) +
      \$15.00 fixed, payout \$375.00; `protectedData.avShipping` holds the QA rate and `quot_id`;
      `metadata.avLabel` empty until the seller buys the label. Second purchase 2026-10-16, buyer
      `alex+vendedor_av@rewav.co` from store seller `alex+av_store1@rewav.co` (Guadalajara origin):
      order `6ad26852…`, Express (Estafeta 3 d, \$281.00) to `06700` CDMX; payin \$731.00, shipping
      fee customer-only, commission \$99.00 (22 %) + \$15.00 fixed, payout \$336.00; the buyer's
      order page shows the same breakdown; `avShipping` holds bucket `nacionalExpress`; listing
      stock went 1 → 0.
- [x] With `ESHIP_LABEL_AUTOBUY=false`, verify **Generar guía** then **Descargar guía** against QA.
      Done 2026-10-16 on order `6ad26852…` as seller `alex+av_store1@rewav.co`: neither paid order
      had a label after `confirm-payment` (auto-buy is off); **Generar guía** bought an Estafeta
      "Dia Sig." QA label (`SIN VALOR`, sender `TEST Archivo Vintach`, 44160 → 06700) and switched
      to **Descargar guía**, a new-tab link to the `200 application/pdf` label; `metadata.avLabel`
      is `purchased` with shipment, tracking number, and URLs; the link survives a reload; a second
      `POST /api/shipping/label` returned the same shipment (no second purchase). The seller's sale
      page shows \$450.00 − \$114.00 = \$336.00 with no shipping line. Fersaanch's `6ad1d15e…` still
      has no label.
- [x] Verify `Contactar AV` when a seller origin is missing or the item is `especial`. Missing
      origin done at the API on 2026-10-16: quotes for `alex+av_store1@rewav.co` listings returned
      `409 NO_ORIGIN` before its origin was saved and `200` with QA rates after. `especial` done
      2026-10-16 (test listing `6ad26889…` set to `avPackageSize: especial` and opened through the
      Integration API, then restored to `M` and closed): as buyer `alex+vendedor_av@rewav.co`,
      checkout showed "El envío automático no está disponible para este artículo" with a **Contactar
      al vendedor** button instead of Express/Estándar, made no quote request, and kept **Confirma y
      paga** disabled with a complete address and no shipping line; the button opened the listing's
      inquiry form (closed unsent); a direct quote returned `422 ESPECIAL`.
- [x] Verify negotiation request/offer/counter/payment behavior if its hosted process is active. Not
      applicable (2026-10-16): the only listing type, `av-listing`, uses
      `default-purchase/release-1` in both Test and Live; `default-negotiation` exists but no
      listing type uses it.
- [x] Verify bulk import as a regular seller and an allowlisted operator. Regular seller done
      2026-10-16: a one-row CSV created listing `6ad1d1dc…` (`closed` per `publish=no`, placeholder
      image, system keys set, stock 1); re-uploading it reported "1 ya importados (omitidos)"; a CSV
      with `pub_listingType` was rejected. Operator done 2026-10-16: signed in as
      `alex+vendedor_av@rewav.co` (in `BULK_IMPORT_OPERATOR_EMAILS`), a one-row CSV with a `user_id`
      column created listing `6ad26889…` authored by `alex+av_store1@rewav.co` (`closed`,
      placeholder image, stock 1, `metadata.avBulkImport` set).
- [x] Review CSP reports, switch staging to block mode, and repeat the critical path. Production
      already enforces CSP (v47), so a CSP regression found here is a live defect. Render already
      sends an enforcing `Content-Security-Policy` header (not `-Report-Only`), so the whole
      2026-10-16 critical path (purchase, label, bulk import, Brevo iframe, Stripe onboarding) ran
      in block mode; the browser console showed no CSP violations on the landing, contact, listing,
      search, and payout pages, and no `CSP:` violation line appears in Render's or Heroku's logs.
- [x] Restart staging; sessions survive and the poller resumes from its PostgreSQL cursor without
      duplicate sends. Done 2026-10-16 with a manual Render restart: the browser stayed signed in as
      `alex+vendedor_av@rewav.co`; readiness returned `200`; a new process took the poller lease
      (21:58:28Z) at the saved cursor `441280017` instead of the 10-minute lookback, and picked up a
      probe `listing/updated` event (`441283102`) on its next poll (22:03:28Z); the delivery ledger
      still held the one `seller_welcome` send from 16:03Z, which also survived four earlier
      redeploys that day, with no repeat sends and no retries.

Other Render results (2026-10-16): `/my-balance` total earnings equal the sum of completed net
amounts; bag, favorites, `/my-sales`, `/my-purchases`, shipping origin, payout, `/l/new`, and
`/admin/bulk-import` load signed in; bag sign-out (#118, bundle `main.20acea97.js`): a guest bag
survives a reload and is kept on sign-in with the signed-in user recorded as owner, and signing out
empties it (`/bag` shows the empty state); the Brevo contact-form iframe on `/p/contacto` loads
sandboxed from Sibforms under the enforcing CSP, and a submission (2026-10-16, sender
`hola+prueba-render@archivovintach.com`) showed Brevo's success message in full. Webhook: no secret,
a `?secret=` query, and a wrong header all return `401`. Instagram: the feed returned
`503 token_expired` because Render's `INSTAGRAM_ACCESS_TOKEN` seed had expired; the stored token row
was copied from production's database into Render's and the feed returns `200` with 12 posts. Every
page logs a console error that no Mapbox token is set; harmless while no map is used.

Any buyer-flow, payment, payout, shipping-price, duplicate-send, or duplicate-label failure blocks
production. For the initial launch it is already live, so treat it as a launch blocker and fix it
before announcing.

## 3. Live preparation gate

- [x] Review and copy approved pages, navigation, footer, categories, fields, listing types,
      translations, and transaction-process configuration from Test to Live. `config:compare`
      reports all 23 hosted assets identical (2026-10-15). Transaction-process aliases are not
      covered by it; confirm them with `flex-cli process list` on Live.
- [x] Use Live Marketplace and Integration applications; Test credentials cannot read Live data.
      (v42)
- [x] Configure Stripe live mode and the matching publishable key. The bundle carries `pk_live_…`
      (v38).
- [x] Verify the production root URL, DNS, TLS, email sender domain, social callbacks, and Mapbox.
      Root URL, DNS, and TLS are verified (2026-10-15); the Sharetribe sender domain is verified and
      passes SPF, DKIM and DMARC (2026-10-18). Google and Facebook both redirect with the `www`
      callback. After the Live Console got its identity-provider entries, a Google sign-up created
      a Live account (2026-10-19); Facebook's entry and variables are set and its sign-in is part of
      §5. Mapbox is not used (no location listing type or map search).
- [x] Use the explicit production eShip base URL/key and disable eShip debug output. Key and base
      URL set at v39–v40; `ESHIP_API_DEBUG` unset (operator, 2026-10-19).
- [x] Add the production domains and certificate to the same Heroku app. Both domains attached
      (2026-10-09); DNS moved and `www` serves valid HTTPS (2026-10-15).
- [x] Confirm the approved cutover reuses the PostgreSQL add-on only after a completed Test backup
      and full reset; no Test tables or rows may enter Live. Backup `b007`; readiness shows no Test
      rows.
- [x] Confirm all notification/channel flags are explicitly `true` or `false` and readiness is
      complete for every enabled feature. v56 (2026-10-19): readiness `200`, every channel
      `configured` with nothing missing; poller, labels and Brevo welcome enabled; campaigns,
      tracking emails and WhatsApp disabled.
- [x] Keep `AV_BREVO_CAMPAIGNS_ENABLED=false` until Live campaign triggers are smoke-tested. Off at
      v56; templates 7–13 are active and their IDs set (v54), so enabling it is the only step left.
- [x] Confirm `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false`; WhatsApp is code-level release-locked out
      of the first release. Do not remove the lock until [WA-01–03](../pending/notifications.md) are
      resolved.
- [x] Keep `ESHIP_LABEL_AUTOBUY=false` until the purchased-label cancellation/refund policy is
      approved. Confirmed false (2026-10-19).
- [x] Keep `AV_ESHIP_TRACKING_EMAILS_ENABLED=false` until migration 009, the hosted purchase
      process/templates, Spanish Email texts, and the environment-matched eShip webhook are ready.

## 4. In-place Test-to-Live cutover gate (initial launch only)

Performed 2026-10-12; see the release table in the [runbook](heroku-deployment.md) §5. Items not
evidenced by the release log or public endpoints stay unticked until the operator confirms them. For
later releases, replace this section with: rebuild the Render-validated commit on Heroku, migrate if
needed, confirm readiness, and record the release.

- [ ] Confirm the exact Heroku app and PostgreSQL add-on with an independent approver. Deferred to
      after launch with the launch roles (2026-10-19).
- [ ] Scale the Heroku app to `web=0` and set all guarded capabilities to `false`. The flags changed
      at v41. The operator switched the site off for the cutover, but the scale-down was not
      recorded, so it stays unticked; accepted as not done (2026-10-19).
- [x] Capture the Test PostgreSQL backup, wait for completion, and record its backup ID. `b007`.
- [x] Reset the attached `DATABASE_URL` in accordance with the approved destructive cutover step.
      Readiness shows no Test deliveries, marketing preferences, or poller cursor.
- [x] Replace all Marketplace, Integration, Stripe, eShip, Brevo, social-login, root URL, and public
      build values with their matching Live values. Done for Marketplace, Integration, Stripe,
      eShip, root URL, Google client ID, and `BREVO_LIST_ID` (v37–v45); the Brevo webhook URL
      points at `www`, and the Google and Facebook values are Live (2026-10-19).
- [x] Trigger a complete Heroku rebuild with Live variables. v48 deployed `cdb36026c`; its bundle
      carries `pk_live_…`.
- [x] Confirm the Live build's source tree matches the tested release candidate. `cdb36026c` differs
      from the Test-mode build `81e98fac6` in docs only. The functional Test gate was not completed,
      so "tested" means the Heroku infrastructure checks only.
- [x] Run `yarn db:migrate` on the empty reused database before enabling the poller or labels.
      Readiness reports `migrated: true`.
- [ ] Scale to `web=1` and perform baseline SSR/database checks with guarded capabilities still off.
- [x] Enable only the approved welcome/manual-label capabilities; keep campaigns, WhatsApp, and
      label auto-buy false. v49; readiness shows campaigns, tracking, and WhatsApp disabled;
      `ESHIP_LABEL_AUTOBUY=false` confirmed in config (2026-10-19).
- [x] Confirm exactly one web process. (2026-10-15)
- [x] Confirm build and boot logs contain no recurring errors. v52, 2026-10-18: ~3 h of logs with
      no 5xx, H-code or R14 line; the daily restart booted cleanly and reacquired poller leadership.
- [x] Confirm `/api/notifications/readiness` and enabled-provider health checks return `200`.
      (2026-10-15)
- [ ] Record the first known-good Live-configured Heroku release. Public traffic is already open, so
      record it as soon as §5 passes. Candidate: v56 (2026-10-19), `main` at `6cb1ac358` (bundle
      `main.ad24b9f3.js`, unchanged since v52; v55–v56 are the server-only Brevo unsubscribe fixes,
      PRs #133–#134) on top of v51's `REACT_APP_GOOGLE_ANALYTICS_ID` (v50); its bundle carries
      only Live values, readiness is `200`, and the logs show no CSP violations or 5xx responses.
      Superseded by v57 (`c37b994d8`, the Talla filter fix, bundle `main.639f579a.js`) and v58
      (`ESHIP_MARKUP_PCT=0`): **candidate v58**, verified the same way on 2026-10-19.

## 5. Live smoke and launch gate

This is the pending "overall validation" for the initial launch.

- [x] Move public DNS only after the Live build and readiness gates pass. `www` CNAME to Heroku,
      apex `301` to `www` (verified 2026-10-15) — for `/` only: GoDaddy's forward-only forwarding
      returns `404` for every apex path (`/s`, `/admin/bulk-import`, `/api/bulk-import/template`;
      re-checked 2026-10-19), so apex deep links are broken. See live-launch "Domains".
- [ ] Production domain, redirects, SSR, login, search, and CMS pages work. Redirects, SSR,
      canonical URL, and crawlable `robots.txt` verified (2026-10-15); CMS pages, search filters and
      Google sign-in and email/password login (2026-10-19). Left: a Facebook sign-in.
- [ ] Create one real seller/listing and complete real Stripe Connect onboarding.
- [ ] Complete one approved low-value real purchase with a live eShip quote.
- [ ] Verify order math, platform-retained shipping fee, seller payout, and transaction shipping
      data.
- [ ] Purchase and download the real label manually; record the carrier charge.
- [ ] Confirm one real `TRANSIT/picked_up` webhook sends exactly one native Sharetribe tracking
      email; replaying the same event sends no duplicate and does not change transaction state.
- [ ] Reply to the buyer dispute acknowledgement with an image attachment and confirm it reaches the
      monitored Archivo Vintach mailbox; confirm no transaction change occurs at 24 hours.
- [ ] Verify the welcome email and built-in Sharetribe links use the production sender/domain.
- [ ] Perform the approved refund/cancellation test and reconcile the label separately.
- [ ] Record evidence and obtain the launch approver's sign-off.

## 6. Post-launch

- [ ] Watch application errors, `[notificationAlert]`, readiness, poller heartbeat, Stripe, Brevo,
      and eShip for the agreed observation window.
- [ ] Confirm no staging credentials or test-mode keys are present in production.
- [ ] Record issues and owners without placing secrets or protected customer data in the release
      record.
- [ ] Never restore the Test backup or select a pre-cutover Test release after real Live activity.
- [ ] If a launch gate fails after traffic opens, use only a recorded Live-configured rollback and
      recheck database compatibility plus Stripe/eShip external outcomes.
- [x] Keep Render and Sharetribe Test as the permanent pre-production path. Keep Heroku connected to
      Live for subsequent releases.

Open non-launch work remains in [`pending/README.md`](../pending/README.md); do not enable a guarded
feature merely to close a release checklist.
