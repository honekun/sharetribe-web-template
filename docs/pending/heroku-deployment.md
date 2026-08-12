# Pending Heroku rollout — Archivo Vintach

Status: proposed future hosting topology. The current repository-declared staging target remains
Render; do not execute this guide as a routine release runbook until the migration is approved.

Step-by-step plan to deploy this app to Heroku, linked first to the **Sharetribe Test environment**
(for end-to-end verification with Stripe test keys), and then the exact steps to switch the
deployment to the **Sharetribe Live environment** for production.

> **How environments work in Sharetribe:** the API base URL is the same for Test and Live
> (`flex-api.sharetribe.com`). Which environment the app talks to is determined **entirely by the
> Client ID** you configure. "Linking to test" = using the Test environment's Marketplace API client
> ID; going live = swapping in the Live environment's client ID (plus Stripe live keys). Users,
> listings, and transactions are **never shared** between Test and Live — only content and
> configuration can be copied across in Console.

Related docs: [`operations/scaling.md`](../operations/scaling.md) (in-memory state and the `web=1`
constraint — read before scaling),
[`implementation/bulk-import.md`](../implementation/bulk-import.md), and
[`operations/test-accounts.md`](../operations/test-accounts.md).

---

## Phase 0 — Prerequisites

Do these once, before touching Heroku.

### 0.1 Accounts & access

- [ ] Heroku account with a verified payment method (dynos are billed).
- [ ] Sharetribe Console access (`https://console.sharetribe.com`) with both **Test** and **Live**
      environments visible in the environment switcher.
- [ ] Stripe account connected to the marketplace: **test keys** (`pk_test_`/`sk_test_`) for Phase
      1, **live keys** (`pk_live_`/`sk_live_`) for Phase 3. Stripe **secret** keys are set in
      Sharetribe Console (Build → Payments), never in Heroku.
- [ ] Access to the Brevo, Meta (WhatsApp), and eShip accounts for every integration you intend to
      enable. Channel flags are explicit; enabled channels fail readiness when required variables
      are missing.

### 0.2 Install and authenticate the Heroku CLI

Verify that the Heroku CLI is installed; install it if the version check fails:

```sh
heroku --version
brew tap heroku/brew && brew install heroku
heroku login          # opens a browser; interactive — run it yourself, not through scripts
heroku auth:whoami    # verify
```

### 0.3 Collect the Test-environment credentials

In Console, with the environment switcher set to **Test**:

1. **Marketplace API application** — Console → Build → Applications → Add new (or reuse an existing
   one). Note the **Client ID** (public) and **Client Secret** (server-only; required — the
   negotiation/privileged transitions and line-item endpoints use it).
2. **Integration API** — Console → Build → Integrations → Create integration. Note **Client ID**
   - **Client Secret**. Powers AV-noti notifications, bulk import, and reading seller shipping
     origins for eShip quotes. Must be created **per environment** (a Test integration cannot see
     Live events).
3. **Stripe** — Console → Build → Payments: confirm the **test secret key** (`sk_test_`) is set in
   the Test environment. Copy the matching **`pk_test_` publishable key** from the Stripe dashboard
   for Heroku.
4. **Mapbox token** (or Google Maps key) — same token works in both environments.

### 0.4 Sanity-check the branch locally

Deploy from a branch that builds and passes tests:

```sh
yarn test-ci                       # server + client suites
yarn run config-check              # env/config validation
yarn run build                     # verifies the production build compiles
```

Notes on how Heroku will build this repo:

- **No Procfile** — Heroku runs the `start` script: `node server/index.js` (SSR server). This is
  correct; don't add a Procfile unless you later add a worker dyno.
- **`heroku-postbuild`** runs `yarn build` (`build-web` + `build-server`) automatically on every
  push.
- **Node version** comes from `package.json` → `"engines": { "node": "^22.22.0 || >=24.0.0" }`;
  Heroku's Node buildpack honors it. Yarn 1 is detected from `yarn.lock`.
