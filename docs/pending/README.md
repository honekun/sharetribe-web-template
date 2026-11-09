# Pending work

This directory contains decisions, rollout work, engineering changes that are still open, and one
explicitly requested future-use component record. Completed work belongs in the current
implementation guides linked from [`docs/README.md`](../README.md), not in a historical archive
inside `docs/`.

Last reviewed: 2026-11-08 (audit remediation merged and deployed to Render/Test).

The [2026-11-06 custom-code audit](../audits/2026-11-06-custom-code-audit.md) is the remediation
register for its findings. All are resolved in code and merged to `main` (PR #142, `7c0a106c2`);
the remaining release steps are below. Remove the report and its links once they are done.

## Release and operations

- Production (Heroku, Sharetribe Live) is deployed since 2026-10-12 but **not signed off**. Close
  the [Live launch readiness](live-launch.md) items in the order of its §0 tracker: the Render Test
  gate, Live Console content fixes, Live configuration to confirm, and the Live smoke gate.
- Finish the [audit](../audits/2026-11-06-custom-code-audit.md) release steps. Render/Test runs the
  merged code: migration `010_listing_publication_completion.sql` was applied to its database
  (`archivovintach_v102026`) with the `migrate-test-db` procedure before the merge on 2026-11-08,
  and readiness returns `200` on the new build. Still open:
  - On Test, check that a shipping order gets `metadata.avShipping` and buys exactly one label, and
    that a pickup order shows no **Generar guía** control.
  - Run migration 010 on the Live notification database (`yarn db:migrate`) **before** Heroku is
    rebuilt from this `main`. It is additive, so the running Live code is unaffected, but the new
    code's readiness check reports `503` until it is applied.
- `main` already merges upstream v12.6.0 (`76e55bc8d`, 2026-11-06, which brought Sentry 11 and the
  earlier v12.4 fixes). It is deployed to Render/Test with the audit fixes but has not passed the
  Test gate or been released to Heroku Live; it ships with the next release above. Re-apply
  `engines.node` `24.x` if a later upstream sync broadens it again.
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
