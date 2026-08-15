# Approved Heroku Test-to-Live deployment

Status: approved initial production deployment plan.

Archivo Vintach will use **one Heroku app** for the initial release. The app is first deployed with
Sharetribe Test, Stripe test mode, and eShip QA. After the release candidate passes the complete
test matrix, the same Heroku app, dyno formation, and PostgreSQL add-on are converted to Live.

The PostgreSQL **resource** is reused, but its Test contents are not. Test state must be backed up
and erased before the app receives Sharetribe Live credentials. Render remains the permanent Test
staging environment after the Heroku app becomes production.

## Non-negotiable boundaries

1. A dyno is an ephemeral process, not a transferable server. Keep the same Heroku app and its
   formation; Heroku replaces the actual dyno whenever the app deploys, restarts, or changes size.
2. Keep exactly one web process (`web=1`) because bulk-import coordination is process-local.
3. Reuse the Heroku Postgres add-on only after capturing a Test backup and resetting its contents.
   Never let Live use the Test poller cursor, notification jobs, consent records, delivery claims,
   or shipping-label attempts.
4. Sharetribe Test and Live users, listings, transactions, API applications, Stripe Connect
   accounts, and Integration API event streams remain separate. They are never migrated by this
   cutover.
5. `REACT_APP_*` values are compiled into the frontend. Switching config vars requires a complete
   rebuild; a restart is insufficient.
6. The chosen Heroku build generation must expose the approved `REACT_APP_*` values during
   `heroku-postbuild`. Verify this in Phase 1 and again in the Live build; runtime-only config is
   not enough for the browser bundle.
7. Do not promote or reuse the Test build artifact. Build the approved code again after the Live
   variables are set.
8. Keep WhatsApp, Brevo campaigns, and eShip label auto-buy disabled at launch. Enable only the
   reviewed notification and manual-label capabilities after database migration and readiness.
9. Do not use a pre-cutover Test release as a production rollback target: its browser bundle can
   contain Test credentials and URLs.

## 1. Roles and release record

Assign before provisioning:

- release operator and independent approver;
- Heroku app/add-on owner and billing owner;
- Sharetribe Test and Live administrator;
- Stripe, eShip, Brevo, DNS, and social-login owners;
- rollback decision-maker; and
- monitoring/incident owner for the launch window.

Record:

- Heroku app name, region, stack, dyno type, and PostgreSQL add-on name;
- release candidate commit and tree hash;
- Test start/completion time;
- PostgreSQL Test backup ID and successful-completion evidence;
- database reset and migration time;
- Live build/release ID and commit/tree hash;
- DNS change and Live sign-off time; and
- first known-good **Live-configured** rollback release.

Never place secrets, database URLs, access tokens, or protected customer data in the release record.

## 2. Prerequisites

### 2.1 Access and tools

- Heroku account with an approved payment method and access to the final app.
- Sharetribe Console access to both Test and Live.
- Separate Test and Live Marketplace API and Integration API applications.
- Stripe test and live platform configuration. Stripe secret keys belong in the matching Sharetribe
  Console environment; only the publishable key belongs in the web app.
- eShip QA and production credentials.
- Brevo Test/pre-production and production resources if email is enabled.
- DNS and identity-provider callback access.
- Heroku CLI authenticated with the approved account.

Verify the CLI:

```sh
heroku --version
heroku auth:whoami
```

### 2.2 Release candidate

From a clean reviewed branch:

```sh
yarn test-ci
yarn run config-check
yarn run env-template-check
yarn run build
```

Record the commit and tree:

```sh
git rev-parse HEAD
git rev-parse HEAD^{tree}
```

### 2.3 Choose the permanent app name

Create the app with its intended production identity instead of a disposable `-test` name. During
Phase 1, the Heroku hostname is only a pre-production URL; the custom production domain is attached
later.

Set a task-specific shell variable and verify it before every command:

```sh
export AV_HEROKU_APP=approved-app-name
test -n "$AV_HEROKU_APP"
```

## 3. Phase 1 — deploy the Heroku app in Test mode

### 3.1 Create the app and reusable resources

```sh
heroku create "$AV_HEROKU_APP" --region us
heroku addons:create heroku-postgresql:APPROVED_PLAN --app "$AV_HEROKU_APP"
heroku config:get DATABASE_URL --app "$AV_HEROKU_APP"
heroku apps:info --app "$AV_HEROKU_APP"
```

Do not copy the displayed database URL into a ticket, document, or chat. The first application boot
must have every guarded capability explicitly disabled:

