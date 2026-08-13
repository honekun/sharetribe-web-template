# Pending work

This directory contains decisions, rollout work, engineering changes that are still open, and one
explicitly requested future-use component record. Completed work belongs in the current
implementation guides linked from [`docs/README.md`](../README.md), not in a historical archive
inside `docs/`.

Last reviewed: 2026-08-13.

## Release and operations

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

- [WhatsApp hardening](notifications.md) — recipient direction, consent, Graph API version, delivery
  status, transition coverage, phone validation, and template governance. Keep
  `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false` in production until the blocking items are resolved.
- [Bidding and offer acceptance](bidding.md) — choose a supported product/transaction model before
  implementation. Transaction-process changes require explicit approval and corresponding hosted
  process updates.
- [eShip policy and reconciliation](eship.md) — decide purchased-label cancellation/refund cost
  ownership and reconcile IVA before considering automatic label purchase.
- [Bulk-import horizontal scaling](scaling.md) — shared coordination or a durable worker, only when
  more than one web process or restart-safe imports are required.

## Future-use record

- [Removed pricing-plan component](pricing-plans.md) — former behavior, data contract, deleted
  integration points, and requirements for a future reimplementation. It is not active or pending
  rollout.

## Completion rule

When an item is finished:

1. Update the relevant current guide with the behavior operators or developers must know.
2. Remove the completed item from this directory.
3. Rely on Git history for superseded plans and audit narratives; do not add an archive back under
   `docs/`.
