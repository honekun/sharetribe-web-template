# Brevo Integration Guide

Archivo Vintach sends seller onboarding and consented lifecycle email through Brevo's v3
transactional-template API. The browser never receives the Brevo API key, contact-list ID, sender
configuration, template IDs, or webhook secret.

The approved Spanish copy, subject lines, preview text, and content notes are in
[`brevo-templates-es.md`](brevo-templates-es.md). PostgreSQL and notification-worker operations are
documented in [`notification-postgres.md`](notification-postgres.md).

## Current implementation and deployment requirements

The application implements seller welcome email plus five promotional campaign families. Seller
welcome applies only to Sharetribe user types `vendedor` and `vendedor-tienda`; marketing delivery
is consent- and suppression-gated. Footer, signup, identity-provider signup, and Contact Details
flows maintain the preference, while Brevo contact and webhook services synchronize provider state.
The seller welcome attaches `public/static/files/HowTo-AV_low.pdf` (shown to the recipient as
`ArchivoVintach-how-to.pdf`).

Repository support does not prove that a Brevo account, production DNS, hosted templates, deployment
secrets, PostgreSQL schema, or production webhook is configured. Verify each deployment environment
separately.

## Which system sends which email

Decided 2026-10-10: the split between Sharetribe and Brevo stays as built. The rule is simple:

- **Sharetribe sends everything that belongs to an account or a transaction.** That covers the
  built-in account emails (email verification, password reset, email change, new message) and every
  transaction-process notification in `ext/transaction-processes/*/templates`, including the eShip
  pickup email. eShip's `TRANSIT` checkpoint makes the app run `transition/eship-picked-up-from-*`,
  and the process sends `purchase-order-in-transit-customer`.
- **Brevo sends everything outside a transaction:** the seller welcome email and the lifecycle
  campaigns.

Why transaction email stays in Sharetribe:

- A notification fires atomically with its transition, and a reminder is pinned to its deadline in
  `process.edn`. Moving one to Brevo would mean replaying it from the poller instead: up to five
  minutes late, and lost whenever the dyno or PostgreSQL is down.
- The templates already use Sharetribe's transaction data, `es_MX` locale and Console email texts.
  Sharetribe sends them at no extra cost, while Brevo's free plan allows 300 sends a day.
- Account emails can't move at all: Sharetribe owns the verification and reset tokens.

Why welcome and campaigns stay in Brevo:

- Sharetribe has no trigger outside a transaction. A welcome on `user/created`, a delay of 24 or 72
  hours, a listing view or a new matching listing can only come from the app's poller.
- The welcome email attaches the PDF guide, and Sharetribe templates can't attach files.
- Campaigns are marketing. They need consent, unsubscribe and suppression handling, an A/B split and
  a frequency cap, which Brevo and the consent ledger provide. Sharetribe's emails are for
  transactional messages only.
- Abandoned checkout is triggered by a transaction (`transition/expire-payment`) but is still
  promotional, so it stays in Brevo and remains consent-gated.

Rules that follow from this:

- Don't add a Brevo email for something a transaction transition already announces, and don't put
  promotional copy in a Sharetribe template.
- Make both systems look like one sender. Use the same `archivovintach.com` address, the same
  visible name (`BREVO_SENDER_NAME` and the Sharetribe Live sender name should match), and a
  monitored reply-to. Sharetribe Live's custom sending domain needs its own DNS records in GoDaddy.
  Merge any SPF include into the existing record rather than adding a second `v=spf1`, and keep the
  shared `_dmarc` record.
- The welcome email arrives right after Sharetribe's verification email, so it must not repeat the
  "verify your email" step.

## Setup status (audited 2026-10-09)

Re-checked after the domain was authenticated. Read-only checks against the Brevo API (using the key
configured on Heroku), the Heroku app `archivo-vintach-marketplace`, and its database:

| Item                          | State                                                                                                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brevo account                 | Company **ARCHIVO VINTACH** — a dedicated account; the Heroku key was rotated off the old Retop MX account on 2026-10-09.                                                                                                                     |
| Plan / capacity               | `free` plan, **300 sends per day**.                                                                                                                                                                                                           |
| Sending domains               | **`archivovintach.com` authenticated and verified** (Brevo code, DKIM `brevo1`/`brevo2._domainkey` CNAMEs, DMARC all green).                                                                                                                  |
| Senders                       | `ARCHIVO VINTACH <hola@archivovintach.com>`, active.                                                                                                                                                                                          |
| `archivovintach.com` mail DNS | MX points to Google Workspace. DMARC `_dmarc` TXT is now `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`. Google Workspace DKIM not yet checked.                                                                                           |
| Contact list                  | `BREVO_LIST_ID` is **7**, "Test ArchivoVintach", for the Test phase; a footer signup on Heroku landed there on 2026-10-10. Production list: 6 "Live ArchivoVintach", 0 subscribers. Also present: 4 "ARCHIVO — Seller Waitlist" (109), 3, 2.  |
| Transactional templates       | **None of the eight exist.** Only Brevo's four default double-opt-in templates.                                                                                                                                                               |
| Transactional webhook         | **None.**                                                                                                                                                                                                                                     |
| Consent contact attributes    | None of the five exist, so `BREVO_CONSENT_ATTRIBUTES_ENABLED` must stay `false`.                                                                                                                                                              |
| Heroku variables set          | `BREVO_API_KEY`, `BREVO_LIST_ID=7` (Test phase), `BREVO_SENDER_EMAIL=hola@archivovintach.com`, `BREVO_SENDER_NAME=ARCHIVO VINTACH`, `BREVO_CONSENT_ATTRIBUTES_ENABLED=false`, Integration credentials, `DATABASE_URL`.                        |
| Heroku variables missing      | `BREVO_WEBHOOK_SECRET`, every `BREVO_TEMPLATE_*`.                                                                                                                                                                                             |
| Heroku flags                  | `AV_NOTIFICATIONS_ENABLED=false`, `AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=false`, `AV_BREVO_CAMPAIGNS_ENABLED=false`, `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false`, `AV_SHIPPING_LABELS_ENABLED=true`, `AV_ESHIP_TRACKING_EMAILS_ENABLED=false`. |
| App side                      | `/api/brevo/health` → `200` (ready, nothing enabled). The guide PDF is served at `/static/files/ArchivoVintach-how-to.pdf` (200, 2.4 MB). Consent tables are empty.                                                                           |

