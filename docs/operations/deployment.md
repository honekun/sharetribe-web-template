# Current deployment topology

## Current state (2026-10-15)

| Purpose        | Host and URL                                                           | External environment                           | Database                                                        | State                                                                          |
| -------------- | ---------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Test / staging | Render, `https://archivo-vintach.onrender.com/`                        | Sharetribe Test, Stripe test, eShip QA         | Staging-only Render Postgres (free tier, expires 2026-11-14)    | Hosts the Test gate. Readiness `200` after the 2026-10-15 database replacement |
| Production     | Heroku `archivo-vintach-marketplace`, `https://www.archivovintach.com` | Sharetribe Live, Stripe live, eShip production | Heroku Postgres `essential-0`, reset at cutover, Live rows only | Deployed and serving. **Overall Live validation pending**                      |

Heroku was converted from Test to Live on 2026-10-12 (releases v37–v49; Live build v48 from `main`
at `cdb36026c`). Public DNS points at it: `www` is the canonical host and the apex `301`-forwards to
it. The Live validation gate is release checklist §5, with open items in
[Live launch readiness](../pending/live-launch.md). Until it is signed off, don't open Brevo
campaigns or announce the marketplace.

Before any release, record the actual hosting application, Sharetribe environment, provider modes,
database, custom domain, and rollback control. Never infer the active target from an old hostname,
and never place secrets in this file.

## Roles of the two environments

- **Render is the only Test environment.** Every release candidate is validated there against
  Sharetribe Test, Stripe test mode, and eShip QA. Use [test accounts](test-accounts.md) only there
  or locally, never on production.
- **Heroku is production.** It stays connected to Sharetribe Live. It is never switched back to
  Test, for testing or for rollback.

The Heroku app ran in Test mode between 2026-08-14 and 2026-10-12. That phase verified migrations,
readiness, poller leadership, Brevo, and the welcome email. It did not complete the functional Test
gate (Stripe test purchase, **Generar guía → Descargar guía**, `Contactar AV`, restart/no-duplicate,
CSP review). Those checks now run on Render: release checklist §2.

## Where the marketplace URL is defined

With custom code, the marketplace address is not a Console setting:

- **The host attaches the domain**: `heroku domains` plus GoDaddy DNS for production, the
  `onrender.com` name for staging.
- **The app reads its own address from `REACT_APP_MARKETPLACE_ROOT_URL`.** The value feeds the
  client config, API CORS origin, social-login callbacks, sitemap and canonical URLs, web manifest,
  and the non-canonical-host noindex guard. It is a `REACT_APP_*` value, so a change needs a full
  rebuild.
- **Console's Marketplace URL can't be edited in Sharetribe Test.** Sharetribe fixes it at the
  `…mysharetribe-test.com` address, so the Test Console URL cannot point at Render. Sharetribe's
  built-in Test emails link to `https://archivovintach-test.mysharetribe-test.com` (confirmed
  2026-10-16; accepted as a Test-only limit). To follow one, open the same path on Render.
- **Live:** confirm that Sharetribe's built-in Live emails link to `https://www.archivovintach.com`
  (release checklist §5).

## Routine release flow

1. Merge the reviewed branch and pass the code gate (release checklist §1).
2. Deploy it to Render with Test variables and pass the Render Test gate (§2).
3. Rebuild the same commit on Heroku with its Live variables (§4). Never promote or copy a Render or
   Test build artifact: `REACT_APP_*` values are compiled into the browser bundle.
4. Run `yarn db:migrate` on Heroku before enabling any feature that needs a new migration.
5. Run the Live smoke checks for the changed areas and record the release.

## Current application constraints

- Build with the repository's supported Node/Yarn versions and run `yarn start` for production SSR.
  `engines.node` is `24.x`, and Yarn refuses to install on any other major. Heroku reads `engines`
  directly. On Render, a `NODE_VERSION` environment variable takes precedence over `engines`, so set
  it to `24` or delete it. A leftover `22.x` value fails the build at `Validating package.json`.
- Keep exactly one web process while bulk-import jobs and rate/concurrency state remain
  process-local. See [scaling constraints](scaling.md).
- Render's database must be migrated (the `migrate-test-db` procedure, from a local machine over the
  database's External URL) before its notification or shipping-label flags are useful. Readiness
  reports `notification_database_unavailable_or_unmigrated` until then. The web service itself must
  use the **Internal** URL: the app's pool (`server/services/postgres.js`) sets no TLS. A free
  Render Postgres expires after 30 days, so replace and re-migrate it before then. The current one
  expires on 2026-11-14 ([live launch](../pending/live-launch.md) §7 has the replacement steps).
- Keep WhatsApp, Brevo campaigns, and eShip label auto-buy behind their documented pending gates in
  both environments.
- Never roll production back past v48, the first Live-built release. v37–v47 only changed config on
  the v36 slug, so their browser bundle still carries Test credentials and URLs.

Use the [release checklist](release-checklist.md) for the go/no-go decision. The
[Heroku Test-to-Live runbook](heroku-deployment.md) records how the initial cutover was performed.