```sh
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=false \
  AV_SHIPPING_LABELS_ENABLED=false \
  AV_ESHIP_TRACKING_EMAILS_ENABLED=false \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=false \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  ESHIP_LABEL_AUTOBUY=false \
  --app "$AV_HEROKU_APP"
```

Do not set `NODE_ENV`, `PORT`, or `DATABASE_URL` manually. Heroku supplies the first two and manages
the database attachment.

### 3.2 Configure Test services

Use the matching Test values for every environment-coupled setting:

| Area                     | Test value                                                                 |
| ------------------------ | -------------------------------------------------------------------------- |
| Marketplace API          | Sharetribe Test client ID and server-only secret                           |
| Integration API          | Sharetribe Test integration ID and secret                                  |
| Stripe                   | `pk_test_...` in Heroku; matching `sk_test_...` in Sharetribe Test Console |
| Public root URL          | The app's current `herokuapp.com` HTTPS URL                                |
| eShip                    | QA base URL and QA key                                                     |
| eShip tracking webhook   | QA-only `ESHIP_WEBHOOK_SECRET`, sent as the `X-AV-Webhook-Secret` header   |
| eShip debug              | Optional in Test; must not expose secrets                                  |
| Brevo                    | Test/pre-production resources and templates                                |
| WhatsApp                 | Disabled                                                                   |
| Default country/currency | `MX` / `MXN` and the approved marketplace values                           |

Configure every required variable from `.env-template`. Keep server secrets out of `REACT_APP_*`.
Confirm that Marketplace and Integration credentials come from the same Sharetribe Test environment.

### 3.3 Deploy and migrate

Deploy the selected branch to the app and confirm the build log includes `yarn build`:

```sh
git push heroku RELEASE_BRANCH:main
heroku logs --tail --app "$AV_HEROKU_APP"
heroku run yarn db:migrate --app "$AV_HEROKU_APP"
```

The server must boot with no poller while both start flags remain `false`. After migrations and
provider configuration are verified, enable only the Test capabilities needed for validation:

```sh
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=true \
  AV_SHIPPING_LABELS_ENABLED=true \
  AV_ESHIP_TRACKING_EMAILS_ENABLED=false \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  ESHIP_LABEL_AUTOBUY=false \
  --app "$AV_HEROKU_APP"

heroku ps:scale web=1 --app "$AV_HEROKU_APP"
heroku ps --app "$AV_HEROKU_APP"
```

The buyer pickup email stays off until its own prerequisites are met, in this order: the hosted
`default-purchase` version carrying the `eship-picked-up-*` transitions and its Email texts are
published, migration `009` has run, `ESHIP_WEBHOOK_SECRET` is set, and the eShip QA dashboard sends
to `https://APP_HOST/api/shipping/eship-webhook` with the `X-AV-Webhook-Secret` header. Only then
set `AV_ESHIP_TRACKING_EMAILS_ENABLED=true`. The endpoint returns `404` while the flag is `false`,
so enable the flag before saving the dashboard webhook or eShip will record failed deliveries. See
[eShip](../integrations/eship.md) §5.3.

Use a non-sleeping dyno. Monitor actual memory during the bulk-import test; do not assume a dyno
size from a documentation estimate.

### 3.4 Connect Sharetribe Test

In Sharetribe Console with **Test** selected:

- set the Marketplace URL to the Heroku pre-production URL;
- add its social-login callback URLs where those providers are enabled;
- verify listing types, fields, categories, transaction processes, translations, pages, navigation,
  top bar, footer, and email texts; and
- confirm Stripe Test and the Test Integration API application are selected.

### 3.5 Complete the Test gate

Use [test accounts](test-accounts.md) and the full [release checklist](release-checklist.md). At a
minimum, verify:

- SSR, CMS pages, search, filters, signup, verification, login, and both languages;
- `comprador`, `vendedor`, and `vendedor-tienda` behavior;
- Stripe Connect Test onboarding;
- listing create/edit/publish/moderation and original-price behavior;
- seller shipping origin, eShip QA quote, payment, shipping line item, and transaction data;
- manual **Generar guía → Descargar guía** with `ESHIP_LABEL_AUTOBUY=false`;
- cancellation/refund handling without assuming the carrier charge is recovered;
- negotiation-role behavior if the hosted process is enabled;
- regular-seller and allowlisted-operator bulk imports;
- welcome email, consent, webhook, and suppression behavior for enabled Brevo features;
- `/api/notifications/readiness`, `/api/brevo/health`, and exactly one poller leader;
- restart recovery from the PostgreSQL cursor without duplicate sends; and
- CSP block mode and absence of recurring application/provider errors.