**What works today:** the footer newsletter and Contact Details opt-in, because they need only the
API key and list ID, and the domain plus sender are ready (A1–A3). **What does not:** the seller
welcome email (no template, sender variables, or flags) and every lifecycle campaign.

**Launch needs only Phase A below** (the seller welcome). Campaigns (Phase B) stay off at launch.

## Decisions to make first

1. **Sending identity.** ✅ Decided: `ARCHIVO VINTACH <hola@archivovintach.com>` on the
   authenticated `archivovintach.com`. Make sure `hola@` is a real, monitored Google Workspace
   mailbox, group or alias — seller replies land there.
2. **Account ownership.** ✅ A dedicated ARCHIVO VINTACH Brevo account now holds the key. Name its
   owner (the person who can rotate keys and see billing). The old Retop MX key that leaked through
   the Render bundle has been deleted (step A3).
3. **Capacity.** The free plan's 300 sends per day covers the seller welcome at launch volumes.
   Before Phase B, size the plan for campaign volume (each consented user can receive up to two
   promotional emails per seven days).
4. **Test-phase list.** ✅ The Heroku app runs against Sharetribe Test until cutover, so footer
   signups made while testing go to list 7 "Test ArchivoVintach" (`BREVO_LIST_ID=7`, set
   2026-10-10). Switch to 6 "Live ArchivoVintach" at cutover (step A11).
5. **Existing list members** (109 in "ARCHIVO — Seller Waitlist"). They have no first-party consent
   evidence in the Live database, and PostgreSQL is authoritative, so campaigns will never mail
   them. Either leave them (manual Brevo newsletters still reach them) or ask them to opt in again
   after launch. Do not import them into the consent tables.
6. **Welcome copy.** ✅ Decided 2026-10-10: the client approved the copy as is, keeping the
   pre-eShip step "Coordina la entrega" (see [`brevo-templates-es.md`](brevo-templates-es.md)). The
   subject is the gender-neutral `Te damos la bienvenida a Archivo Vintach ✨`. The guide is the May
   2026 design, served as the web-optimized `HowTo-AV_low.pdf`.

## Completion runbook

Commands assume a shell with:

```sh
export AV_HEROKU_APP=archivo-vintach-marketplace
# Read the key into the shell without printing it. Unset it when finished.
export BREVO_API_KEY="$(heroku config:get BREVO_API_KEY --app "$AV_HEROKU_APP")"
```

The Brevo API sits behind Cloudflare, which rejects some HTTP clients (Python `urllib` gets error
1010); `curl` works.

### Phase A — seller welcome email (required for launch)

**A1. Authenticate `archivovintach.com` in Brevo** — ✅ done 2026-10-09 (all four records green).

1. Brevo → **Settings → Senders, domains, IPs → Domains → Add a domain** → `archivovintach.com`.
2. Brevo lists the records to publish: a `brevo-code` TXT, DKIM records, and a DMARC TXT. If it
   offers automatic authentication for GoDaddy, use it; otherwise copy each record **exactly as
   Brevo shows it** into GoDaddy → **Domains → archivovintach.com → DNS → Add record**. Do not copy
   values from this guide or another account.
3. Do **not** change the MX records (Google Workspace receives mail there) or the `www`/apex records
   reserved for the Heroku cutover.
4. For DMARC, the domain has none today, so add the one Brevo suggests (normally `p=none`). Because
   `p=none` only reports, it cannot block Google Workspace mail. Tighten it later only after Google
   Workspace DKIM is enabled too.
5. Back in Brevo, click **Authenticate this email domain** and wait until every record shows a green
   check (DNS can take up to 48 hours; usually minutes on GoDaddy).

Verify:

```sh
curl -s -H "api-key: $BREVO_API_KEY" -H 'accept: application/json' \
  https://api.brevo.com/v3/senders/domains/archivovintach.com
# expect "authenticated": true and "verified": true
```

**A2. Create the sender** — ✅ `ARCHIVO VINTACH <hola@archivovintach.com>` is active. A test send on
2026-10-10 reached Gmail with SPF, DKIM (`archivovintach.com`) and DMARC all `PASS`. Brevo →
**Senders, domains, IPs → Senders → Add a sender**: name `ARCHIVO VINTACH`, email the address chosen
in decision 1. Brevo emails a confirmation link to that mailbox, so it must exist in Google
Workspace and someone must be able to read it; replies from sellers also go there.

**A3. Use a dedicated API key** — ✅ Heroku now holds a key from the ARCHIVO VINTACH account. The
old Retop MX key, which was public in the Render bundle until Render was rebuilt without
`REACT_APP_BREVO_*`, was deleted on 2026-10-10. To rotate again later: Brevo → **Settings → SMTP &
API → API keys → Generate a new API key**, named `Archivo Vintach production`. Brevo shows it once.
Set it straight onto Heroku without echoing it:

