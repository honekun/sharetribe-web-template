# WhatsApp Integration Guide

This guide documents the WhatsApp notification implementation that currently exists in Archivo
Vintach and the configuration required in the application, Sharetribe Console, and Meta. It is
intended for Test and Live environment setup, release verification, and troubleshooting.

> **First-release posture:** WhatsApp notifications are not part of the release. The implementation
> is retained, but `notificationConfig.js` release-locks the channel off and
> `notificationDelivery.js` blocks operator retries. The signup phone-field component is retained
> with its imports/usages commented out. Keep `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false`; setting it
> to `true` cannot override the code lock. A later rollout also requires WA-01 through WA-03 in
> [`pending/notifications.md`](../pending/notifications.md) to be resolved.

## 1. Scope and architecture

WhatsApp notifications are sent server-side through the Meta WhatsApp Cloud API. The browser never
receives the Meta access token.

The flow is:

1. `server/index.js` starts `server/services/eventPoller.js` after the web server begins listening
   when `AV_NOTIFICATIONS_ENABLED=true` or `AV_SHIPPING_LABELS_ENABLED=true`, and only when the
   explicit configuration readiness check passes.
2. The poller queries Sharetribe Integration API events every five minutes. Its first query runs
   approximately five seconds after startup.
3. It handles `user/created`, `transaction/transitioned`, and `message/created`.
4. `server/services/whatsappService.js` looks up recipient phone numbers from
   `profile.protectedData.phoneNumber`, normalizes them to E.164, and calls Meta's
   `/{phone-number-id}/messages` endpoint.
5. Meta renders one of nine approved Spanish (Mexico) message templates.

No client-side WhatsApp SDK, Meta webhook, or Sharetribe webhook is used.

The current implementation:

- polls at five-minute intervals;
- drains up to ten pages of 100 events per poll by default, with pacing between pages;
- retries a failed send once, for two total attempts;
- skips user notifications when the recipient has no protected phone number;
- logs Meta API acceptance or failure, but does not track delivery/read receipts;
- stores its cursor, recent-event state, and delivery claims durably in PostgreSQL; and
- uses a PostgreSQL advisory lock so multiple web processes share one active poller safely.

## 2. Message catalog

All template names and the `es_MX` language code must match Meta exactly. Template names are
hard-coded in the application.

Only `av_welcome_user` and `av_admin_new_user` receive body variables. The other seven templates
must have no body variables unless the application is changed to send them.

| Template                | Sharetribe event / transition                                                  | Recipient                                                                     | Body variables sent by the app                       |
| ----------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| `av_welcome_user`       | `user/created`                                                                 | New user, only when the phone number is already present on the creation event | `{{1}}` first name                                   |
| `av_admin_new_user`     | `user/created`                                                                 | `WHATSAPP_ADMIN_PHONE`                                                        | `{{1}}` first name, `{{2}}` last name, `{{3}}` email |
| `av_purchase_confirmed` | `transaction/transitioned`: `transition/confirm-payment`                       | Customer/buyer                                                                | None                                                 |
| `av_sale_received`      | `transaction/transitioned`: `transition/confirm-payment`                       | Provider/seller                                                               | None                                                 |
| `av_delivered`          | `transition/mark-delivered` or `transition/operator-mark-delivered`            | Customer/buyer                                                                | None                                                 |
| `av_cancelled`          | `transition/cancel`, `transition/auto-cancel`, or `transition/operator-cancel` | Customer and provider                                                         | None                                                 |
| `av_booking_accepted`   | `transition/accept` or `transition/operator-accept`                            | Customer/buyer                                                                | None                                                 |
| `av_booking_declined`   | `transition/decline` or `transition/operator-decline`                          | Customer/buyer                                                                | None                                                 |
| `av_new_message`        | Any `message/created`; also the three offer transitions listed below           | Other transaction party for a message; provider for an offer transition       | None                                                 |

The offer transitions mapped to `av_new_message` are:

- `transition/make-offer`
- `transition/make-offer-after-inquiry`
- `transition/make-offer-from-request`

Transition matching is exact. Similar transition names are not included automatically. For example,
`transition/cancel-from-disputed`, `transition/auto-cancel-from-disputed`, and
`transition/operator-cancel-from-delivered` do not send `av_cancelled` under the current rules.