- Heroku sets `NODE_ENV=production` and `PORT` itself — do not set either manually.

---

## Phase 1 — Create the Heroku app linked to the Test environment

### 1.1 Create the app

```sh
cd <repo-root>
heroku create archivo-vintach-test --region us   # pick eu if closer to users; MX → us
git remote -v                                    # confirms the new `heroku` remote
heroku addons:create heroku-postgresql:PLAN_NAME --app archivo-vintach-test
heroku config:get DATABASE_URL --app archivo-vintach-test  # confirm the add-on attached it
```

> **Recommendation: use two Heroku apps** — `archivo-vintach-test` (permanently pinned to the
> Sharetribe Test env; this phase) and later `archivo-vintach` (pinned to Live; Phase 3). A pipeline
> may group the apps, but do not promote the staging build artifact to production: `REACT_APP_*`
> configuration is embedded at build time and differs between Test and Live. Two apps keep a
> permanent test target without flipping one app's credentials between environments.

### 1.2 Set the config vars (Test values)

Everything in `.env-template` that applies. Required core first:

```sh
heroku config:set \
  REACT_APP_SHARETRIBE_SDK_CLIENT_ID=<TEST-marketplace-client-id> \
  SHARETRIBE_SDK_CLIENT_SECRET=<TEST-marketplace-client-secret> \
  REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_... \
  REACT_APP_MAPBOX_ACCESS_TOKEN=<mapbox-token> \
  REACT_APP_MARKETPLACE_ROOT_URL=https://archivo-vintach-test.herokuapp.com \
  REACT_APP_MARKETPLACE_NAME=ArchivoVintach \
  REACT_APP_ENV=production \
  REACT_APP_SHARETRIBE_USING_SSL=true \
  SERVER_SHARETRIBE_TRUST_PROXY=true \
  REACT_APP_CSP=report \
  --app archivo-vintach-test
```

> `REACT_APP_ENV=production` is correct even on the test app — it means "deployed build", not "live
> marketplace". `SERVER_SHARETRIBE_TRUST_PROXY=true` is required behind Heroku's router so secure
> cookies and redirects work. Start CSP in `report` mode; switch to `block` once the report-only
> phase shows no violations from real pages.

Configure each AV capability deliberately. In production, every notification and label feature flag
must be set explicitly to `true` or `false`; enabling a capability without its required
configuration fails startup/readiness instead of silently disabling the feature.

```sh
# AV-noti (Brevo lifecycle email, WhatsApp) + bulk import + eShip origin lookup
heroku config:set \
  SHARETRIBE_INTEGRATION_CLIENT_ID=<TEST-integration-client-id> \
  SHARETRIBE_INTEGRATION_CLIENT_SECRET=<TEST-integration-client-secret> \
  --app archivo-vintach-test

# Brevo (consented lifecycle email + seller welcome)
heroku config:set \
  BREVO_API_KEY=<key> BREVO_LIST_ID=<id> \
  BREVO_SENDER_EMAIL=<sender@domain> BREVO_SENDER_NAME="Archivo Vintach" \
  BREVO_WEBHOOK_SECRET=<random-secret> \
  BREVO_TEMPLATE_SELLER_WELCOME=<id> \
  BREVO_TEMPLATE_VIEWED_LISTING_A=<id> BREVO_TEMPLATE_VIEWED_LISTING_B=<id> \
  BREVO_TEMPLATE_ABANDONED_CHECKOUT=<id> \
  BREVO_TEMPLATE_MATCHING_LISTINGS_A=<id> BREVO_TEMPLATE_MATCHING_LISTINGS_B=<id> \
  BREVO_TEMPLATE_SIGNUP_NO_LISTING=<id> \
  BREVO_TEMPLATE_LISTING_NO_ACTIVITY=<id> \
  --app archivo-vintach-test

# First boot: keep every poller/channel capability off until PostgreSQL is migrated.
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=false \
  AV_SHIPPING_LABELS_ENABLED=false \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=false \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  --app archivo-vintach-test

# WhatsApp (Meta Cloud API — templates must already be approved)
heroku config:set \
  WHATSAPP_ACCESS_TOKEN=<token> WHATSAPP_PHONE_NUMBER_ID=<id> \
  WHATSAPP_ADMIN_PHONE=<+52...> \
  --app archivo-vintach-test

# eShip live shipping quotes — ESHIP_BASE_URL is required (no hardcoded default);
# use the QA base URL while on the Test environment.
heroku config:set \
  ESHIP_API_KEY=<key> \
  ESHIP_BASE_URL=https://apiqa.myeship.co/rest \
  ESHIP_API_DEBUG=true \
  --app archivo-vintach-test

# Bulk import
heroku config:set \
  BULK_IMPORT_OPERATOR_EMAILS=<approved-operator@example.com> \
  BULK_IMPORT_LISTING_TYPE=av-listing \
  BULK_IMPORT_TRANSACTION_ALIAS=default-purchase/release-1 \
  BULK_IMPORT_UNIT_TYPE=item \
  REACT_APP_PROVIDER_COMMISSION_FIXED_FEE=1500 \
  --app archivo-vintach-test
```

