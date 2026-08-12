# Current deployment topology

Repository metadata identifies `https://archivo-vintach.onrender.com/` as the current staging URL.
The repository does not record an approved production application or a completed Heroku topology, so
operators must not infer a Live target from a draft runbook or domain name.

Before a release, confirm the actual hosting service, application name, Sharetribe Test/Live
environment, database, and rollback control in the approved provider inventory. Never copy secrets
or customer data into this file.

## Current application constraints

- Build with the repository's supported Node/Yarn versions and run `yarn start` for production SSR.
- `REACT_APP_*` values are embedded during build. Build the same reviewed commit separately for each
  environment rather than reusing an artifact built with another environment's values.
- Keep one web process while bulk-import jobs and rate/concurrency state remain process-local. See
  [scaling constraints](scaling.md).
- Attach managed PostgreSQL and run `yarn db:migrate` before enabling notifications or shipping
  labels. Manual label purchase also requires the label ledger.
- Keep notification and label start flags `false` on a first boot, migrate, then enable only the
  reviewed capabilities and require `/api/notifications/readiness` to return `200`.
- Keep WhatsApp, Brevo campaigns, and eShip label auto-buy behind their documented pending gates.

Use the [release checklist](release-checklist.md) for every environment change. The proposed Heroku
setup is retained as [pending rollout work](../pending/heroku-deployment.md), not as the current
deployment record.