### Recommended Meta template definitions

The wording below is a starting point that matches the current parameter contract. The business
owner may change static wording before submitting a template, but must preserve the exact template
name, language, and variable count/order.

Use Meta's **Utility** category for these service and transaction updates, subject to Meta's final
classification.

#### `av_welcome_user`

Body:

```text
Hola {{1}}, ¡bienvenido/a a Archivo Vintach! Tu cuenta ya está activa. Explora piezas vintage y publica tus artículos en https://archivovintach.com.
```

Example value for approval: `Ana`

#### `av_admin_new_user`

Body:

```text
Nuevo registro en Archivo Vintach.
Nombre: {{1}} {{2}}
Correo: {{3}}
```

Example values for approval: `Ana`, `López`, `ana@example.com`

#### `av_purchase_confirmed`

Body:

```text
Tu compra en Archivo Vintach fue confirmada. Te avisaremos cuando la persona vendedora marque el pedido como entregado.
```

#### `av_sale_received`

Body:

```text
Recibiste una nueva venta en Archivo Vintach. Revisa Mis ventas para consultar los detalles y preparar el envío.
```

#### `av_delivered`

Body:

```text
Tu pedido de Archivo Vintach fue marcado como entregado. Revisa Mis compras y confirma la recepción cuando lo tengas.
```

#### `av_cancelled`

This template goes to both transaction parties, so its wording must work for buyers and sellers.

Body:

```text
Una operación de Archivo Vintach fue cancelada. Revisa Mis compras o Mis ventas para consultar los detalles.
```

#### `av_booking_accepted`

Body:

```text
Tu reserva en Archivo Vintach fue aceptada. Revisa Mis compras para consultar los detalles.
```

#### `av_booking_declined`

Body:

```text
Tu reserva en Archivo Vintach no fue aceptada. Revisa Mis compras para consultar los detalles.
```

#### `av_new_message`

This template is used for both ordinary transaction messages and offer transitions, so it must be
generic.

Body:

```text
Tienes una nueva actualización en una conversación de Archivo Vintach. Inicia sesión para revisarla.
```

## 3. Application-side configuration

All variables are server-only. Set them in the deployment environment; never add secrets to a
`REACT_APP_*` variable or commit them to an `.env` file.

| Variable                               | Required            | Purpose                                                                                        |
| -------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `AV_NOTIFICATIONS_ENABLED`             | Yes (explicit flag) | Enables notification polling; set `false` to keep all notification channels off                |
| `AV_WHATSAPP_NOTIFICATIONS_ENABLED`    | Yes (explicit flag) | Must be `false` for the first release; a code lock also prevents activation                    |
| `SHARETRIBE_INTEGRATION_CLIENT_ID`     | Yes when enabled    | Authenticates Integration API reads                                                            |
| `SHARETRIBE_INTEGRATION_CLIENT_SECRET` | Yes when enabled    | Integration API secret paired with the client ID                                               |
| `WHATSAPP_ACCESS_TOKEN`                | Yes when enabled    | Meta system-user access token used as a Bearer token                                           |
| `WHATSAPP_PHONE_NUMBER_ID`             | Yes when enabled    | Numeric ID of the registered WhatsApp sender number, not the displayed phone number or WABA ID |
| `WHATSAPP_ADMIN_PHONE`                 | Yes when enabled    | Consenting admin recipient in canonical E.164                                                  |
| `DATABASE_URL`                         | Yes when enabled    | Shared PostgreSQL cursor and singleton poller advisory lock                                    |

For Heroku:

```sh
heroku config:set \
  AV_NOTIFICATIONS_ENABLED=true \
  AV_WHATSAPP_NOTIFICATIONS_ENABLED=false \
  SHARETRIBE_INTEGRATION_CLIENT_ID=ENVIRONMENT_INTEGRATION_CLIENT_ID \
  SHARETRIBE_INTEGRATION_CLIENT_SECRET=ENVIRONMENT_INTEGRATION_CLIENT_SECRET \
  WHATSAPP_ACCESS_TOKEN=META_SYSTEM_USER_TOKEN \
  WHATSAPP_PHONE_NUMBER_ID=META_PHONE_NUMBER_ID \
  WHATSAPP_ADMIN_PHONE=+525512345678 \
  DATABASE_URL=MANAGED_POSTGRES_URL \
  --app HEROKU_APP
```