Verify: `heroku config --app archivo-vintach-test` and cross-check against `.env-template`
(`yarn run env-template-check` documents the expected set).

### 1.3 Deploy

Heroku builds whatever lands on its `main`. Push the selected release branch explicitly:

```sh
git push heroku <release-branch>:main  # or: git push heroku main
heroku logs --tail --app archivo-vintach-test
```

Watch the build for `yarn build` completing, then the boot log. At this stage, expect the Express
server to listen with no event poller because both poller-start flags remain `false`.

### 1.4 Migrate PostgreSQL, then enable tested capabilities

Run the migrations before any notification or label capability can start:

```sh
heroku run yarn db:migrate --app archivo-vintach-test
```

After the Brevo/eShip configuration above is complete, enable only the capabilities being tested.
Keep campaigns and WhatsApp guarded until their separate smoke/blocker gates pass:

```sh
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=true \
  AV_SHIPPING_LABELS_ENABLED=true \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  --app archivo-vintach-test

curl --fail https://archivo-vintach-test.herokuapp.com/api/notifications/readiness
```

The event poller starts only when `AV_NOTIFICATIONS_ENABLED=true` or
`AV_SHIPPING_LABELS_ENABLED=true`, and only after readiness passes. If readiness fails, set the two
start flags back to `false`, fix the named database/configuration check, and rerun the migration
before trying again.

### 1.5 Pin the dyno formation

Per [`operations/scaling.md`](../operations/scaling.md), the bulk importer and its action-token
store are in-process — **`web=1` is a hard constraint** until the Redis/worker options are
implemented. The notification poller itself is coordinated safely through PostgreSQL:

```sh
heroku ps:scale web=1 --app archivo-vintach-test
heroku ps --app archivo-vintach-test        # confirm one web dyno
```

Use a non-sleeping dyno so the SSR server and five-minute event poller remain available. Bulk-import
memory depends on ZIP expansion, image sizes, concurrent jobs, and runtime overhead; monitor real
peak memory and size vertically when needed. Never scale horizontally while the importer still uses
process-local coordination.

### 1.6 Point the Sharetribe Test environment at the Heroku app

In Console (**Test** environment):

- [ ] **Marketplace URL**: set to `https://archivo-vintach-test.herokuapp.com` (Console → General /
      going-live settings). This drives links in Sharetribe's built-in emails (password reset, email
      verification, transaction notifications).
- [ ] **Social logins** (if `REACT_APP_FACEBOOK_APP_ID` / `REACT_APP_GOOGLE_CLIENT_ID` are set): add
      `https://archivo-vintach-test.herokuapp.com/api/auth/facebook/callback` and
      `.../api/auth/google/callback` to the allowed redirect URIs in the Facebook/Google dev
      consoles, and set the secrets (`FACEBOOK_APP_SECRET`, `GOOGLE_CLIENT_SECRET`) in Heroku.
