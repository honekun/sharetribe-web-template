# Current deployment topology and approved production path

## Current state

Repository metadata identifies `https://archivo-vintach.onrender.com/` as the current staging URL,
connected to Sharetribe Test and the matching test-mode providers. Until the Live cutover is signed
off, the repository does not claim that a public production application is active.

Before any release, record the actual hosting application, Sharetribe environment, provider modes,
database, custom domain, and rollback control. Never infer the active target from an old hostname or
place secrets in this file.

## Approved initial Live deployment

The approved plan is [one Heroku Test-to-Live cutover](heroku-deployment.md):

1. Create one Heroku app with its intended long-term production identity.
2. Provision one web dyno formation and one Heroku Postgres add-on.
3. Deploy and validate it against Sharetribe Test, Stripe test mode, and eShip QA.
4. Freeze the app after the full Test release gate passes.
5. Capture and verify a PostgreSQL Test backup.
6. Retain the same PostgreSQL add-on but reset all Test tables and rows.
7. Replace all environment-bound settings with Sharetribe Live, Stripe live, eShip production, and
   the production domain.
8. Perform a complete rebuild because `REACT_APP_*` values are compiled into the browser bundle.
9. Run database migrations before enabling notifications or shipping labels.
10. Start one web dyno, pass readiness and the controlled Live smoke test, then open public traffic.

The app, dyno formation, and database billing resource are reused. The actual dyno process and all
Test database contents are not. Sharetribe Test users, listings, transactions, Stripe Connect
accounts, and Integration events never transfer to Live.

## Steady state after launch

| Purpose         | Host   | Provider modes                                 |
| --------------- | ------ | ---------------------------------------------- |
| Staging/testing | Render | Sharetribe Test, Stripe test, eShip QA         |
| Production      | Heroku | Sharetribe Live, Stripe live, eShip production |

After launch, Heroku remains Live. Routine releases are tested on Render/Test and rebuilt
independently on Heroku with Live variables. The production Heroku app is not switched back to Test.

## Current application constraints

- Build with the repository's supported Node/Yarn versions and run `yarn start` for production SSR.
- Keep exactly one web process while bulk-import jobs and rate/concurrency state remain
  process-local. See [scaling constraints](scaling.md).
- Do not promote or copy a Test build artifact into Live. Build the approved code again with Live
  public variables.
- Run `yarn db:migrate` on the clean database before enabling notifications or shipping labels.
- Keep notification and label start flags `false` during database reset, config replacement, build,
  and migration.
- Keep WhatsApp, Brevo campaigns, and eShip label auto-buy behind their documented pending gates.
- Never use a pre-cutover Test release as a production rollback target.

Use the [release checklist](release-checklist.md) for the go/no-go decision and the
[Heroku deployment runbook](heroku-deployment.md) for the exact initial cutover sequence.
