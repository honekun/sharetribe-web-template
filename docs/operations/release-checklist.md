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
- Approver:
- Started/completed time and timezone:
- First known-good Live-configured rollback release: pending Live validation (candidate v49)

## 1. Code and configuration gate

- [ ] The reviewed release branch is merged and the worktree is clean.
- [ ] Record the tested commit and Git tree hash. If an empty release commit is required to trigger
      the Live rebuild, require the same tree hash.
- [ ] `CI=true yarn test-ci` passes. Without `CI=true` the client half runs in Jest watch mode,
      tests only changed files, and never exits.
- [ ] `yarn format-ci` and `yarn av-translation-check` pass.
- [ ] `yarn run config-check` passes.
- [ ] `yarn run env-template-check` passes.
- [ ] `yarn run build` passes.
- [ ] Database migrations and rollback implications are reviewed.
- [ ] Operator-visible changes are documented in [`operator-guide.md`](../operator-guide.md), the
      English shareable guide is regenerated, and every translated edition intended for this release
      is synchronized.

## 2. Render Test gate

Run on `https://archivo-vintach.onrender.com/` with [test accounts](test-accounts.md). Before the
initial launch, the Heroku app passed the infrastructure checks below in Test mode (v36,
2026-10-10), but those results describe Heroku, not Render. Re-run them on Render. The functional
checks were never completed in any hosted Test environment.

- [ ] Deploy the release candidate to Render with Test variables and record its commit and tree.
      Redeploy and re-run this gate if the candidate changes.
- [ ] Confirm the application uses Test Marketplace/Integration credentials, Stripe test mode
      (bundle carries `pk_test_…`, verified 2026-10-15), eShip QA, the Render root URL, and
      `AV_NOINDEX=true`.
- [x] Run `yarn db:migrate` against Render's database before relying on notifications or labels. New
      database `archivovintach_v102026`, migrations 001–009 via the `migrate-test-db` procedure
      (2026-10-15).
- [x] Configure the Test-phase Brevo values on Render. Welcome email enabled, nothing missing
      (2026-10-15).
- [ ] Confirm all guarded flags are explicit. Readiness shows all six set (2026-10-15); confirm
      `ESHIP_LABEL_AUTOBUY=false`, and that tracking emails (`true` on Render) have their Test
      prerequisites.
- [ ] Confirm `SERVER_SHARETRIBE_TRUST_PROXY` is a hop count, not `true`.
- [ ] Confirm exactly one web process, per [scaling constraints](scaling.md).
- [x] `GET /api/notifications/readiness` returns `200` and one process owns poller leadership.
      (2026-10-15)
- [x] `GET /api/brevo/health` returns `200` for enabled Brevo features. (2026-10-15)
- [ ] Check one built-in Sharetribe Test email: Console's Test Marketplace URL can't be edited, so
      its links may point at the `…mysharetribe-test.com` address rather than Render. Record which.
- [ ] Verify SSR, search/filters, signup, email verification, login, and both configured languages.
- [ ] Verify seller payout onboarding, shipping origin, listing create/edit/publish, and welcome
      popup.
- [ ] Verify live eShip quote, one Stripe test purchase, order breakdown, and
      `protectedData.avShipping`.
- [ ] With `ESHIP_LABEL_AUTOBUY=false`, verify **Generar guía** then **Descargar guía** against QA.
- [ ] Verify `Contactar AV` when a seller origin is missing or the item is `especial`.
- [ ] Verify negotiation request/offer/counter/payment behavior if its hosted process is active.
- [ ] Verify bulk import as a regular seller and an allowlisted operator.
- [ ] Review CSP reports, switch staging to block mode, and repeat the critical path. Production
      already enforces CSP (v47), so a CSP regression found here is a live defect.
- [ ] Restart staging; sessions survive and the poller resumes from its PostgreSQL cursor without
      duplicate sends.

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
- [ ] Verify the production root URL, DNS, TLS, email sender domain, social callbacks, and Mapbox.
      Root URL, DNS, and TLS are verified (2026-10-15); the email sender domain and social callbacks
      are not.