- [ ] Confirm hosted content exists in Test: landing page, `content/pricing-plans.json` (schema in
      [`pricing-plans.md`](pricing-plans.md)), footer, top-bar assets — the app renders these from
      hosted assets at runtime.

---

## Phase 2 — Test plan against the Test environment

Run through this checklist on the Heroku URL before touching Live. Use test users from
[`operations/test-accounts.md`](../operations/test-accounts.md) and Stripe test cards
(`4242 4242 4242 4242`, any future expiry/CVC; SCA card `4000 0025 0000 3155`).

**Platform basics**

- [ ] Landing page SSR: `curl -s https://archivo-vintach-test.herokuapp.com | grep '<title>'`
      returns rendered HTML (not an empty shell). Check a listing page and a CMS page too.
- [ ] Search page `/s` with filters (categories, brand, all_sizes grouped filter, color).
- [ ] Signup + email verification (link must point at the Heroku URL — proves the Console
      Marketplace URL is right).
- [ ] Login/logout across page reloads (cookie domain/SSL — proves `TRUST_PROXY`/SSL vars).

**Seller flow**

- [ ] Create a listing through the wizard (photos in Details step, originalPrice, earnings
      estimator) as a `vendedor` user; Stripe Connect onboarding with test data (Mexico).
- [ ] Set a shipping origin at `/account/shipping-origin`.
- [ ] Welcome popup appears once for a new seller and stays dismissed.

**Buyer flow (the critical path)**

- [ ] Checkout a shippable listing: MX destination form → live eShip quote returns Estándar/Express
      buckets → pick one → pay with `4242...` → transaction completes.
- [ ] Verify the order breakdown (shipping line item matches the picked bucket, commission lines
      correct) and that `protectedData.avShipping` is persisted on the transaction (Console →
      Transactions).
- [ ] `Contactar AV` fallback: attempt checkout on a listing whose seller has **no** shipping origin
      — the selector must show the fallback, not a broken quote.
- [ ] Negotiation flow: Make offer / Request quote → accept → pay.
- [ ] `/my-purchases`, `/my-sales`, `/my-balance` render with real transaction data.

**AV integrations**

- [ ] AV-noti: create fresh `vendedor` and `vendedor-tienda` users → seller welcome arrives with
      `ArchivoVintach-how-to.pdf` within ~5 min. A buyer account must not receive that seller email.
- [ ] Marketing preference is unchecked on email/social signup, is editable under Contact Details,
      and an email-change request revokes the old-address preference.
- [ ] Brevo webhook delivery appears in `av_brevo_webhook_events`; unsubscribe suppresses the local
      preference and cancels a pending promotional job.
- [ ] After all campaign trigger tests pass, set `AV_BREVO_CAMPAIGNS_ENABLED=true` and verify
      `/api/notifications/readiness` remains `200`.
- [ ] Bulk import at `/admin/bulk-import`: small CSV as a normal user (listings author to self),
      then an operator CSV with `user_id` column.
- [ ] Newsletter form subscribes (check the Brevo list).

**Ops**

- [ ] `heroku logs --tail`: no repeating errors; CSP violation reports reviewed (then flip
      `REACT_APP_CSP=block` and re-smoke the app).
- [ ] `heroku restart` mid-session: users stay logged in; the replacement poller acquires leadership
      and resumes from the durable PostgreSQL cursor without duplicate sends.

Fix anything that fails here, redeploy (`git push heroku ...`), and re-run the affected section.
**Do not proceed to Phase 3 with open failures on the buyer flow.**

---

## Phase 3 — Going live: switch to the Sharetribe Live environment

### 3.1 Prepare the Live environment in Console

Switch the Console environment selector to **Live**:

