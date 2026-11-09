# Pending work

This directory contains decisions, rollout work, engineering changes that are still open, and one
explicitly requested future-use component record. Completed work belongs in the current
implementation guides linked from [`docs/README.md`](../README.md), not in a historical archive
inside `docs/`.

Last reviewed: 2026-11-06 (custom-code audit remediation).

The [2026-11-06 custom-code audit](../audits/2026-11-06-custom-code-audit.md) is the remediation
register for its findings. All are resolved in code on `fix/audit-2026-11-06`; the remaining
release steps are below. Remove the report and its links once they are done.

## Release and operations

- Production (Heroku, Sharetribe Live) is deployed since 2026-10-12 but **not signed off**. Close
  the [Live launch readiness](live-launch.md) items in the order of its §0 tracker: the Render Test
  gate, Live Console content fixes, Live configuration to confirm, and the Live smoke gate.
- Release the `fix/audit-2026-11-06` branch through the normal flow (Render/Test gate first) and
  finish the [audit](../audits/2026-11-06-custom-code-audit.md) verification it lists: run
  migration `010_listing_publication_completion.sql` on the Test and Live notification databases
  **before** deploying (`yarn db:migrate`; the `migrate-test-db` procedure for Render). It is
  additive, so the running code is unaffected, but the new code's readiness check reports `503`
  until it is applied wherever notifications are enabled. Then check a shipping order's
  `metadata.avShipping` and its label purchase on Test.
- `main` already merges upstream v12.6.0 (`76e55bc8d`, 2026-11-06, which brought Sentry 11 and the
  earlier v12.4 fixes). That merge has not been validated on Render/Test or released to Heroku
  Live; it ships with the next release above. Re-apply `engines.node` `24.x` if a later upstream
  sync broadens it again.
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
- Per-seller provider commission override — **implemented 2026-10-23** as a Console `metadata` user
  field `avCommissionPercentage` (0–25 %, percentage only, \$15 fixed fee always charged, no end
  date; [design](../superpowers/specs/2026-08-14-per-seller-commission-override-design.md)).
  Remaining: create the field in Console **Test** and **Live** (operator guide §14.6, "One-time
  setup"), with Show on profile off, then verify one seller in Test end to end.
- [WhatsApp hardening](notifications.md) — recipient direction, consent, Graph API version, delivery
  status, transition coverage, phone validation, and template governance. WhatsApp notifications are
  release-locked out of the first release; keep `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false` until the
  blocking items are resolved and a reviewed code change removes the lock.
- [Bidding and offer acceptance](bidding.md) — choose a supported product/transaction model before
  implementation. Transaction-process changes require explicit approval and corresponding hosted
  process updates.
- [eShip policy and reconciliation](eship.md) — decide purchased-label cancellation/refund cost
  ownership and reconcile IVA before considering automatic label purchase.
- [Bulk-import horizontal scaling](scaling.md) — shared coordination or a durable worker, plus a
  durable atomic per-row claim for idempotency, only when more than one web process or restart-safe
  imports are required.

## Completion rule

When an item is finished:

1. Update the relevant current guide with the behavior operators or developers must know.
2. Remove the completed item from this directory.
3. Rely on Git history for superseded plans and audit narratives; do not add an archive back under
   `docs/`.