- [ ] Use the explicit production eShip base URL/key and disable eShip debug output. Key and base
      URL set at v39–v40; confirm `ESHIP_API_DEBUG` is unset.
- [x] Add the production domains and certificate to the same Heroku app. Both domains attached
      (2026-10-09); DNS moved and `www` serves valid HTTPS (2026-10-15).
- [x] Confirm the approved cutover reuses the PostgreSQL add-on only after a completed Test backup
      and full reset; no Test tables or rows may enter Live. Backup `b007`; readiness shows no Test
      rows.
- [ ] Confirm all notification/channel flags are explicitly `true` or `false` and readiness is
      complete for every enabled feature.
- [ ] Keep `AV_BREVO_CAMPAIGNS_ENABLED=false` until Live campaign triggers are smoke-tested.
- [ ] Confirm `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false`; WhatsApp is code-level release-locked out
      of the first release. Do not remove the lock until [WA-01–03](../pending/notifications.md) are
      resolved.
- [ ] Keep `ESHIP_LABEL_AUTOBUY=false` until the purchased-label cancellation/refund policy is
      approved.
- [ ] Keep `AV_ESHIP_TRACKING_EMAILS_ENABLED=false` until migration 009, the hosted purchase
      process/templates, Spanish Email texts, and the environment-matched eShip webhook are ready.

## 4. In-place Test-to-Live cutover gate (initial launch only)

Performed 2026-10-12; see the release table in the [runbook](heroku-deployment.md) §5. Items not
evidenced by the release log or public endpoints stay unticked until the operator confirms them. For
later releases, replace this section with: rebuild the Render-validated commit on Heroku, migrate if
needed, confirm readiness, and record the release.

- [ ] Confirm the exact Heroku app and PostgreSQL add-on with an independent approver.
- [ ] Scale the Heroku app to `web=0` and set all guarded capabilities to `false`. The flags changed
      at v41; the scale-down is not recorded.
- [x] Capture the Test PostgreSQL backup, wait for completion, and record its backup ID. `b007`.
- [x] Reset the attached `DATABASE_URL` in accordance with the approved destructive cutover step.
      Readiness shows no Test deliveries, marketing preferences, or poller cursor.
- [ ] Replace all Marketplace, Integration, Stripe, eShip, Brevo, social-login, root URL, and public
      build values with their matching Live values. Done for Marketplace, Integration, Stripe,
      eShip, root URL, Google client ID, and `BREVO_LIST_ID` (v37–v45). Confirm the Brevo webhook
      URL and the remaining social-login values.
- [x] Trigger a complete Heroku rebuild with Live variables. v48 deployed `cdb36026c`; its bundle
      carries `pk_live_…`.
- [x] Confirm the Live build's source tree matches the tested release candidate. `cdb36026c` differs
      from the Test-mode build `81e98fac6` in docs only. The functional Test gate was not completed,
      so "tested" means the Heroku infrastructure checks only.
- [x] Run `yarn db:migrate` on the empty reused database before enabling the poller or labels.
      Readiness reports `migrated: true`.
- [ ] Scale to `web=1` and perform baseline SSR/database checks with guarded capabilities still off.
- [x] Enable only the approved welcome/manual-label capabilities; keep campaigns, WhatsApp, and
      label auto-buy false. v49; readiness shows campaigns, tracking, and WhatsApp disabled. Confirm
      `ESHIP_LABEL_AUTOBUY=false` in config.
- [x] Confirm exactly one web process. (2026-10-15)
- [ ] Confirm build and boot logs contain no recurring errors.
- [x] Confirm `/api/notifications/readiness` and enabled-provider health checks return `200`.
      (2026-10-15)
- [ ] Record the first known-good Live-configured Heroku release. Public traffic is already open, so
      record it as soon as §5 passes.

## 5. Live smoke and launch gate

This is the pending "overall validation" for the initial launch.

- [x] Move public DNS only after the Live build and readiness gates pass. `www` CNAME to Heroku,
      apex `301` to `www` (verified 2026-10-15).
- [ ] Production domain, redirects, SSR, login, search, and CMS pages work in both languages.
      Redirects, SSR, canonical URL, and crawlable `robots.txt` verified (2026-10-15).
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