- [ ] **Copy configuration & content from Test** — Console has a "copy changes to live" flow for
      hosted assets (pages, top bar, footer, listing types/fields, transaction process settings,
      translations, `content/pricing-plans.json`). Review the diff before applying. **Users,
      listings, and transactions do NOT copy** — Live starts empty.
- [ ] **Stripe live keys**: Console (Live) → Build → Payments → set the `sk_live_` secret key.
      Confirm Stripe Connect platform settings are complete for live mode (business profile,
      branding, payout schedule).
- [ ] **Outgoing email address**: Live requires a verified custom sender (SPF/DKIM DNS records) —
      Console → General → Outgoing email settings. Built-in emails won't send from an unverified
      domain.
- [ ] **New Live credentials**:
  - Marketplace API application (Live) → Client ID + Client Secret.
  - Integration API (Live) → Client ID + Client Secret (create a new integration; Test one can't see
    Live events).
- [ ] Marketplace URL (Live) → the production domain (e.g. `https://archivovintach.com`).
- [ ] Social login redirect URIs: add the production domain callbacks in the Facebook/Google
      consoles.

### 3.2 Create the production Heroku app

```sh
heroku create archivo-vintach --region us
heroku addons:create heroku-postgresql:PLAN_NAME --app archivo-vintach
heroku config:get DATABASE_URL --app archivo-vintach
heroku pipelines:create archivo-vintach --app archivo-vintach-test --stage staging
heroku pipelines:add archivo-vintach --app archivo-vintach --stage production
```

Custom domain + TLS:

```sh
heroku domains:add www.archivovintach.com --app archivo-vintach
heroku domains:add archivovintach.com --app archivo-vintach
heroku certs:auto:enable --app archivo-vintach
# then create the DNS targets Heroku prints (ALIAS/ANAME for apex, CNAME for www)
```

### 3.3 Set the production config vars

Same variable set as Phase 1.2 — these values change:

