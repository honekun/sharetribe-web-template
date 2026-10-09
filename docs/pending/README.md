# Pending work

This directory contains decisions, rollout work, engineering changes that are still open, and one
explicitly requested future-use component record. Completed work belongs in the current
implementation guides linked from [`docs/README.md`](../README.md), not in a historical archive
inside `docs/`.

Last reviewed: 2026-10-09.

## Release and operations

- Close the [Live launch readiness](live-launch.md) gaps first: missing Heroku production variables,
  dependency advisories, repository gates, and the Sharetribe Live, Stripe, eShip, and Brevo setup
  the release checklist assumes is already done.
- Merge upstream v12.4.0 **after launch** (decided 2026-10-09; the fork is on v12.1.0). Do it on a
  branch, validate on Render/Test, then release normally. It brings Sentry 11, which clears the
  seven remaining `@opentelemetry/*` audit advisories, plus `user.duck` hardening, the inquiry
  checkout speculation fix, sitemap empty-detection, and imgix in CSP. Re-apply `engines.node`
  `24.x` if upstream's range comes back.
- Complete the [production release checklist](../operations/release-checklist.md). It is an
  operational checklist, so its unchecked environment steps remain in that runbook.
- Synchronize the retained [Spanish shareable draft](../shareable/pending/operator-guide-es.html)
  with every section of the canonical [operator guide](../operator-guide.md), then verify its table
  of contents and section count before distribution. Until then, keep it in the pending directory
  and retain its visible warning.
- Keep production Heroku at one web dyno while bulk-import coordination remains in process. The
  current limit is documented in [operations/scaling](../operations/scaling.md); implementation
  options are in [pending scaling](scaling.md).
- Smoke-test Brevo lifecycle campaigns against Live data before setting
  `AV_BREVO_CAMPAIGNS_ENABLED=true`.

## Product and integration decisions

- [Listings sheet](listings-sheet-proposal.md) — proposal for an in-site spreadsheet that creates
  many listings with validated dropdowns, instead of the CSV/ZIP bulk import. Awaiting client
  approval; no development has started.
- Per-seller provider commission override — **deferred until after launch** (decided 2026-10-09).
  The approved [design](../superpowers/specs/2026-08-14-per-seller-commission-override-design.md)
  and [plan](../superpowers/plans/2026-08-15-per-seller-commission-override.md) remain the starting
  point; only plan Task 3 (fixed-fee clamp) shipped, as a launch fix. Before resuming, raise the
  Console and code minimum listing price to `6000`, since overrides may reach 75 % (see the plan's
  Task 4 note).
- [WhatsApp hardening](notifications.md) — recipient direction, consent, Graph API version, delivery
  status, transition coverage, phone validation, and template governance. WhatsApp notifications are
  release-locked out of the first release; keep `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false` until the
  blocking items are resolved and a reviewed code change removes the lock.
- [Bidding and offer acceptance](bidding.md) — choose a supported product/transaction model before
  implementation. Transaction-process changes require explicit approval and corresponding hosted
  process updates.
- [eShip policy and reconciliation](eship.md) — decide purchased-label cancellation/refund cost
  ownership and reconcile IVA before considering automatic label purchase.
- [Bulk-import horizontal scaling](scaling.md) — shared coordination or a durable worker, only when
  more than one web process or restart-safe imports are required.

## Completion rule

When an item is finished:

1. Update the relevant current guide with the behavior operators or developers must know.
2. Remove the completed item from this directory.
3. Rely on Git history for superseded plans and audit narratives; do not add an archive back under
   `docs/`.