```sh
read -rs NEW_KEY && heroku config:set BREVO_API_KEY="$NEW_KEY" --app "$AV_HEROKU_APP" >/dev/null; unset NEW_KEY
```

Then delete the old key in Brevo once the footer signup works with the new one (A9).

**A4. Choose the list for the Test phase** (decision 4) — ✅ list 7 "Test ArchivoVintach" is set on
Heroku and a footer signup reached it (2026-10-10). To create a test list from scratch:

```sh
curl -s -X POST -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' \
  https://api.brevo.com/v3/contacts/lists \
  -d '{"name":"ArchivoVintach TEST","folderId":1}'
# returns {"id": N}; then:
heroku config:set BREVO_LIST_ID=N --app "$AV_HEROKU_APP"
```

`folderId` must be an existing folder; list them with `GET /v3/contacts/folders` if `1` is rejected.
The production list for step A11 is 6 "Live ArchivoVintach".

**A5. Create the seller welcome template.**

1. Brevo → **Transactional → Templates → New template** (in some account layouts: **Campaigns →
   Templates → Transactional**). Name it `AV seller welcome`.
2. Subject: `Te damos la bienvenida a Archivo Vintach ✨`. Preview text:
   `Tu closet ahora tiene otro destino posible.`
3. Sender: the sender from A2. Reply-to: the same mailbox.
4. Build the body from the `BREVO_TEMPLATE_SELLER_WELCOME` copy in
   [`brevo-templates-es.md`](brevo-templates-es.md), with decision 6 applied. Insert parameters
   exactly as `{{ params.NOMBRE }}`, `{{ params.CREATE_LISTING_URL }}`, and `{{ params.GUIDE_URL }}`
   (case-sensitive). Make both CTAs real buttons/links whose URL is the parameter. Do not hard-code
   a host.
5. Do not add the PDF in Brevo: the application attaches `HowTo-AV_low.pdf` itself. No unsubscribe
   link is required (onboarding is essential, not marketing).
6. Save, then **activate** the template. Note its numeric ID (shown in the template list or URL).
7. Send yourself a test from the template editor and check: no visible `{{ … }}`, buttons work,
   mobile layout, From name/address.

To create it through the API instead, write the HTML to a local file (not in the repository) and:

```sh
jq -n --rawfile html welcome.html --arg sender "hola@archivovintach.com" '{
  templateName: "AV seller welcome", subject: "Te damos la bienvenida a Archivo Vintach ✨",
  sender: { name: "ARCHIVO VINTACH", email: $sender }, replyTo: $sender,
  htmlContent: $html, isActive: true }' |
  curl -s -X POST -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' \
    https://api.brevo.com/v3/smtp/templates -d @-
# returns {"id": N}; set the preview text afterwards in the Brevo editor
```

**A6. Create the transactional webhook.** Recommended before the first welcome send so bounces and
blocks are recorded. Generate a secret and store it without printing it:

```sh
BREVO_WEBHOOK_SECRET="$(openssl rand -hex 32)"
heroku config:set BREVO_WEBHOOK_SECRET="$BREVO_WEBHOOK_SECRET" --app "$AV_HEROKU_APP" >/dev/null
APP_HOST="$(heroku apps:info --app "$AV_HEROKU_APP" --json | jq -r '.app.web_url' | sed 's#https://##; s#/$##')"

jq -n --arg url "https://$APP_HOST/api/brevo/webhook" --arg secret "$BREVO_WEBHOOK_SECRET" '{
  type: "transactional", channel: "email", batched: false,
  description: "Archivo Vintach transactional email - heroku test phase",
  url: $url,
  events: ["delivered","softBounce","hardBounce","blocked","spam","unsubscribed"],
  headers: [{ key: "x-av-brevo-webhook-secret", value: $secret }] }' |
  curl -s -X POST -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' \
    https://api.brevo.com/v3/webhooks -d @-
unset BREVO_WEBHOOK_SECRET
# returns {"id": N}; record it
```

The API is used because the secret must travel as a custom header, which not every Brevo UI layout
exposes. Leave the unrelated marketing `spam` webhook alone unless its owner confirms it is unused.

**A7. Configure Heroku and turn the welcome on.** All of these are server-only, so no rebuild is
needed; `config:set` restarts the dyno. The sender variables are already set
(`hola@archivovintach.com` / `ARCHIVO VINTACH`, 2026-10-10), so only the template ID remains.

```sh
heroku config:set --app "$AV_HEROKU_APP" \
  BREVO_TEMPLATE_SELLER_WELCOME=N

heroku config:set --app "$AV_HEROKU_APP" \
  AV_NOTIFICATIONS_ENABLED=true \
  AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true \
  AV_BREVO_CAMPAIGNS_ENABLED=false \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false
```

Use the sender from decision 1 and the template ID from A5. The event cursor already exists
(shipping labels have run the poller since 2026-10-09), so enabling the poller does not replay old
`user/created` events: only accounts created from now on get the welcome.

**A8. Verify readiness.**

```sh
curl -s https://$APP_HOST/api/brevo/health              # {"ready":true,"enabled":true,...,"missing":[]}
curl -s -o /dev/null -w '%{http_code}\n' https://$APP_HOST/api/notifications/readiness   # 200
heroku logs --tail --app "$AV_HEROKU_APP" | grep -E 'eventPoller|brevo|notificationAlert'
```

A `503` or a startup error names the missing variable. Fix it before continuing.