| Variable                                                                | Test app value                       | Production value                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REACT_APP_SHARETRIBE_SDK_CLIENT_ID`                                    | Test env client ID                   | **Live env client ID**                                                                                                                                           |
| `SHARETRIBE_SDK_CLIENT_SECRET`                                          | Test env secret                      | **Live env secret**                                                                                                                                              |
| `SHARETRIBE_INTEGRATION_CLIENT_ID/SECRET`                               | Test integration                     | **Live integration**                                                                                                                                             |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY`                                      | `pk_test_...`                        | **`pk_live_...`**                                                                                                                                                |
| `REACT_APP_MARKETPLACE_ROOT_URL`                                        | herokuapp.com URL                    | **`https://www.archivovintach.com`** (no trailing slash; must match the canonical domain exactly — it's used for redirects, sitemap, and social-login callbacks) |
| `ESHIP_BASE_URL`                                                        | QA (`https://apiqa.myeship.co/rest`) | **`https://api.myeship.co/rest`** (required — no hardcoded default)                                                                                              |
| `ESHIP_API_DEBUG`                                                       | `true`                               | **unset/`false`** (never echo carrier errors publicly)                                                                                                           |
| `AV_SHIPPING_LABELS_ENABLED`                                            | `true` after migration               | **`true` after migration** (label capability; independent of notifications)                                                                                      |
| `ESHIP_LABEL_AUTOBUY`                                                   | unset/`false`                        | **unset/`false` at launch** (seller-triggered label purchase; enable only after the cancellation/refund policy is approved)                                      |
| `REACT_APP_CSP`                                                         | `report` → `block`                   | **`block`** (already validated in Phase 2)                                                                                                                       |
| Everything else (Mapbox, Brevo, WhatsApp, bulk-import, SSL/proxy flags) | same                                 | same                                                                                                                                                             |

```sh
heroku config:set REACT_APP_SHARETRIBE_SDK_CLIENT_ID=<LIVE-id> ... --app archivo-vintach
heroku config:set ESHIP_BASE_URL=https://api.myeship.co/rest --app archivo-vintach
heroku config:unset ESHIP_API_DEBUG --app archivo-vintach
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=false \
  AV_SHIPPING_LABELS_ENABLED=false \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=false \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  ESHIP_LABEL_AUTOBUY=false \
  --app archivo-vintach
```

Double-check with `heroku config --app archivo-vintach` — the classic go-live mistakes are a
leftover `pk_test_` key (payments fail with "No such token") and a Test client ID (users/listings
"missing" because the app is silently reading the Test environment).

### 3.4 Deploy, migrate, and enable production

```sh
git push https://git.heroku.com/archivo-vintach.git main
heroku run yarn db:migrate --app archivo-vintach
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=true \
  AV_SHIPPING_LABELS_ENABLED=true \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  --app archivo-vintach
curl --fail https://www.archivovintach.com/api/notifications/readiness
heroku ps:scale web=1 --app archivo-vintach
heroku logs --tail --app archivo-vintach
```

Do not enable the two poller-start flags until `DATABASE_URL` is attached and `yarn db:migrate` has
completed for this production database. If readiness fails, disable them again and resolve the named
check before the live smoke test.

> Client config vars are baked into the bundle at **build** time (`REACT_APP_*`). Deploy the same
> reviewed commit to each app independently so staging builds with Test values and production builds
> with Live values. Do not promote a staging build slug into production.

### 3.5 Live smoke test (real money, small amounts)

- [ ] SSR + login + search on the production domain; `http://` and apex/www variants all redirect to
      the canonical `REACT_APP_MARKETPLACE_ROOT_URL`.
- [ ] Create one real listing; complete Stripe Connect onboarding with real seller details.
- [ ] One **real low-value purchase** end-to-end (real card, live eShip quote), then verify payout
      math in Stripe and refund/cancel it per your process.
- [ ] Welcome email arrives from the verified sender domain. Keep WhatsApp disabled until the
      blocking items in [`notifications.md`](notifications.md) are resolved.
- [ ] Built-in Sharetribe emails (verification, transaction) link to the production domain.

### 3.6 Post-launch ops

- [ ] `heroku labs:enable log-runtime-metrics` (or an APM/logging add-on) + Sentry: set
      `REACT_APP_SENTRY_DSN` if using Sentry.
- [ ] Analytics: `REACT_APP_GOOGLE_ANALYTICS_ID` / `REACT_APP_PLAUSIBLE_DOMAINS`.
- [ ] Rollback plan: `heroku releases --app archivo-vintach` → `heroku rollback v<N>` (rolls back
      slug + config as a unit).
- [ ] Calendar note: dynos cycle regularly — in-flight bulk imports are dropped, while the event
      poller resumes from its durable PostgreSQL cursor. See
      [`operations/scaling.md`](../operations/scaling.md) before ever scaling `web` past 1.
- [ ] Keep the Test app + Sharetribe Test env as the permanent staging path: deploy every change
      there first (`git push heroku-test <branch>:main`), run the Phase 2 checklist's relevant
      subset, then push the same commit to production.

---

## Quick reference — what differs per environment

| Concern                         | Test deployment                            | Live deployment                            |
| ------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Sharetribe env selector         | Test                                       | Live                                       |
| Marketplace + Integration creds | Test-env                                   | Live-env (separate apps/integrations)      |
| Stripe                          | `pk_test_` (Heroku) + `sk_test_` (Console) | `pk_live_` (Heroku) + `sk_live_` (Console) |
| Root URL                        | `*.herokuapp.com`                          | Custom domain, ACM certs                   |
| eShip                           | QA base URL, debug on                      | Explicit production base URL, debug off    |
| CSP                             | `report` → `block`                         | `block`                                    |
| Email sender                    | Sharetribe default                         | Verified custom domain (SPF/DKIM)          |
| Users/listings/transactions     | Disposable test data                       | Real — never copied from Test              |
