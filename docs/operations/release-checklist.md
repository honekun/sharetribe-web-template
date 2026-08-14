# Production release checklist

Use this go/no-go checklist with the [approved Heroku runbook](heroku-deployment.md). For the
initial launch, one Heroku app is tested against Sharetribe **Test**, Stripe test mode, and eShip
QA, then converted in place to **Live**. The app, dyno formation, and PostgreSQL add-on are reused;
the Test database contents and build artifact are not.

After launch, Render/Test remains the permanent staging path and Heroku remains Live. Confirm the
actual state in the [deployment record](deployment.md).

## Release record

- Release version/tag:
- Test commit SHA and tree hash:
- Live commit SHA and tree hash:
- Pull request:
- Heroku app, dyno type, and PostgreSQL add-on:
- Sharetribe Test and Live application/integration records:
- Completed Test database backup ID:
- Database reset and migration evidence:
- Live Heroku release ID:
- Release operator:
- Approver:
- Started/completed time and timezone:
- First known-good Live-configured rollback release:

## 1. Code and configuration gate

- [ ] The reviewed release branch is merged and the worktree is clean.
- [ ] Record the tested commit and Git tree hash. If an empty release commit is required to trigger
      the Live rebuild, require the same tree hash.
- [ ] `yarn test-ci` passes.
- [ ] `yarn run config-check` passes.
- [ ] `yarn run env-template-check` passes.
- [ ] `yarn run build` passes.
- [ ] Database migrations and rollback implications are reviewed.
- [ ] Operator-visible changes are documented in [`operator-guide.md`](../operator-guide.md), the
      English shareable guide is regenerated, and every translated edition intended for this release
      is synchronized.

## 2. Heroku Test-mode gate

- [ ] Deploy the release candidate to the permanent Heroku app with Test variables.
- [ ] Confirm all guarded flags were explicitly `false` on the first boot.
- [ ] Run `yarn db:migrate` against the attached Heroku PostgreSQL database before enabling
      notifications or labels.
- [ ] Confirm exactly one web process, per [scaling constraints](scaling.md).
- [ ] Confirm the application uses Test Marketplace/Integration credentials, Stripe test mode, eShip
      QA, the staging root URL, and CSP report mode for the initial pass.
- [ ] `GET /api/notifications/readiness` returns `200` and one process owns poller leadership.
- [ ] `GET /api/brevo/health` returns `200` for enabled Brevo features.
- [ ] Verify SSR, search/filters, signup, email verification, login, and both configured languages.
- [ ] Verify seller payout onboarding, shipping origin, listing create/edit/publish, and welcome
      popup.
- [ ] Verify live eShip quote, one Stripe test purchase, order breakdown, and
      `protectedData.avShipping`.
- [ ] With `ESHIP_LABEL_AUTOBUY=false`, verify **Generar guía** then **Descargar guía** against QA.
- [ ] Verify `Contactar AV` when a seller origin is missing or the item is `especial`.
- [ ] Verify negotiation request/offer/counter/payment behavior if its hosted process is active.
- [ ] Verify bulk import as a regular seller and an allowlisted operator.
- [ ] Review CSP reports, switch staging to block mode, and repeat the critical path.
- [ ] Restart staging; sessions survive and the poller resumes from its PostgreSQL cursor without
      duplicate sends.

Any buyer-flow, payment, payout, shipping-price, duplicate-send, or duplicate-label failure blocks
production.

## 3. Live preparation gate

- [ ] Review and copy approved pages, navigation, footer, categories, fields, listing types,
      translations, and transaction-process configuration from Test to Live.
- [ ] Use Live Marketplace and Integration applications; Test credentials cannot read Live data.
- [ ] Configure Stripe live mode and the matching publishable key.
- [ ] Verify the production root URL, DNS, TLS, email sender domain, social callbacks, and Mapbox.
- [ ] Use the explicit production eShip base URL/key and disable eShip debug output.
- [ ] Add the production domains and certificate to the same Heroku app without moving public DNS
      yet.
- [ ] Confirm the approved cutover reuses the PostgreSQL add-on only after a completed Test backup
      and full reset; no Test tables or rows may enter Live.
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

## 4. In-place Test-to-Live cutover gate

- [ ] Confirm the exact Heroku app and PostgreSQL add-on with an independent approver.
- [ ] Scale the Heroku app to `web=0` and set all guarded capabilities to `false`.
- [ ] Capture the Test PostgreSQL backup, wait for completion, and record its backup ID.
- [ ] Reset the attached `DATABASE_URL` in accordance with the approved destructive cutover step.
- [ ] Replace all Marketplace, Integration, Stripe, eShip, Brevo, social-login, root URL, and public
      build values with their matching Live values.
- [ ] Trigger a complete Heroku rebuild with Live variables. A config restart, Test slug, or
      pipeline promotion does not satisfy this gate.
- [ ] Confirm the Live build's source tree matches the tested release candidate.
- [ ] Run `yarn db:migrate` on the empty reused database before enabling the poller or labels.
- [ ] Scale to `web=1` and perform baseline SSR/database checks with guarded capabilities still off.
- [ ] Enable only the approved welcome/manual-label capabilities; keep campaigns, WhatsApp, and
      label auto-buy false.
- [ ] Confirm exactly one web process.
- [ ] Confirm build and boot logs contain no recurring errors.
- [ ] Confirm `/api/notifications/readiness` and enabled-provider health checks return `200`.
- [ ] Record the first known-good Live-configured Heroku release before public traffic is opened.

## 5. Live smoke and launch gate

- [ ] Move public DNS only after the Live build and readiness gates pass.
- [ ] Production domain, redirects, SSR, login, search, and CMS pages work in both languages.
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
- [ ] Keep Render and Sharetribe Test as the permanent pre-production path. Keep Heroku connected to
      Live for subsequent releases.

Open non-launch work remains in [`pending/README.md`](../pending/README.md); do not enable a guarded
feature merely to close a release checklist.