**A9. End-to-end tests** (Test phase, team mailboxes only):

1. Sign up a new `vendedor` account in the Test marketplace. Within about five minutes (one poll)
   the welcome arrives: Spanish subject, correct name, both buttons open the herokuapp host (it is
   the root URL until cutover), and the PDF is attached.
2. Repeat with `vendedor-tienda`.
3. In Brevo → **Transactional → Logs**, find both sends; then confirm the delivered events reached
   the app:

   ```sh
   heroku pg:psql --app "$AV_HEROKU_APP" --command \
     "SELECT event, count(*) FROM av_brevo_webhook_events GROUP BY 1;"
   ```

4. Footer newsletter: subscribe a test address; it appears in the list from A4 and in
   `av_marketing_preferences`.
5. Contact Details: opt in, reload, opt out; Brevo list membership follows.
6. Open the welcome from Gmail and from Outlook and check "Show original" / headers: DKIM and DMARC
   pass for the sending domain, and it is not in spam.

**A10. Record the inventory** (outside the repository): Brevo account owner, API key name and
rotation date, sender address, domain owner, test and production list IDs, welcome template ID,
webhook ID.

**A11. At the Live cutover** (in addition to the
[Heroku runbook](../operations/heroku-deployment.md) §5):

- `BREVO_LIST_ID` → the production list 6 "Live ArchivoVintach"
  (`heroku config:set BREVO_LIST_ID=6`), then delete the test contacts left in list 7.
- `REACT_APP_MARKETPLACE_ROOT_URL=https://www.archivovintach.com` is set before the Live build, so
  email links point to the production host.
- Point the webhook at the production host (the herokuapp host stays reachable, but production
  traffic and logs should use the canonical one):

  ```sh
  curl -s -X PUT -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' \
    https://api.brevo.com/v3/webhooks/WEBHOOK_ID \
    -d '{"url":"https://www.archivovintach.com/api/brevo/webhook","description":"Archivo Vintach transactional email - production"}'
  ```

- `pg:reset` empties the consent and webhook tables. That is expected: Test-phase consent belongs to
  test accounts.
- After reopening, repeat A8 and A9 step 1 with a real Live `vendedor` signup.

### Phase B — lifecycle campaigns (after launch)

Keep `AV_BREVO_CAMPAIGNS_ENABLED=false` until all of this is done:

1. Resolve decision 3 (plan capacity).
2. Create and activate the seven promotional templates from
   [`brevo-templates-es.md`](brevo-templates-es.md), following A5, each with Brevo's unsubscribe
   link and the approved legal sender footer (sender identity and postal/contact address). Record
   their IDs.
3. Optional Brevo-side consent evidence: create the five attributes, then set
   `BREVO_CONSENT_ATTRIBUTES_ENABLED=true` and restart:

   ```sh
   for a in CONSENT_AT CONSENT_SOURCE CONSENT_LOCALE CONSENT_POLICY_VERSION SHARETRIBE_USER_ID; do
     curl -s -X POST -H "api-key: $BREVO_API_KEY" -H 'content-type: application/json' \
       "https://api.brevo.com/v3/contacts/attributes/normal/$a" -d '{"type":"text"}'
   done
   ```

4. Set the seven `BREVO_TEMPLATE_*` IDs on Heroku. The webhook secret and list ID from Phase A are
   reused.
