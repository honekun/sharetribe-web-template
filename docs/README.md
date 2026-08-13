# Archivo Vintach documentation

This directory documents the current implementation and work that is still pending. Superseded
plans, completed checklists, and audit history are intentionally excluded; Git history is the
archive.

## Canonical operator documentation

- [Operator guide](operator-guide.md) — the complete, non-technical source of truth for marketplace
  operators. Update this file first when operator-visible behavior changes.
- [Shareable editions and generator](shareable/) — derived HTML editions. The English HTML is
  rebuilt from `operator-guide.md`; the retained Spanish draft is isolated under
  `shareable/pending/` until its scope and section count are synchronized with the canonical guide.
- [Brand reference](data/brand.csv) and [category-to-package-size rules](data/categoria-paquete.csv)
  — data referenced by the guide and implementation.

## Current implementation

### Operations

- [Production release checklist](operations/release-checklist.md)
- [Current deployment topology](operations/deployment.md)
- [Approved Heroku Test-to-Live deployment](operations/heroku-deployment.md)
- [Single-process and scaling constraints](operations/scaling.md)
- [Local test accounts](operations/test-accounts.md)

### Application features

- [Bulk listing importer](implementation/bulk-import.md)

### Integrations

- [eShip shipping](integrations/eship.md)
- [Notification PostgreSQL](integrations/notification-postgres.md)
- [Brevo email and consent](integrations/brevo.md)
- [Brevo Spanish templates](integrations/brevo-templates-es.md)
- [WhatsApp](integrations/whatsapp.md)

### Technical reference

- [Sharetribe hosted-assets API](reference/hosted-assets.md)

## Pending work

Start with the [pending-work index](pending/README.md). It contains actionable open topics and the
explicitly retained future-use record:

- [WhatsApp and notification hardening](pending/notifications.md)
- [Removed pricing-plan component reference](pending/pricing-plans.md)
- [Bidding and offer-acceptance research](pending/bidding.md)
- [eShip policy and reconciliation](pending/eship.md)
- [Bulk-import horizontal scaling](pending/scaling.md)

Unchecked boxes in deployment and integration runbooks are environment-specific execution steps;
they do not mean the documented implementation is missing.