Do not start the Live conversion with an unresolved buyer-flow, payment, payout, shipping-price,
duplicate-send, duplicate-label, migration, or readiness failure.

## 4. Phase 2 — prepare Live before touching the Heroku app

In Sharetribe Console with **Live** selected:

1. Copy/recreate and review the approved hosted configuration and content from Test.
2. Confirm the deployed transaction process aliases and unit types match application settings.
3. Create the Live Marketplace API application and Live Integration API integration.
4. Configure Stripe live mode and the matching secret key in Sharetribe Live.
5. Verify the production outgoing-email sender/domain.
6. Configure the production Marketplace URL and social-login callbacks.
7. Prepare the eShip production key/base URL and keep API debug disabled.
8. Prepare separate production Brevo sender, templates, list, webhook, and secret if enabled.
9. Add the production domain to Heroku and enable managed certificates, but do not move public DNS
   until the Live build and health gates pass.

Users, listings, transactions, Stripe Connect accounts, Integration events, and Test database rows
must not be copied into Live.

## 5. Phase 3 — convert the same Heroku app to Live

Perform this phase in a recorded maintenance window. Once it begins, the Heroku Test deployment is
unavailable until the conversion completes or the pre-traffic rollback is executed.

### 5.1 Freeze the app

Resolve the exact app first:

```sh
test -n "$AV_HEROKU_APP"
heroku apps:info --app "$AV_HEROKU_APP"
heroku ps:scale web=0 --app "$AV_HEROKU_APP"
heroku ps --app "$AV_HEROKU_APP"
```

With `web=0`, set all guarded capabilities to `false` so no poller can start during config changes:

```sh
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=false \
  AV_SHIPPING_LABELS_ENABLED=false \
  AV_ESHIP_TRACKING_EMAILS_ENABLED=false \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=false \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  ESHIP_LABEL_AUTOBUY=false \
  --app "$AV_HEROKU_APP"
```

### 5.2 Back up and verify the Test database

```sh
heroku pg:info --app "$AV_HEROKU_APP"
heroku pg:backups:capture --app "$AV_HEROKU_APP"
heroku pg:backups:info --app "$AV_HEROKU_APP"
```

Record the completed backup ID. This is a Test rollback/audit backup; never restore it over a Live
database after production activity begins.

### 5.3 Reset the reused PostgreSQL add-on

> **Destructive cutover step.** `pg:reset` deletes every table and row while retaining the same
> Heroku Postgres add-on and billing resource. Run it only after the app name, add-on, completed
> backup, `web=0`, and approval are independently confirmed.

```sh
test -n "$AV_HEROKU_APP"
heroku apps:info --app "$AV_HEROKU_APP"
heroku pg:info --app "$AV_HEROKU_APP"
heroku pg:reset DATABASE_URL --app "$AV_HEROKU_APP" --confirm "$AV_HEROKU_APP"
```

Do not selectively retain the Test poller or notification tables. A full clean schema is required.

### 5.4 Replace Test configuration with Live configuration

Replace, do not mix, all environment-bound values:

| Setting group                    | Required Live value                                   |
| -------------------------------- | ----------------------------------------------------- |
| Marketplace API                  | Live client ID and secret                             |
| Integration API                  | Live integration ID and secret                        |
| Stripe                           | `pk_live_...`; matching secret in Sharetribe Live     |
| `REACT_APP_MARKETPLACE_ROOT_URL` | Canonical production HTTPS URL, no trailing slash     |
| eShip                            | Explicit production base URL and production key       |
| `ESHIP_WEBHOOK_SECRET`           | New secret; re-point the production eShip dashboard   |
| `ESHIP_API_DEBUG`                | `false` or unset                                      |
| Brevo                            | Production sender/resources/secrets                   |
| Social login                     | Production IDs/secrets and callbacks                  |
| CSP                              | `block`, after the Test CSP gate                      |
| Notification/label flags         | All remain `false` until migration and baseline smoke |

Use `heroku config --app "$AV_HEROKU_APP"` only in an approved private terminal. Cross-check the
variable names against `.env-template` without copying secret values into the release record.

### 5.5 Rebuild with Live public variables

Changing Heroku config creates a release and restart, but it does not make an existing browser
bundle safe for a different environment. Trigger a complete build after the Live variables are set.
Confirm the build log runs `heroku-postbuild` and `yarn build`.

If a normal Git push reports that the recorded commit is already up to date, use the approved
Heroku/GitHub manual build mechanism or a reviewed empty release commit. When an empty commit is
used, verify that its Git tree hash matches the tested release candidate:

