# Notification and WhatsApp hardening

This file tracks only unresolved notification work. The durable PostgreSQL cursor, poller
leadership, delivery claims, Brevo consent ledger, shared rate limiting, readiness endpoints, and
Brevo error handling are implemented and documented in the current
[notification](../integrations/notification-postgres.md), [Brevo](../integrations/brevo.md), and
[WhatsApp](../integrations/whatsapp.md) guides.

WhatsApp notifications are explicitly out of scope for the first release. The sender, templates, and
phone-field component remain in the repository, but a code-level release lock prevents event
delivery and operator retries. The signup and SSO signup imports/usages are commented out. Keep
`AV_WHATSAPP_NOTIFICATIONS_ENABLED=false`; setting it to `true` cannot override the lock.

For a later release, resolve and verify the three blocking items below against the hosted
transaction processes and Meta configuration, then remove the release lock and restore the commented
signup imports/usages through a reviewed change.

## Blocking before production WhatsApp

### WA-01 — Confirm the offer recipient

The bundled negotiation process makes the provider the actor for `transition/make-offer`,
`transition/make-offer-after-inquiry`, and `transition/make-offer-from-request`. The current rule
selects the provider's phone, so the sender can receive their own offer alert while the customer
receives nothing.

- [ ] Product confirms the intended recipient for every offer transition.
- [ ] Engineering changes the recipient rule if offers should notify the customer.
- [ ] Tests assert the customer/provider ID selected for every rule and prove the sender does not
      receive their own alert.

### WA-02 — Add auditable WhatsApp consent

`lookupUserPhone` currently treats `profile.protectedData.phoneNumber` as sufficient permission to
send. No consent version, timestamp, source, withdrawal, or suppression state is checked.

- [ ] Product/legal define the consent and opt-out model.
- [ ] Store versioned consent evidence without treating imported or pre-existing phone numbers as
      opted in.
- [ ] Enforce current consent at send time and fail closed after withdrawal.
- [ ] Add tests for grant, withdrawal, pre-existing numbers, and suppression.

### WA-03 — Upgrade the Meta Graph API version

`server/services/whatsappService.js` hard-codes `v20.0`. Before enabling WhatsApp, select a version
that Meta currently supports, regression-test every configured template, and assign an owner for
future version upgrades.

- [ ] Verify the supported version and retirement schedule against Meta's current changelog.
- [ ] Upgrade the endpoint through a reviewed constant or configuration value.
- [ ] Run direct and end-to-end tests for all templates in Test and Live.
- [ ] Alert on Meta version or deprecation errors.

## Operational maturity

### WA-04 — Track delivery status

The synchronous Meta response is logged, but its message ID and later `sent`, `delivered`, `read`,
or `failed` status are not persisted.

- [ ] Store provider message IDs.
- [ ] Implement and verify signed status webhooks.
- [ ] Expose delivery/failure metrics and alert on abnormal failure rates.

### WA-05 — Cover every hosted transition

Exact transition matching omits valid cancellation and completion paths such as disputed-order
cancellations.

- [ ] Build a product-approved matrix from every active hosted transaction process.
- [ ] Mark every transition as included or deliberately excluded.
- [ ] Add a test that fails when a new transition has no decision.

### WA-06 — Decide late-phone welcome behavior

The WhatsApp welcome is evaluated only on `user/created`. A user who adds a phone or consents later
does not receive it.

- [ ] Decide whether later consent should trigger a welcome.
- [ ] If yes, add an idempotent consent/phone-added trigger.

### WA-07 — Validate destinations

Normalization strips non-digits and prepends `+`, but it does not prove that a number is a valid
international destination or belongs to the consenting user.

- [ ] Require and validate canonical E.164 values on save and before send.
- [ ] Reject missing country codes and invalid Mexican numbers.
- [ ] Decide whether destination verification is required before enabling notifications.

### WA-08 — Version the template contract

Nine template names, `es_MX`, and parameter counts are hard-coded. A Meta-side template edit can
break sends without an application release.

- [ ] Record name, language, category, and variable count for each approved template.
- [ ] Compare Test and Live template definitions during releases.
- [ ] Add controlled language/template selection only when product requirements justify it.

## Shared-pipeline verification

- [ ] Load-test a burst larger than the configured event-page bound and verify the next poll drains
      the backlog without duplicate sends.
- [ ] Verify age/page-bound alerts and readiness metrics under sustained lag.
- [ ] Run recipient-direction, consent, phone validation, and Meta webhook tests before changing the
      production WhatsApp flag or removing the code release lock.

Implementation sources: `server/services/eventPoller.js`, `server/services/whatsappService.js`,
`server/services/notificationStore.js`, `src/containers/AuthenticationPage/UserFieldPhoneNumber.js`,
and `ext/transaction-processes/*/process.edn`.