The example deliberately keeps the channel off. A later controlled Test rollout requires WA-01
through WA-03 to be resolved and a reviewed code change that removes the release lock before this
flag may be set to `true`; production remains off until the later release gate passes.

Restart the process after changing any variable. The WhatsApp service reads its settings when the
module is loaded.

### Phone-number requirements

- Store user numbers with `+`, country code, and national number.
- For Mexico, use `+52` followed by the current 10-digit national number; do not add the obsolete
  mobile `1` prefix.
- The app removes spaces, punctuation, and other non-digits before sending.
- A value without the correct country code can normalize successfully but still target the wrong or
  nonexistent WhatsApp account.
- The first-release signup forms do not render the retained phone component. The contact-details
  form does not fully validate international dialling correctness; a later rollout must configure
  clear labels/placeholders and test the saved value before restoring signup collection.

### Runtime requirements

- Run `yarn db:migrate` before deployment and give every web process the same managed PostgreSQL
  `DATABASE_URL`. Each process starts the coordinator, but the advisory lock selects one active
  poller.
- Keep the web process awake. A sleeping process does not poll.
- Ensure outbound HTTPS access to `graph.facebook.com`.
- Monitor logs for `[eventPoller]`, `[whatsappService]`, and `[retry]`.

## 4. Sharetribe Console configuration

Complete the following separately in the **Test** and **Live** environment selectors. Credentials
from one environment cannot read another environment's events.

### 4.1 Create an Integration API application

1. In Sharetribe Console, open **Build → Integrations**.
2. Create an integration for the selected environment.
3. Copy its Client ID and Client Secret into `SHARETRIBE_INTEGRATION_CLIENT_ID` and
   `SHARETRIBE_INTEGRATION_CLIENT_SECRET`.
4. Keep the secret server-side.
5. Repeat for Live; do not reuse the Test credentials.

The Marketplace API application under **Build → Applications** is not a replacement for this
integration.

### 4.2 Collect phone numbers during signup

For every user type that should receive WhatsApp:

1. Go to **Build → Users → User types**.
2. Open the user type.
3. Enable the default **Phone number** field.
4. Enable **Add this field to the sign-up form**.
5. Enable **Make this field mandatory** if all users of that type must receive notifications.
6. Save and test signup.

Sharetribe stores the default phone field in protected data. This is the exact location read by the
application: `profile.protectedData.phoneNumber`.

If phone number is optional:

- a user without one receives no user WhatsApp notifications;
- adding a phone after signup does not replay `av_welcome_user`; and
- later transaction/message notifications can work after the phone is saved.

Do not replace the default protected phone field with a public custom user field unless the
application lookup is changed accordingly.

### 4.3 Obtain consent

Collecting a phone number is not, by itself, proof that the user agreed to receive WhatsApp
messages. Before enabling production sends:

1. Add clear WhatsApp notification consent to the signup terms/privacy wording, or implement a
   separate affirmative opt-in.
2. State the business name and the kinds of account/transaction messages that will be sent.
3. Keep auditable consent records and provide an opt-out path.
4. Do not send to imported or pre-existing numbers without valid consent.
5. Ensure the admin recipient has also agreed to receive the internal alert template.

The current code does not store a dedicated WhatsApp-consent flag or check one before sending. If
policy requires per-user consent state, that is an implementation change, not a Console setting.

### 4.4 Verify transaction processes

The hosted transaction processes must emit the exact transition names in the catalog. Check the
active aliases used by each listing type in Console against:

- `ext/transaction-processes/default-purchase/process.edn`
- `ext/transaction-processes/default-booking/process.edn`
- `ext/transaction-processes/default-negotiation/process.edn`
- `server/services/eventPoller.js`

Changing a local `process.edn` file does not update Sharetribe. A changed process must be pushed and
released with Sharetribe CLI, and its alias must be selected by the relevant listing type.

## 5. Meta / WhatsApp configuration

Meta navigation names change periodically. Use the WhatsApp area of Meta App Dashboard, WhatsApp
Manager, and Business Settings for the business portfolio that owns Archivo Vintach's WABA.