```sh
git rev-parse HEAD^{tree}
```

Never use pipeline promotion or copy the Test slug: it contains Test `REACT_APP_*` values.

### 5.6 Migrate before starting production

```sh
heroku run yarn db:migrate --app "$AV_HEROKU_APP"
heroku ps:scale web=1 --app "$AV_HEROKU_APP"
heroku logs --tail --app "$AV_HEROKU_APP"
```

First verify baseline SSR, the canonical root URL, Live Sharetribe data, and absence of recurring
boot/database errors while the poller and label capability remain disabled.

Then enable the approved launch capabilities:

```sh
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=true \
  AV_SHIPPING_LABELS_ENABLED=true \
  AV_ESHIP_TRACKING_EMAILS_ENABLED=false \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  ESHIP_LABEL_AUTOBUY=false \
  --app "$AV_HEROKU_APP"
```

If welcome email is not fully configured, keep `AV_NOTIFICATIONS_ENABLED=false` and
`AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=false` instead of forcing readiness. Manual shipping labels
can be enabled independently once PostgreSQL, Live Integration credentials, and eShip production
credentials are ready.

Require:

```text
GET /api/notifications/readiness → HTTP 200
GET /api/brevo/health            → HTTP 200 when its features are enabled
web process count                → exactly 1
active poller leaders            → exactly 1 when a start flag is enabled
```

### 5.7 Open production traffic and smoke test

After readiness passes, update public DNS to the Heroku target and verify managed TLS. Then:

- verify apex/www redirects, canonical URLs, SSR, CMS, search, login, and both languages;
- create one real seller and complete real Stripe Connect onboarding;
- publish one approved real listing;
- complete one approved low-value purchase with a production eShip quote;
- verify payment, platform-retained shipping, commission, payout, and transaction shipping data;
- manually buy and download the production label;
- verify welcome/built-in email sender and production links;
- reconcile the eShip carrier charge; and
- record approval before broader traffic or campaigns are enabled.

Keep `AV_BREVO_CAMPAIGNS_ENABLED=false`, `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false`, and
`ESHIP_LABEL_AUTOBUY=false` until their pending gates are independently completed.
`AV_ESHIP_TRACKING_EMAILS_ENABLED` is enabled separately, and only after the Live purchase-process
version, migration `009`, the production `ESHIP_WEBHOOK_SECRET`, and the production eShip dashboard
webhook are all in place.

## 6. Rollback rules

### Before public traffic or real Live records

The release owner may abandon the Live conversion and restore Test operation only by performing the
full reverse boundary:

1. scale `web=0`;
2. restore every Test credential and public variable;
3. reset the database;
4. restore the recorded Test backup;
5. rebuild the browser bundle with Test variables;
6. migrate if required; and
7. rerun Test readiness before scaling to `web=1`.

This is not a routine Heroku release rollback because both compiled configuration and database
contents changed.

### After public traffic or any real Live record

- Never restore the Test backup.
- Never point the app back to Sharetribe Test.
- Never roll back to a pre-cutover Test build artifact.
- Roll back only to a known-good build created with Live variables and verify database
  compatibility.
- Preserve Live database state and reconcile any real Stripe/eShip external outcome before retrying.

## 7. Steady-state deployment after launch

After sign-off, the approved topology is:

| Purpose         | Host   | External environment                     | Database                             |
| --------------- | ------ | ---------------------------------------- | ------------------------------------ |
| Staging/testing | Render | Sharetribe Test, Stripe test, eShip QA   | Staging-only database/state          |
| Production      | Heroku | Sharetribe Live, Stripe live, eShip prod | Reused Heroku add-on, Live-only rows |

For later releases, validate on Render/Test, then rebuild the same reviewed code independently on
Heroku with Live variables. Do not toggle the production Heroku app back to Test for routine
releases, and do not promote a Test artifact into production.

Use [runtime scaling constraints](scaling.md), the [release checklist](release-checklist.md), and
the [operator guide](../operator-guide.md) for ongoing operations.

## Heroku references

- [Scaling a dyno formation](https://devcenter.heroku.com/articles/scaling)
- [Heroku Postgres backups](https://devcenter.heroku.com/articles/heroku-postgres-backups)
- [Managing Heroku Postgres from the CLI](https://devcenter.heroku.com/articles/managing-heroku-postgres-using-cli)
- [Why build-time configuration must not be promoted between environments](https://devcenter.heroku.com/articles/pipelines#design-considerations)
