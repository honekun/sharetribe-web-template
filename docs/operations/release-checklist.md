# Production release checklist

Use this platform-neutral go/no-go checklist for an approved commit moving from a staging app
connected to Sharetribe **Test** to an approved production app connected to Sharetribe **Live**.
Confirm the actual hosting targets in the [current deployment record](deployment.md). The proposed
Heroku setup remains [pending](../pending/heroku-deployment.md).

`REACT_APP_*` values are embedded during the build. Build the same commit separately with each app's
own Test or Live configuration; do not reuse a staging artifact in production.

## Release record

- Release version/tag:
- Commit SHA:
- Pull request:
- Staging app and Sharetribe environment:
- Production app and Sharetribe environment:
- Release operator:
- Approver:
- Started/completed time and timezone:
- Rollback release:

## 1. Code and configuration gate

- [ ] The reviewed release branch is merged and the worktree is clean.
- [ ] Record the exact commit that both apps will build.
- [ ] `yarn test-ci` passes.
- [ ] `yarn run config-check` passes.
- [ ] `yarn run env-template-check` passes.
- [ ] `yarn run build` passes.
- [ ] Database migrations and rollback implications are reviewed.
- [ ] Operator-visible changes are documented in [`operator-guide.md`](../operator-guide.md), the
      English shareable guide is regenerated, and every translated edition intended for this release
      is synchronized.

## 2. Test-environment staging gate

- [ ] Deploy the release commit to the staging app and rebuild with Test variables.
- [ ] Run `yarn db:migrate` against the staging database.
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

## 3. Live configuration gate

- [ ] Review and copy approved pages, navigation, footer, categories, fields, listing types,
      translations, and transaction-process configuration from Test to Live.
- [ ] Publish and verify `content/pricing-plans.json`, or explicitly accept the documented fallback.
- [ ] Use Live Marketplace and Integration applications; Test credentials cannot read Live data.
- [ ] Configure Stripe live mode and the matching publishable key.
- [ ] Verify the production root URL, DNS, TLS, email sender domain, social callbacks, and Mapbox.
- [ ] Use the explicit production eShip base URL/key and disable eShip debug output.
- [ ] Configure a separate production PostgreSQL database and run migrations.
- [ ] Confirm all notification/channel flags are explicitly `true` or `false` and readiness is
      complete for every enabled feature.
- [ ] Keep `AV_BREVO_CAMPAIGNS_ENABLED=false` until Live campaign triggers are smoke-tested.
- [ ] Keep `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false` until [WA-01–03](../pending/notifications.md)
      are resolved.
- [ ] Keep `ESHIP_LABEL_AUTOBUY=false` until the purchased-label cancellation/refund policy is
      approved.

## 4. Production deploy gate

- [ ] Deploy the recorded commit to the production app and rebuild with Live variables; do not reuse
      the staging artifact.
- [ ] Run production migrations before enabling the poller.
- [ ] Confirm exactly one web process.
- [ ] Confirm build and boot logs contain no recurring errors.
- [ ] Confirm `/api/notifications/readiness` and enabled-provider health checks return `200`.
- [ ] Record the hosting provider's release identifier before public traffic is opened.

## 5. Live smoke and launch gate

- [ ] Production domain, redirects, SSR, login, search, and CMS pages work in both languages.
- [ ] Create one real seller/listing and complete real Stripe Connect onboarding.
- [ ] Complete one approved low-value real purchase with a live eShip quote.
- [ ] Verify order math, platform-retained shipping fee, seller payout, and transaction shipping
      data.
- [ ] Purchase and download the real label manually; record the carrier charge.
- [ ] Verify the welcome email and built-in Sharetribe links use the production sender/domain.
- [ ] Perform the approved refund/cancellation test and reconcile the label separately.
- [ ] Record evidence and obtain the launch approver's sign-off.

## 6. Post-launch

- [ ] Watch application errors, `[notificationAlert]`, readiness, poller heartbeat, Stripe, Brevo,
      and eShip for the agreed observation window.
- [ ] Confirm no staging credentials or test-mode keys are present in production.
- [ ] Record issues and owners without placing secrets or protected customer data in the release
      record.
- [ ] If a launch gate fails, stop traffic-changing work and use the recorded provider rollback
      release. Recheck config and database compatibility after rollback.
- [ ] Keep the Test environment and staging app as the permanent pre-production path for the next
      release.

Open non-launch work remains in [`pending/README.md`](../pending/README.md); do not enable a guarded
feature merely to close a release checklist.