### 5.1 Create and connect the required assets

1. Create or select the Archivo Vintach Meta business portfolio.
2. Create/select a Meta app with the WhatsApp product.
3. Create/select the WhatsApp Business Account (WABA).
4. Add and verify the production sender phone number.
5. Register the number for Cloud API and configure its two-step verification PIN.
6. Set the WhatsApp business display name and complete any requested business verification.
7. Add a valid payment method and confirm that the WABA has no billing or quality restriction.
8. Note the **Phone Number ID** shown for the sender number.

The value required by the app is the Phone Number ID. Do not use the visible `+52...` phone number,
business portfolio ID, app ID, or WABA ID for `WHATSAPP_PHONE_NUMBER_ID`.

### 5.2 Create a durable access token

The temporary token shown in API Setup is appropriate only for a short test and expires quickly. For
deployment:

1. In Meta Business Settings, create or select a system user controlled by the business.
2. Assign the Meta app and the WABA/WhatsApp account assets to that system user.
3. Generate a system-user token with `whatsapp_business_messaging`.
4. Add `whatsapp_business_management` only if the same token/process also manages templates or
   WhatsApp assets; sending alone uses `whatsapp_business_messaging`.
5. Store the token as `WHATSAPP_ACCESS_TOKEN`.
6. Record its owner, issue/expiry status, and rotation procedure in the secret manager.

Never paste the token into Sharetribe Console content, a browser variable, logs, or source control.

### 5.3 Create and approve all templates

In WhatsApp Manager:

1. Create each of the nine templates in the catalog.
2. Select Spanish (Mexico), whose API language code is `es_MX`.
3. Use the exact lowercase name with underscores.
4. Keep the exact body variable count and order.
5. Supply realistic sample values for every variable.
6. Submit the templates for review.
7. Wait until every template needed for a test is **Approved/Active**.
8. Confirm none is paused or disabled because of quality.

The current sender supplies only body parameters. Avoid dynamic header/button variables unless the
application payload is extended to provide those components.

### 5.4 Webhooks

Webhooks are not required for the current outbound-only implementation. Meta accepting a request
does not prove delivery.

For production observability, add a Meta webhook and persist message status events (`sent`,
`delivered`, `read`, `failed`). That requires new server routes, webhook verification, signature
validation, message-ID storage, and monitoring; none is implemented today.

## 6. Environment setup order

Use this order for Test and then repeat for Live:

1. Create the Sharetribe Integration API credentials.
2. Enable and preferably require the default phone field for applicable user types.
3. Establish WhatsApp consent wording and records.
4. Create the Meta app, WABA, registered sender number, system user, and durable token.
5. Create and approve all nine `es_MX` templates.
6. Set the explicit feature flags and required deployment variables.
7. Confirm PostgreSQL elects one active poller leader, even if multiple web processes exist.
8. Restart and verify poller startup logs.
9. Run the test matrix below.
10. Confirm Meta billing, quality, and token ownership before production launch.

## 7. Verification

### 7.1 Configuration checks

Confirm that variables exist without printing their secret values:

```sh
heroku config --app HEROKU_APP
heroku ps --app HEROKU_APP
```

Expected startup log:

```text
[eventPoller] Starting Integration API event poller (interval: 5 min)
```

For a later release, requesting WhatsApp through the environment flag while its credentials are
incomplete makes production startup/readiness fail and logs the missing settings. The current code
lock still reports the channel as disabled. After the reviewed rollout change, confirm:

```text
GET /api/notifications/readiness → HTTP 200
```

### 7.2 Direct Meta smoke test

Do not reuse the implementation's currently hard-coded `v20.0` without review. As part of WA-03,
select a version that Meta currently supports, update the application constant, and use that same
reviewed version to test one approved template against an opted-in Test phone:

```sh
curl -X POST \
  "https://graph.facebook.com/REVIEWED_GRAPH_API_VERSION/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+525512345678",
    "type": "template",
    "template": {
      "name": "av_welcome_user",
      "language": { "code": "es_MX" },
      "components": [{
        "type": "body",
        "parameters": [{ "type": "text", "text": "Prueba" }]
      }]
    }
  }'
```

A response containing a `wamid...` message ID means Meta accepted the request. Check the recipient
device or delivery-status webhook for actual delivery.

