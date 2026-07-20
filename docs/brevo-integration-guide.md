# Brevo Integration Guide

Archivo Vintach sends seller onboarding and consented lifecycle email through Brevo's v3
transactional-template API. The browser never receives the Brevo API key, contact-list ID, sender
configuration, template IDs, or webhook secret.

The approved Spanish copy, subject lines, preview text, and content notes are in
[`docs/brevo-templates-es.md`](./brevo-templates-es.md). PostgreSQL and notification-worker
operations are documented in [`docs/notification-postgres.md`](./notification-postgres.md).

## Status and pending actions

### Implemented and locally verified

- [x] Seller welcome plus five promotional campaign families are implemented.
- [x] Only Sharetribe user types `vendedor` and `vendedor-tienda` receive seller onboarding.
- [x] Footer, signup, identity-provider signup, and Contact Details consent flows are implemented.
- [x] Marketing sends fail closed against first-party consent and suppression state.
- [x] Brevo contact-list upsert/removal and delivery/suppression webhook handling are implemented.
- [x] The seller guide exists at `public/static/files/ArchivoVintach-how-to.pdf` and is attached to
      seller welcome messages.
- [x] Migrations `001` through `006` apply successfully to the local PostgreSQL container.
- [x] Database leadership, cursor restoration, atomic delivery deduplication, confirmed retry, and
      verification cleanup pass with `yarn db:verify`.
- [x] Server tests, frontend tests, and production builds passed for the implementation.

These checks validate the repository and local database only. They do not prove that a Brevo
account, production DNS, hosted templates, deployment secrets, production PostgreSQL, or production
webhook is configured.

### Required per Brevo/deployment environment

Do not enable production campaign delivery until every applicable item is checked:

- [ ] Confirm that the Brevo account can send transactional email and has sufficient sending
      capacity.
- [ ] Authenticate the production sending domain in Brevo and confirm Brevo shows the required
      domain records, including DKIM and DMARC, as valid.
- [ ] Register and verify the exact sender address used by `BREVO_SENDER_EMAIL`.
- [ ] Generate a dedicated Brevo v3 API key for this integration and store it only in the deployment
      secret manager.
- [ ] Create one dedicated marketing contact list and copy its positive numeric ID.
- [ ] Create and activate all eight hosted transactional templates with the exact parameters and
      Spanish copy documented below.
- [ ] Put a clear Spanish unsubscribe link and the approved legal sender footer in all seven
      promotional templates.
- [ ] Generate a high-entropy webhook secret and configure one **transactional email**, non-batched
      webhook with the required events.
- [ ] Set every required production environment variable. Do not use `REACT_APP_*` names for
      secrets.
- [ ] Set the canonical production `REACT_APP_MARKETPLACE_ROOT_URL` with no trailing slash so email
      links do not point to localhost or staging.
- [ ] Run `yarn db:migrate` against the production database before deploying the application
      version.
- [ ] Deploy first with lifecycle campaigns disabled, complete the smoke-test matrix, then enable
      lifecycle campaigns.
- [ ] Confirm both readiness endpoints return HTTP `200`, exactly one web process owns the poller,
      and Brevo webhook events reach PostgreSQL.
- [ ] Record the Brevo account owner, API-key rotation owner/date, sender/domain owner, list ID,
      webhook ID, and eight template IDs in the team's secret/configuration inventory.

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
| Seller welcome           | `user/created`; immediate; only `vendedor` and `vendedor-tienda`                                                            | Transactional onboarding; not consent-gated. Attaches `ArchivoVintach-how-to.pdf`.                                                                         |
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

Use exact lowercase `true` or `false` for feature flags. When `AV_NOTIFICATIONS_ENABLED=true`, every
channel flag must be set explicitly. Production startup rejects incomplete configuration for enabled
channels.

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
| `BREVO_WEBHOOK_SECRET`                   | Campaigns enabled; recommended for any Brevo email | High-entropy shared secret accepted only in the `x-av-brevo-webhook-secret` header (not the URL).                                                                                        |
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

| Environment variable                 | Required template parameters/content                                                                                  | Unsubscribe                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `BREVO_TEMPLATE_SELLER_WELCOME`      | `NOMBRE`, `MARKETPLACE_URL`, `CREATE_LISTING_URL`, `GUIDE_URL`; application also attaches `ArchivoVintach-how-to.pdf` | Not required for essential onboarding |
| `BREVO_TEMPLATE_VIEWED_LISTING_A`    | `NOMBRE`, `LISTING_URL`, `LISTING.title`, `LISTING.priceFormatted`, `LISTING.imageUrl`                                | Required                              |
| `BREVO_TEMPLATE_VIEWED_LISTING_B`    | Same as viewed A                                                                                                      | Required                              |
| `BREVO_TEMPLATE_ABANDONED_CHECKOUT`  | `NOMBRE`, `LISTING_URL`, `LISTING.title`, `LISTING.priceFormatted`, `LISTING.imageUrl`                                | Required                              |
| `BREVO_TEMPLATE_MATCHING_LISTINGS_A` | `NOMBRE`, `MARKETPLACE_URL`, `SEARCH_URL`, loop over up to three `LISTINGS` objects                                   | Required                              |
| `BREVO_TEMPLATE_MATCHING_LISTINGS_B` | Same as matching A                                                                                                    | Required                              |
| `BREVO_TEMPLATE_SIGNUP_NO_LISTING`   | `NOMBRE`, `CREATE_LISTING_URL`, `GUIDE_URL`                                                                           | Required                              |
| `BREVO_TEMPLATE_LISTING_NO_ACTIVITY` | `NOMBRE`, `LISTING_URL`                                                                                               | Required                              |

Campaign messages receive these common values even if one template only uses a subset:

- `NOMBRE`, falling back to `Usuario`;
- `MARKETPLACE_URL`, `LISTING_URL`, `CREATE_LISTING_URL`, `SEARCH_URL`, and `GUIDE_URL`;
- `LISTING`; and
- `LISTINGS`, limited to three results.

Each matching-listing object's `path` is relative. Build its link from `MARKETPLACE_URL` plus
`path`; do not link a bare relative path from the email client.

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
   ```

5. Confirm `GET /api/brevo/health` and `GET /api/notifications/readiness` return HTTP `200`.
6. Confirm exactly one process owns the poller and its heartbeat/sequence advance.
7. Test anonymous footer opt-in and confirm the normalized address joins only the configured list.
8. Test email and identity-provider signup with consent both unchecked and checked.
9. Test Contact Details opt-in, withdrawal, page reload, and Brevo list membership.
10. Trigger seller welcome with a `vendedor` and `vendedor-tienda`; verify copy, CTA URLs, tags,
    sender authentication, and the committed 2.3 MB PDF attachment. Confirm other user types do not
    receive it.
11. Exercise each promotional trigger with dedicated consented test users while campaigns remain
    disabled; inspect whether expected pending jobs are created without sending.
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
| Webhook returns `401`                                                                   | Confirm the deployed secret exactly matches the `x-av-brevo-webhook-secret` header value (a `?secret=` query string is not accepted).                       |
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