5. Run steps 12–15 of the [safe deployment sequence](#safe-deployment-sequence) with dedicated
   consented test users, then step 16.

## Architecture

- `server/services/eventPoller.js` is the PostgreSQL-elected worker. It consumes Sharetribe events
  and processes due jobs every five minutes.
- `server/services/notificationCampaignService.js` maps Sharetribe events and first-party engagement
  into delayed jobs.
- `server/services/notificationJobs.js` stores delayed jobs and listing engagement in PostgreSQL.
- `server/services/marketingConsent.js` stores current preference/suppression state plus append-only
  evidence.
- `server/services/brevoEmailService.js` sends hosted templates and project-local attachments.
- `server/services/brevoContactService.js` links opted-in contacts to the configured Brevo list and
  unlinks withdrawals.
- `server/api/brevo.js` handles footer signup, account preferences, qualified engagement, health,
  and Brevo webhooks.
- `server/services/notificationDelivery.js` retains the atomic provider-delivery ledger and operator
  retry workflow.

Migration `005_marketing_notifications.sql` must be applied in every environment before campaigns
are enabled.

## Campaign catalog

| Campaign                 | Trigger and delay                                                                                                           | Cancellation / final eligibility                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seller welcome           | `user/created`; immediate; only `vendedor` and `vendedor-tienda`                                                            | Transactional onboarding; not consent-gated. Attaches `HowTo-AV_low.pdf`.                                                                                  |
| Viewed listing A/B       | Authenticated non-owner remains on a listing page for 10 seconds; 24 hours after latest qualified view                      | Anonymous views count only toward seller activity and never schedule buyer email. Cancel on favorite, inquiry, or purchase. Listing must remain published. |
| Abandoned checkout       | `transition/expire-payment`; 30 minutes after Sharetribe expires payment                                                    | Cancel if transaction later confirms/cancels. Shopping-bag and ordinary inquiry activity are excluded.                                                     |
| Matching listings A/B    | First observed publication matched to consented view/favorite behavior from prior 90 days; next 09:00 `America/Mexico_City` | Category required. Brand, size, and color rank results. Up to three published listings; one digest per user/day.                                           |
| Signup without listing   | Seller `user/created`; 24 hours                                                                                             | Skip if seller has a published listing.                                                                                                                    |
| Listing without activity | First publication; 72 hours                                                                                                 | Skip after qualified non-owner view, favorite, inquiry, or purchase, or if listing is no longer published.                                                 |

Viewed and matching variants use a stable hash of the Sharetribe user ID, so one user stays in the
same A/B group. All promotional campaigns share a rolling cap of two sent messages per user per
seven days. A capped job is deferred until the oldest message leaves that window.

## Required application configuration

Use distinct Brevo resources and secrets for staging and production. Values below are placeholders;
never commit real values.

```sh
# Global notification worker and explicit channel flags
AV_NOTIFICATIONS_ENABLED=true
AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true
AV_BREVO_CAMPAIGNS_ENABLED=false
AV_WHATSAPP_NOTIFICATIONS_ENABLED=false
# The poller also requires these two to be explicit, whatever their value
AV_SHIPPING_LABELS_ENABLED=true
AV_ESHIP_TRACKING_EMAILS_ENABLED=false

# Sharetribe Integration API and durable PostgreSQL
SHARETRIBE_INTEGRATION_CLIENT_ID=
SHARETRIBE_INTEGRATION_CLIENT_SECRET=
DATABASE_URL=

# Canonical public host used in every email CTA; no trailing slash
REACT_APP_MARKETPLACE_ROOT_URL=https://MARKETPLACE_HOST

# Brevo API, contacts, sender, and webhook
BREVO_API_KEY=
BREVO_LIST_ID=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=Archivo Vintach
BREVO_WEBHOOK_SECRET=
BREVO_CONSENT_ATTRIBUTES_ENABLED=false

# Positive IDs of active hosted transactional templates
BREVO_TEMPLATE_SELLER_WELCOME=
BREVO_TEMPLATE_VIEWED_LISTING_A=
BREVO_TEMPLATE_VIEWED_LISTING_B=
BREVO_TEMPLATE_ABANDONED_CHECKOUT=
BREVO_TEMPLATE_MATCHING_LISTINGS_A=
BREVO_TEMPLATE_MATCHING_LISTINGS_B=
BREVO_TEMPLATE_SIGNUP_NO_LISTING=
BREVO_TEMPLATE_LISTING_NO_ACTIVITY=
```

Use exact lowercase `true` or `false` for feature flags. `AV_NOTIFICATIONS_ENABLED`,
`AV_SHIPPING_LABELS_ENABLED`, and `AV_ESHIP_TRACKING_EMAILS_ENABLED` must always be explicit; when
`AV_NOTIFICATIONS_ENABLED=true`, the welcome, campaign, and WhatsApp flags must be explicit too.
Production startup rejects incomplete configuration for enabled channels.

### Setting reference

| Setting                                  | Required when                                      | Format and purpose                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AV_NOTIFICATIONS_ENABLED`               | Always set in deployment                           | Global poller switch. Set `true` only when Integration API and PostgreSQL are ready.                                                                                                    |
| `AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED` | Global poller enabled                              | Explicit channel switch for seller welcome.                                                                                                                                             |
| `AV_BREVO_CAMPAIGNS_ENABLED`             | Global poller enabled                              | Explicit switch for all consented lifecycle campaigns. Keep `false` during initial verification.                                                                                        |
| `AV_WHATSAPP_NOTIFICATIONS_ENABLED`      | Global poller enabled                              | Explicitly set `false` when WhatsApp is not being configured.                                                                                                                           |
| `SHARETRIBE_INTEGRATION_CLIENT_ID`       | Global poller enabled                              | Server-only Sharetribe Integration API credential.                                                                                                                                      |
| `SHARETRIBE_INTEGRATION_CLIENT_SECRET`   | Global poller enabled                              | Server-only Sharetribe Integration API secret.                                                                                                                                          |
| `DATABASE_URL`                           | Global poller enabled                              | Shared durable PostgreSQL URL used by every web process.                                                                                                                                |
| `REACT_APP_MARKETPLACE_ROOT_URL`         | Any email delivery                                 | Canonical public origin, such as `https://archivovintach.com`, without trailing slash. Used to build listing, search, signup, and PDF URLs. This is public configuration, not a secret. |
| `BREVO_API_KEY`                          | Footer/account sync or any Brevo email             | Dedicated v3 key. Required for contact `POST`/`PUT` and transactional email `POST`. Server only.                                                                                        |
| `BREVO_LIST_ID`                          | Footer/account sync or campaigns enabled           | Positive numeric ID of the dedicated consented-marketing list. It is required for consent syncing even when campaign sending is still disabled.                                         |
| `BREVO_SENDER_EMAIL`                     | Welcome or campaigns enabled                       | Exact registered sender address on the authenticated domain.                                                                                                                            |
| `BREVO_SENDER_NAME`                      | Welcome or campaigns enabled                       | Visible sender name, normally `Archivo Vintach`.                                                                                                                                        |
| `BREVO_WEBHOOK_SECRET`                   | Campaigns enabled; recommended for any Brevo email | High-entropy shared secret accepted only in the `x-av-brevo-webhook-secret` header (not the URL).                                                                                       |
| `BREVO_CONSENT_ATTRIBUTES_ENABLED`       | Optional                                           | Set `true` only after all five contact attributes below exist. Restart after changing it. PostgreSQL remains authoritative.                                                             |
| `BREVO_TEMPLATE_*`                       | Corresponding channel enabled                      | Positive numeric ID of an **active** Brevo transactional template.                                                                                                                      |

The footer subscription and Contact Details preference endpoints need `BREVO_API_KEY` and
`BREVO_LIST_ID` even if `AV_BREVO_CAMPAIGNS_ENABLED=false`. The campaign readiness check cannot
validate an external Brevo resource; an HTTP `200` therefore does not replace an end-to-end
contact-sync test.

## Brevo account setup

### 1. API key

Create a dedicated API key named for the application and environment, for example
`Archivo Vintach production`. The running application uses it to:

- send `POST /v3/smtp/email`;
- create/update contacts with `POST /v3/contacts`; and
- unlink withdrawn contacts with `PUT /v3/contacts/{email}`.

Store the key as `BREVO_API_KEY` in the deployment secret manager. Brevo only displays a newly
generated key once; record its owner and planned rotation date. Never expose it to browser code,
logs, documentation, support tickets, or hosted template content.

### 2. Sending domain and sender

In Brevo, add the production sending domain, publish the exact DNS records Brevo provides, and wait
for the domain to show as authenticated. Do not copy DNS values from another account or this guide.
Confirm DKIM and DMARC status in Brevo before sending.

Create or verify the sender:

```text
Name:  Archivo Vintach
Email: value used for BREVO_SENDER_EMAIL
```

Set the same visible name in `BREVO_SENDER_NAME`. Send test messages to Gmail, Outlook, and a custom
domain and inspect From, reply behavior, DKIM, DMARC, spam placement, links, and mobile rendering.

### 3. Dedicated consented-marketing list

Create a list specifically for Archivo Vintach application consent. Copy the numeric list ID—not its
display name—into `BREVO_LIST_ID`.

Runtime behavior is:

- granting consent upserts the normalized email with `updateEnabled: true` and links it to this
  list;
- withdrawing consent unlinks it from this list but does not delete the Brevo contact;
- provider suppression is retained in PostgreSQL and cancels pending promotional jobs; and
- promotional send eligibility is always rechecked in PostgreSQL.

Do not manually import non-consented users into this list. Existing rows in the legacy
`av_newsletter_consent` table are backfilled as granted preferences by migration `005`; all other
users default to opted out.

### 4. Optional contact attributes

PostgreSQL is the source of truth. If Brevo-side evidence is useful, create these exact uppercase
attributes as normal text attributes before setting `BREVO_CONSENT_ATTRIBUTES_ENABLED=true`:

| Attribute                | Value written by the application                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `CONSENT_AT`             | ISO-8601 grant timestamp                                                                 |
| `CONSENT_SOURCE`         | `footer_newsletter`, `signup_email`, `signup_idp`, `account_details`, or `brevo_webhook` |
| `CONSENT_LOCALE`         | Consent locale, currently `es`                                                           |
| `CONSENT_POLICY_VERSION` | Consent-copy policy version, currently `2026-07-19`                                      |
| `SHARETRIBE_USER_ID`     | Sharetribe user UUID when available                                                      |

Text is intentional for `CONSENT_AT` because the application sends a full ISO timestamp, not only a
calendar date. A missing or misspelled attribute can cause Brevo contact synchronization to fail, so
leave mirroring disabled until an end-to-end opt-in test succeeds.

## Hosted transactional templates

Create every template under Brevo's transactional template area. For each template:

1. Use Brevo's New Template Language and keep every `params` name and letter case exact.
2. Configure the Spanish subject and preview text from `brevo-templates-es.md`.
3. Select the verified Archivo Vintach sender.
4. Build and test desktop/mobile HTML plus a readable text fallback where supported.
5. Save and **activate** the template.
6. Copy its positive numeric ID into the matching environment variable.
7. Send a test with representative parameters and confirm there are no unrendered placeholders,
   broken images, relative links, or empty buttons.

The API supplies `sender`, recipient, `templateId`, `params`, tags, and any attachment. It does not
override the subject, so the active Brevo template must contain the approved subject.

| Environment variable                 | Required template parameters/content                                                                         | Unsubscribe                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `BREVO_TEMPLATE_SELLER_WELCOME`      | `NOMBRE`, `MARKETPLACE_URL`, `CREATE_LISTING_URL`, `GUIDE_URL`; application also attaches `HowTo-AV_low.pdf` | Not required for essential onboarding |
| `BREVO_TEMPLATE_VIEWED_LISTING_A`    | `NOMBRE`, `LISTING_URL`, `LISTING.title`, `LISTING.priceFormatted`, `LISTING.imageUrl`                       | Required                              |
| `BREVO_TEMPLATE_VIEWED_LISTING_B`    | Same as viewed A                                                                                             | Required                              |
| `BREVO_TEMPLATE_ABANDONED_CHECKOUT`  | `NOMBRE`, `LISTING_URL`, `LISTING.title`, `LISTING.priceFormatted`, `LISTING.imageUrl`                       | Required                              |
| `BREVO_TEMPLATE_MATCHING_LISTINGS_A` | `NOMBRE`, `MARKETPLACE_URL`, `SEARCH_URL`, loop over up to three `LISTINGS` objects                          | Required                              |
| `BREVO_TEMPLATE_MATCHING_LISTINGS_B` | Same as matching A                                                                                           | Required                              |
| `BREVO_TEMPLATE_SIGNUP_NO_LISTING`   | `NOMBRE`, `CREATE_LISTING_URL`, `GUIDE_URL`                                                                  | Required                              |
| `BREVO_TEMPLATE_LISTING_NO_ACTIVITY` | `NOMBRE`, `LISTING_URL`, `LISTING.title`                                                                     | Required                              |

Campaign messages receive these common values even if one template only uses a subset:

- `NOMBRE`, falling back to `Usuario`;
- `MARKETPLACE_URL`, `LISTING_URL`, `CREATE_LISTING_URL`, `SEARCH_URL`, and `GUIDE_URL`;
- `LISTING`; and
- `LISTINGS`, limited to three results.

`LISTING` and each `LISTINGS` entry have the same fields: `title`, `priceFormatted` (for example
`$1,250.00`, MXN only; empty otherwise), `imageUrl` (may be `null`), `path`, `closet` (the seller's
display name), `id`, `slug`, `price.amount`/`price.currency`, `category`, `brand`, `sizes`,
`colors`, and `state`. Matching-listing entries also carry a ranking `score`. These values are
captured when the job is scheduled. Only matching listings are reloaded before sending, so a
viewed-listing, abandoned-checkout, or listing-without-activity email may show a title, price, or
image up to 24 or 72 hours old.

Each matching-listing object's `path` is relative. Build its link from `MARKETPLACE_URL` plus
`path`; do not link a bare relative path from the email client. `LISTING_URL` always opens the
public listing page, including in the listing-without-activity email whose CTA reads "Editar mi
prenda" — the seller reaches the editor from there.

All seven promotional templates must include:

- a clear Spanish unsubscribe link using Brevo's supported unsubscribe feature;
- the approved legal sender identity and postal/contact footer; and
- no wording that suggests the essential seller welcome is also consent-gated.

Use a test recipient to click unsubscribe and verify that Brevo emits `event: "unsubscribed"` to the
application before enabling campaigns.

## Transactional webhook

Create one webhook for **transactional email**, not a marketing-campaign webhook.

Required settings:

```text
Description: Archivo Vintach transactional email - ENVIRONMENT
Type:        transactional
Channel:     email
Batched:     false
URL:         https://MARKETPLACE_HOST/api/brevo/webhook
```

Select at least:

```text
delivered
softBounce
hardBounce
blocked
spam
unsubscribed
```

Brevo's webhook-configuration API uses names such as `softBounce` and `hardBounce`; delivered
payloads may contain `soft_bounce` and `hard_bounce`. The application records every selected event.
It locally suppresses and cancels pending promotional jobs for `unsubscribed`, `spam`,
`hard_bounce`/`hardBounce`, and `blocked`. Soft bounces and delivered events update audit/delivery
status but do not suppress.

Suppression is **sticky**: once a contact is suppressed, the anonymous footer subscribe form cannot
silently re-enable them (it would re-mail hard bounces and re-subscribe people who never proved
ownership). Only an authenticated account-owner opt-in (`PUT /api/brevo/preference`) or a future
double-opt-in can lift suppression. Delivery webhooks are idempotent — a duplicate Brevo delivery of
the same `(message-id, event)` is deduplicated (migration `006`).

### Preferred webhook authentication

Generate a different random secret for each environment, for example with:

```sh
openssl rand -hex 32
```

Store it as `BREVO_WEBHOOK_SECRET`. The webhook is authenticated by a **custom header only** — the
secret is deliberately not accepted in the URL, so it can't leak into access/proxy logs:

```text
x-av-brevo-webhook-secret: THE_SAME_SECRET
```

Configure the Brevo webhook to send this header. If the webhook flow you're using cannot send a
custom header, that configuration is unsupported (a `?secret=` query string will be rejected with
`401`).

Keep `batched=false`; the endpoint accepts one Brevo event object per request. A valid event returns
HTTP `204`. An invalid or missing secret returns `401`. A database failure returns `503`, allowing
Brevo to treat the delivery as unsuccessful.

The webhook:

- stores the event, provider message ID, timestamp, and only a hash of the recipient in
  `av_brevo_webhook_events`;
- updates the matching `av_notification_deliveries` row by Brevo message ID; and
- applies first-party suppression for permanent failure, complaint/spam, blocked, and unsubscribe
  events.

Test the webhook from Brevo after deployment. Then send a real template email and confirm its Brevo
message ID receives a delivered event in PostgreSQL. A direct browser `GET` is not a valid webhook
test because the route accepts `POST`.

## Consent model

Marketing consent is optional and unchecked on email signup and identity-provider confirmation. The
same preference is available under Contact Details.

Approved Spanish consent text:

> Quiero recibir novedades, recomendaciones personalizadas y recordatorios de Archivo Vintach por
> correo electrónico. Puedo darme de baja en cualquier momento.

Rules:

- Existing footer subscribers are backfilled as opted in by normalized email.
- Other users default to opted out.
- Every grant, withdrawal, or suppression is appended to `av_newsletter_consent`; current state
  lives in `av_marketing_preferences`.
- Withdrawal cancels pending promotional jobs and removes Brevo list membership.
- Every promotional send rechecks consent, suppression, email address, campaign state, resource
  state, and the rolling frequency cap.
- Consent belongs to an email address. Requesting an account email change revokes the old address;
  the verified new address starts opted out.
- Seller welcome is essential onboarding and is not affected by marketing preference.

## Application endpoints

| Endpoint                           | Access                                           | Purpose                                                                 |
| ---------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `POST /api/brevo/subscribe`        | Public, rate-limited, honeypot                   | Footer consent plus Brevo contact/list upsert                           |
| `GET /api/brevo/preference`        | Signed-in user                                   | Read authoritative preference for current account/email                 |
| `PUT /api/brevo/preference`        | Signed-in user, rate-limited                     | Grant/withdraw, sync Brevo membership, mirror Sharetribe protected data |
| `POST /api/brevo/engagement`       | Public view/authenticated favorite, rate-limited | Record server-validated qualified view or favorite                      |
| `POST /api/brevo/webhook`          | Shared-secret authenticated                      | Record delivery events and apply provider suppression                   |
| `GET /api/brevo/health`            | Deployment probe                                 | Validate configured welcome/campaign flags and required values          |
| `GET /api/notifications/readiness` | Deployment probe                                 | Validate flags, PostgreSQL schema, cursor, ledger, jobs, and metrics    |

The engagement endpoint loads the listing through the Sharetribe SDK and resolves the current user
when a session exists. Anonymous qualified views are stored without user ID, email, or first name
and only affect seller-activity checks. Favorites require authentication. Client-supplied recipient,
seller, category, and listing data are not trusted.

## Safe deployment sequence

1. Complete the Brevo domain, sender, API key, list, template, legal-footer, and webhook setup.
2. Set production secrets, URLs, positive template IDs, and all explicit channel flags.
3. Run `yarn db:migrate` against the production `DATABASE_URL`.
4. Deploy with:

   ```sh
   AV_NOTIFICATIONS_ENABLED=true
   AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true
   AV_BREVO_CAMPAIGNS_ENABLED=false
   AV_WHATSAPP_NOTIFICATIONS_ENABLED=false
   AV_SHIPPING_LABELS_ENABLED=true
   AV_ESHIP_TRACKING_EMAILS_ENABLED=false
   ```

5. Confirm `GET /api/brevo/health` and `GET /api/notifications/readiness` return HTTP `200`.
6. Confirm exactly one process owns the poller and its heartbeat/sequence advance.
7. Test anonymous footer opt-in and confirm the normalized address joins only the configured list.
8. Test email and identity-provider signup with consent both unchecked and checked.
9. Test Contact Details opt-in, withdrawal, page reload, and Brevo list membership.
10. Trigger seller welcome with a `vendedor` and `vendedor-tienda`; verify copy, CTA URLs, tags,
    sender authentication, and the committed ≈0.9 MB PDF attachment. Confirm other user types do not
    receive it.
11. While campaigns are disabled, the poller neither schedules nor sends campaign jobs
    (`eventPoller.js` checks the flag before both), so there is nothing to observe yet; confirm
    `av_notification_jobs` stays empty.
12. Temporarily enable campaigns in the controlled environment, exercise each campaign, and inspect
    `av_notification_jobs`, `av_notification_deliveries`, `av_brevo_webhook_events`, and the Brevo
    transactional log.
13. Click unsubscribe and confirm the account is suppressed, Brevo list membership is removed, and a
    pending promotional job is cancelled.
14. Test a hard bounce with a Brevo-approved test method/address and confirm suppression without
    using a real third party's address.
15. Confirm the seven-day cap and one-digest-per-day behavior with test data.
16. Enable `AV_BREVO_CAMPAIGNS_ENABLED=true` in production and recheck both readiness endpoints.

Local database commands:

```sh
yarn db:setup
yarn db:verify
```

Production migration:

```sh
yarn db:migrate
```

Useful operator checks:

```sh
yarn notifications:list
yarn notifications:list failed
yarn notifications:list unknown
```

Provider timeouts remain `unknown` and are never resent automatically. Reconcile the matching
message/tag in Brevo before:

```sh
yarn notifications:retry NOTIFICATION_KEY --confirm-unknown
```

## Troubleshooting

| Symptom                                                                                 | Check                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production refuses to start                                                             | Inspect the missing-variable list from notification configuration; flags must be exact `true`/`false`, and enabled template IDs must be positive integers. |
| Footer or Contact Details returns `brevo_subscribe_failed` / `preference_update_failed` | Check API key validity, positive list ID, contact-attribute names/types, Brevo response logs, and PostgreSQL availability.                                 |
| Readiness is `503`                                                                      | Check `DATABASE_URL`, migration `005`, Integration API credentials, enabled-channel variables, active template IDs, and poller ownership.                  |
| Template sends but placeholders are visible                                             | Confirm New Template Language and exact uppercase/lowercase `params` names.                                                                                |
| Email links point to the wrong host                                                     | Correct `REACT_APP_MARKETPLACE_ROOT_URL` and restart/redeploy.                                                                                             |
| Welcome arrives without PDF                                                             | Confirm the committed file exists in the deployed artifact and the template uses New Template Language.                                                    |
| Webhook returns `401`                                                                   | Confirm the deployed secret exactly matches the `x-av-brevo-webhook-secret` header value (a `?secret=` query string is not accepted).                      |
| Webhook events never arrive                                                             | Confirm type `transactional`, channel `email`, public HTTPS URL, selected events, `batched=false`, and Brevo webhook test/log status.                      |
| Unsubscribe does not suppress                                                           | Confirm the template uses Brevo's supported unsubscribe link and the resulting webhook payload event is `unsubscribed`.                                    |
| No process owns the poller                                                              | Check global flag, Integration API credentials, shared PostgreSQL, migration state, pool size of at least two, and process logs.                           |

## Brevo references

- [Create and manage Brevo API keys](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys)
- [Authenticate a sending domain](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)
- [Send transactional email with a hosted template](https://developers.brevo.com/docs/send-a-transactional-email)
- [Create a transactional webhook](https://developers.brevo.com/reference/create-webhook)
- [Transactional webhook payloads](https://developers.brevo.com/docs/transactional-webhooks)
- [Create contact attributes](https://developers.brevo.com/reference/create-attribute)
- [Brevo unsubscribe guidance](https://help.brevo.com/hc/en-us/articles/9741388688402-Do-I-need-to-add-an-unsubscribe-link-to-my-emails)