### 7.3 End-to-end test matrix

Allow the Sharetribe event availability delay plus the next five-minute poll.

| Test               | Action                                                 | Expected result                                                    |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------ |
| User welcome       | Create a new user whose phone is entered during signup | User gets `av_welcome_user`; admin gets `av_admin_new_user`        |
| No-phone signup    | Create a user with no phone when optional              | Admin alert only                                                   |
| Purchase           | Complete `transition/confirm-payment`                  | Buyer gets `av_purchase_confirmed`; seller gets `av_sale_received` |
| Delivery           | Seller/operator marks the order delivered              | Buyer gets `av_delivered`                                          |
| Cancellation       | Run one of the three mapped cancel transitions         | Both parties get `av_cancelled`                                    |
| Booking acceptance | Seller/operator accepts                                | Buyer gets `av_booking_accepted`                                   |
| Booking decline    | Seller/operator declines                               | Buyer gets `av_booking_declined`                                   |
| Message            | Send a transaction message in either direction         | The other party gets `av_new_message`                              |
| Restart            | Restart once, then observe the next ten minutes        | No unexpected duplicate sends                                      |

Verify the recipient number saved in Console under the user's protected data when a user message is
missing.

## 8. Troubleshooting

| Symptom                                          | Likely cause                                                                                    | Check / action                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| No poller startup log                            | `SHARETRIBE_INTEGRATION_CLIENT_ID` absent                                                       | Set both Integration API variables and restart                  |
| Repeated Integration API errors                  | Wrong environment/secret or event cursor query issue                                            | Confirm Test/Live pairing; see the pre-production finding below |
| `401` from Meta                                  | Expired/revoked token or missing asset assignment                                               | Debug/rotate token and verify system-user permissions           |
| `400` template/language error                    | Name, status, parameter count, or `es_MX` mismatch                                              | Compare Meta template to the catalog exactly                    |
| Admin receives nothing                           | `WHATSAPP_ADMIN_PHONE` missing/invalid                                                          | Save a consenting E.164 WhatsApp recipient                      |
| User receives nothing but admin does             | No protected phone, bad country code, no consent/test allowlist, or template delivery failure   | Inspect user protected data and Meta logs                       |
| API accepted but device receives nothing         | Recipient cannot receive, template/quality restriction, billing, or downstream delivery failure | Inspect WhatsApp Manager and add delivery webhooks              |
| Duplicate notifications                          | Missing database migration/configuration or a delivery-ledger failure                           | Check PostgreSQL ownership, cursor, and delivery-ledger state   |
| Some cancellation paths notify and others do not | Exact transition is not in `TRANSITION_RULES`                                                   | Add and test the required exact transition in code              |

## 9. Current implementation constraints

These constraints cannot be changed in Console or Meta. They remain tracked with owners and
acceptance criteria in [`pending/notifications.md`](../pending/notifications.md):

- offer-transition alerts currently select the provider, who is also the actor for the bundled
  negotiation transitions;
- synchronous Meta acceptance is logged, but delivery status is not persisted;
- a stored phone number is treated as send eligibility without a dedicated consent record;
- Graph API `v20.0` is hard-coded and must be reviewed before production enablement; and
- a phone saved after `user/created` does not trigger the welcome template.

## 10. Source map and external references

Application sources:

- `server/services/eventPoller.js`
- `server/services/eventPollerCursor.js`
- `server/services/whatsappService.js`
- `server/services/integrationSdk.js`
- `server/services/retry.js`
- `src/containers/AuthenticationPage/UserFieldPhoneNumber.js`
- `src/containers/ContactDetailsPage/ContactDetailsPage.duck.js`
- `ext/transaction-processes/*/process.edn`
- `.env-template`

External references:

- [Meta WhatsApp Cloud API official Postman collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- [Meta Graph API changelog](https://developers.facebook.com/docs/graph-api/changelog/)
- [Sharetribe Integration API events reference](https://www.sharetribe.com/api-reference/integration.html#query-events)
- [Sharetribe user types and default phone field](https://www.sharetribe.com/help/en/articles/9117175-what-are-user-types)
- [Sharetribe transaction process concepts](https://www.sharetribe.com/docs/concepts/transaction-process/)
