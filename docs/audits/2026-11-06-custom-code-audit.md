# Custom-code audit — 2026-11-06

Status: **resolved in code on branch `fix/audit-2026-11-06` (2026-11-06); Test (Render) verification
and the Live release are pending**. Each finding records its commits, regression evidence, and what
remains; see [Remediation status](#remediation-status).

This report records the findings from the final custom-code review requested on 2026-11-06. Review
custom-code security, performance, and architecture first; reduce avoidable upstream divergence
after the behavior defects are addressed. The three high-priority findings prevent audit sign-off.

## Source and scope

- Reviewed application commit: `76e55bc8df50bb2b0f9a387a1cba107f2c64cdf8`.
- Freshly fetched upstream baseline: `dcec8be091983665f162536ce6d5118a8ef547e4` (`upstream/main` at
  audit time).
- Local environment: Node `v24.3.0`, Yarn `1.22.22`.
- Guidance: [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), the current implementation
  and integration guides, and the repository-local auditor role when available.
- Reviewed areas: custom HTTP routes, import workers, shipping and label services, notifications,
  consent and campaign persistence, custom frontend components/pages/ducks, configuration, extension
  hooks, and upstream customization seams.
- Review methods: source tracing, comparison against upstream, the existing test suites, focused
  local reproductions with mocked external transports, formatting/configuration checks, and an
  explicitly approved external Yarn dependency audit.

Source links below are relative to this repository. Line numbers describe the audited revision; use
the revision above if a subsequent fix moves them. Do not use that historical revision as the
baseline for restoring upstream files: resolve `upstream/main` at the time of each cleanup.

No application code, process definitions, environment files, or user fixtures were changed during
the audit. The pre-existing untracked `server/api/bulk-import/fixtures/` directory was left
untouched. The focused reproduction harnesses were transient and are not checked-in regression
tests; the acceptance criteria below describe the coverage that implementations must add.

## Finding register

Priority labels express remediation urgency: **High / P1** requires attention before sign-off;
**Medium / P2** is a concrete correctness, performance, or policy-enforcement defect. Upstream
cleanup and documentation observations are tracked separately from the eleven code defects.

Suggested areas identify a code ownership boundary, not an assigned person. Every item is resolved
in code or closed with a recorded decision; see [Remediation status](#remediation-status).

| ID                                                                         | Priority        | Finding                                                                    | Suggested area               |
| -------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------- | ---------------------------- |
| [A01](#a01--client-writable-shipping-data-can-authorize-an-unpaid-label)   | High / P1       | Client-writable shipping rate authorizes a label without a shipping charge | Shipping/backend             |
| [A02](#a02--favorites-writes-can-cross-account-boundaries)                 | High / P1       | Queued favorites writes survive logout and affect another account          | Frontend state/auth          |
| [A03](#a03--malformed-original-price-can-break-public-rendering)           | High / P1       | Seller-controlled original price can throw during public SSR               | Listing UI/data validation   |
| [A04](#a04--concurrent-imports-can-exchange-image-contents)                | Medium / P2     | Temporary image paths collide between imports                              | Bulk importer                |
| [A05](#a05--upload-limits-run-after-expensive-buffering-and-extraction)    | Medium / P2     | Upload preprocessing is outside resource admission limits                  | Bulk importer/HTTP           |
| [A06](#a06--outbound-timeouts-do-not-cover-response-bodies)                | Medium / P2     | Provider response bodies can outlive the request deadline                  | Shared HTTP integrations     |
| [A07](#a07--marketing-consent-can-transfer-between-email-addresses)        | Medium / P2     | Consent identity matching authorizes the wrong destination email           | Brevo/consent                |
| [A08](#a08--promotional-retries-bypass-current-eligibility)                | Medium / P2     | Operator retry bypasses live campaign checks                               | Notification delivery        |
| [A09](#a09--publication-deduplication-discards-unfinished-campaign-work)   | Medium / P2     | Permanent publication claim prevents recovery after partial failure        | Campaign scheduling          |
| [A10](#a10--public-readiness-requests-perform-unbounded-diagnostic-work)   | Medium / P2     | Public probes invoke growing table aggregations                            | Readiness/PostgreSQL         |
| [A11](#a11--balance-totals-remain-stale-during-spa-sessions)               | Medium / P2     | Summary cache has no client expiry or refresh on return                    | Balance dashboard            |
| [D01](#d01--dependency-advisories-require-reachability-and-upgrade-review) | Triage required | Production-group and development dependency advisories                     | Dependency maintenance       |
| [U01](#u01--shared-av-button-styles-live-in-an-upstream-page-stylesheet)   | Cleanup         | Shared AV UI depends on upstream PageBuilder styling internals             | Shared styles/PageBuilder    |
| [U02](#u02--remaining-upstream-restyles-can-use-existing-av-boundaries)    | Cleanup         | Avoidable AV styling remains in upstream CSS modules                       | Styling/upstream maintenance |
| [O01](#o01--documentation-drift)                                           | Low / P3        | Pending sync and importer documentation disagree with current source       | Documentation                |

## Remediation status

Branch `fix/audit-2026-11-06`, cut from `76e55bc8d`; open as PR #142, not released. Commits are
listed per finding, including the [code-review follow-up](#code-review-follow-up-2026-11-08). The
report stays until the Render/Test checks below are done (README rule); then remove it and its index
links.

| ID  | Outcome                                    | Commits                                            | Still to do outside the code                                                                                   |
| --- | ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A01 | Resolved, no transaction-process change    | `4d9f0579c`, `6da9c89f3`, `d97567c07`, `383182925` | On Test: a shipping order gets `metadata.avShipping` and buys one label; a pickup order shows no label control |
| A02 | Resolved                                   | `d7c547c40`, `6da9c89f3`, `8c47536e6`              | —                                                                                                              |
| A03 | Resolved                                   | `61d39f1d1`                                        | —                                                                                                              |
| A04 | Resolved                                   | `ba3969ccf`                                        | —                                                                                                              |
| A05 | Resolved                                   | `fbc89f793`                                        | —                                                                                                              |
| A06 | Resolved, Instagram follow-up included     | `b576a806d`                                        | —                                                                                                              |
| A07 | Resolved, no data migration needed         | `1010f19a1`                                        | —                                                                                                              |
| A08 | Resolved                                   | `fcf7aefda`, `cfb636c65`                           | —                                                                                                              |
| A09 | Resolved                                   | `315b1a494`, `cfb636c65`                           | Apply migration 010 on the Test and Live databases before deploying                                            |
| A10 | Resolved                                   | `f529c9919`                                        | Readiness `200` on Test after migration 010                                                                    |
| A11 | Resolved                                   | `2da576b14`                                        | —                                                                                                              |
| D01 | Resolved; 2 production moderates accepted  | `c93da3d9d`                                        | Re-run both audit scopes after each upstream sync                                                              |
| U01 | Resolved; one intended visual change       | `d3b500572`, `ed06e6223`                           | —                                                                                                              |
| U02 | Resolved; Checkout CSS closed as kept fork | `042f3d25e`                                        | —                                                                                                              |
| O01 | Resolved                                   | `88e4b7983`                                        | —                                                                                                              |

## Custom-code findings

### A01 — Client-writable shipping data can authorize an unpaid label

**Priority:** High / P1. **Status:** resolved in code. **Resolution PR/commit:** `4d9f0579c`,
`6da9c89f3`. Test (Render) verification pending.

**Resolution:** the privileged endpoints always drop a caller-supplied `protectedData.avShipping`
and, after a real initiate/transition, write the authoritative rate to `metadata.avShipping` through
the Integration SDK (`persistAvShippingRecord`, retried only on network/5xx/429). Label purchase
reads only that record — or, for transactions without one, the protectedData copy while no
`transition/dispute` has happened — and requires a non-reversal customer `line-item/shipping-fee` of
the same amount and currency (`shippingChargeMatches`); otherwise it refuses with
`LABEL_NOT_ALLOWED` and a `reason` before any claim. The label control is hidden when no shipping
was charged. No transaction-process change. Regressions:
`server/api/privilegedShippingRecord.test.js`, `shipmentService.test.js` ("shipping record
authority"), `avShipping.test.js`, `AVShippingLabelSection.test.js`. A forged value written by the
non-privileged `transition/inquire` can still sit in protectedData, but it is never trusted.

**Evidence:** [avShipping.js](../../server/api-util/avShipping.js#L128), lines 128–130 and 156–160;
[initiate-privileged.js](../../server/api/initiate-privileged.js#L110), lines 110–119;
[shipmentService.js](../../server/services/shipmentService.js#L110), lines 110–136; and
[purchase process](../../ext/transaction-processes/default-purchase/process.edn#L7), request-payment
and dispute transitions.

For `deliveryMethod !== 'shipping'`, `resolveAvShippingForOrder` returns an empty AV patch.
`withAvShippingProtectedData` then returns no replacement, leaving caller-supplied
`params.protectedData.avShipping` in the privileged request. Label purchase later trusts that
object's `rate_id`, checking paid/cancellation transitions but not a matching shipping line item.

The tracked process accepts protected data during request-payment. Its public customer dispute
transition also runs `action/update-protected-data`, so sanitizing the initial request alone does
not make this field a permanently authoritative server record.

**Trigger and impact:** a paid pickup transaction can contain a forged shipping rate, despite having
only an item charge. A provider-authorized manual label request, or enabled automatic label
purchase, can then spend the platform's carrier balance. The reproduction establishes the trust
boundary failure; a real carrier purchase additionally requires a valid carrier rate. Manual
endpoint authorization and the opt-in autobuy gate still apply.

**Local reproduction:** invoke the actual initiation endpoint with SDK transports mocked, a pickup
order, and caller-supplied `avShipping`. The forwarded transaction retains the rate and its line
items contain only `line-item/item`. Feed the paid transaction into the actual shipment service with
a carrier stub and durable-store stub: `createShipment` is called for the forged rate. No live
payment, carrier purchase, or external mutation was performed.

**Recommended implementation:** strip reserved shipping keys from client input; keep authoritative
rate, destination, and charge binding in privileged metadata or a durable server record. Before
buying a label, require a valid server record and matching authoritative shipping line item. Keep
the existing durable claim and unknown-outcome safeguards. Explicit approval is required before any
transaction-process, transition, payment, or payout changes; verify corresponding hosted process
behavior in Test before release.

**Acceptance criteria / regression coverage:**

- [x] Pickup initiation and transition cannot preserve a caller-authored reserved shipping record.
- [x] A paid transaction without a valid shipping charge never calls the carrier purchase API.
- [x] Changing protected data after payment cannot replace the authoritative purchase rate.
- [x] A valid paid shipping order still buys exactly one label across manual/automatic concurrency.
- [x] Existing purchased, failed, unknown, cancellation, and reconciliation protections remain.
- [x] Update the [eShip guide](../integrations/eship.md) to describe the final authority boundary
      and any compatibility handling for transactions already in flight.

### A02 — Favorites writes can cross account boundaries

**Priority:** High / P1. **Status:** resolved in code. **Resolution PR/commit:** `d7c547c40`,
`6da9c89f3`.

**Resolution:** the favorites slice carries a session token (lazy initial state, so the logout reset
recreates it; `clearCurrentUser` replaces it too). Every queued operation records that token and its
user and is dropped — no `updateProfile`, no dispatch, no tracking call — when either has changed,
before the write and again when the response arrives. A new session only waits behind the previous
queue for the same user. Regressions: `favorites.duck.test.js` "session boundaries" (fail on the old
duck). Residual: a sign-in in _another browser tab_ swaps the shared session cookie without changing
this tab's state, so a write already queued here would still reach the other account; its response
is discarded. Outside the audit's same-SPA scope.

**Evidence:** [favorites.duck.js](../../src/ducks/favorites.duck.js#L16), lines 16, 23–27, 91–100,
and 107–122.

Favorites queues live outside Redux in a `WeakMap` keyed by `getState`. Logout resets Redux state
but retains the same store and `getState` function. Pending operations neither check the originating
account before issuing `sdk.currentUser.updateProfile` nor check session identity before committing
their responses.

**Trigger and impact:** Alice starts one slow write and queues another toggle, logs out, and Bob
signs into the same SPA. When Alice's first request settles, the next queued request uses the
current SDK session and writes Alice's favorites into Bob's profile. With only one delayed request,
the completion can still dispatch `setCurrentUser(Alice)` after logout. This changes local user
state; it is not evidence of obtaining Alice's backend authentication credentials.

**Local reproduction:** load the actual duck with Redux Toolkit and a mocked SDK whose first profile
update is deferred. Apply root logout/reset semantics, sign in as Bob, then resolve the first
response. The queued update executes under Bob's session with Alice's favorite IDs.

**Recommended implementation:** bind queues and operations to an account/session generation,
invalidate the generation on logout, and verify identity immediately before both issuing a write and
applying its response. Checking only the returned user ID or clearing Redux favorites is
insufficient: it does not stop a queued write from reaching the next account.

**Acceptance criteria / regression coverage:**

- [x] Delayed success and failure after logout cannot change favorites or current user state.
- [x] Alice's queued work never calls `updateProfile` after Bob signs in.
- [x] A new session for the same user cannot inherit stale operations from an earlier generation.
- [x] Concurrent toggles within one session retain optimistic ordering and failure rollback.
- [x] Keep queue/session coordination in the duck or a shared state utility, not a mounted
      component.

### A03 — Malformed original price can break public rendering

**Priority:** High / P1. **Status:** resolved in code. **Resolution PR/commit:** `61d39f1d1`.

**Resolution:** `src/util/avOriginalPrice.js` accepts only a safe positive integer amount in the
listing's currency that exceeds the price; listing cards, bag cards, OrderPanel and both pricing
editors use it. `sanitize.js` stays upstream. Regressions: `avOriginalPrice.test.js`,
card/bag/OrderPanel malformed cases, and an SSR `renderToString` of a result set with a
`NO-SUCH-CURRENCY` listing.

**Evidence:** [AVListingCard.js](../../src/components/AVListingCard/AVListingCard.js#L78), lines
78–88; [sanitize.js](../../src/util/sanitize.js#L178), lines 178–200. The same trust pattern exists
in [AVBagItemCard.js](../../src/components/AVBagItemCard/AVBagItemCard.js#L72) and
[OrderPanel.js](../../src/components/OrderPanel/OrderPanel.js#L185).

The renderer constructs `Money` from seller-controlled `publicData.originalPrice` after checking
only whether its amount exceeds the listing price. Unconfigured nested public data passes through
the sanitizer unchanged. Client-side form validation does not constrain a seller using the
Marketplace SDK directly.

**Trigger and impact:** a listing with an original price such as
`{ amount: 90000, currency: 'NO-SUCH-CURRENCY' }` can throw while rendering any search or home page
that contains its card. The stored malformed value can also affect other original-price consumers.

**Local reproduction:** actual `sanitizeListing` → actual card price renderer → actual `formatMoney`
during React SSR throws
`No minor unit divisor defined for currency: NO-SUCH-CURRENCY in currencySettings.js`.

**Recommended implementation:** add one AV-owned original-price normalization helper. Require a safe
finite integer amount, the listing's currency, and an amount above the current price; omit invalid
values. Use the same helper in listing cards, bag cards, OrderPanel, and editor initial values. Keep
this validation out of upstream's general-purpose sanitizer when an AV boundary can handle it.

**Acceptance criteria / regression coverage:**

- [x] Unknown, missing, and mismatched currencies do not throw or display a misleading comparison.
- [x] Nonnumeric, fractional, unsafe, and otherwise malformed amounts are ignored safely.
- [x] A malformed listing cannot break a public SSR result set containing valid listings.
- [x] Valid strike-through prices render consistently in every consumer.
- [x] Every exported helper has unit coverage, with a component/SSR regression for malformed input.

### A04 — Concurrent imports can exchange image contents

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `ba3969ccf`.

**Resolution:** each upload writes an exclusively created file in its own `mkdtemp` directory and
removes the directory when it settles (async I/O, whitelisted extension). Regressions:
`importWorker.test.js` "uploadImage temporary files" (fail on the old helper).

**Evidence:** [importWorker.js](../../server/api/bulk-import/importWorker.js#L107), lines 107–117.

Temporary image filenames contain only process ID, `Date.now()`, and extension. The supported
single-process deployment permits three concurrent jobs. Two same-extension uploads in one
millisecond therefore share a file path. One write can overwrite the other's contents; one cleanup
can unlink the other's still-needed file.

**Trigger and impact:** unrelated jobs or sellers can upload the wrong image to Sharetribe or fail
an upload. This is a correctness and data-isolation defect within the supported deployment, not a
future horizontal-scaling limitation.

**Local reproduction:** run the exact upload helper concurrently with two different buffers and a
fixed clock. Both SDK-stub reads receive the second buffer. No live image upload was performed.

**Recommended implementation:** use `mkdtemp` or a cryptographically random filename with exclusive
creation, a unique path per upload, and per-upload cleanup in `finally`. Prefer asynchronous file
I/O. Keep temporary files transient; do not turn them into durable runtime state.

**Acceptance criteria / regression coverage:**

- [x] Concurrent uploads with identical extension and timestamp each read their own bytes.
- [x] Success/failure cleanup removes only the owning upload's files.
- [x] SDK rejection still cleans up; another active upload remains unaffected.
- [x] Update the importer guide if temporary-file handling or operational constraints change.

### A05 — Upload limits run after expensive buffering and extraction

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `fbc89f793`.

**Resolution:** `uploadAdmission.js` runs before Multer: a per-user attempt cap (20/h standard, 60/h
admin, every attempt counts), the completed-import cap as a non-recording check, one in-flight
upload or active job per user, and jobs plus in-flight uploads at most 3. The reservation is
released once — on job creation, response finish, or connection close. Multer reads each tier with
its own ZIP cap and bounded fields/parts. Off-thread extraction was evaluated and not adopted
(admission already bounds it; no new dependency). Regressions: `index.test.js` "admission before the
upload is read".

**Evidence:** [bulk-import/index.js](../../server/api/bulk-import/index.js#L73), Multer at lines
73–85, route order at 107, extraction at 145, and admission checks at 221–239;
[limits.js](../../server/api/bulk-import/limits.js).

Session and action-token validation run before Multer, but the one-active-job, global-three-job, and
hourly import limits run after memory buffering, extraction, parsing, and configuration reads.
Multer permits 50 MB even for standard users whose compressed ZIP tier is 20 MB. Extraction can
produce up to 100 MB synchronously before the job checks reject a request. Invalid upload attempts
do not consume the successful-import hourly allowance.

**Trigger and impact:** one authenticated account can issue concurrent valid-token upload attempts,
including while its import is already active. Pre-job memory and CPU work remains unbounded by the
advertised job limit, threatening the same web process that serves the marketplace.

**Validation:** source-path analysis confirmed middleware order and caps. No flood, memory
exhaustion, or production load test was performed. Authentication reduces public exposure but does
not bound work from an authorized account. The documented one-process deployment does not resolve
this pre-admission workload.

**Recommended implementation:** add an attempt limiter and bounded upload reservation before Multer.
Release reservations on rejection, errors, disconnects, and transfer to an admitted job. Use
tier-aware limits when the authenticated tier is already known; bound multipart fields and parts.
Evaluate asynchronous/off-thread extraction without adding a dependency before approval.

**Acceptance criteria / regression coverage:**

- [x] Requests exceeding admission capacity are rejected before buffering/extracting their body.
- [x] Invalid uploads count toward an attempt limit independent of completed-import limits.
- [x] Disconnects, parser failures, and configuration errors cannot leak reservations.
- [x] Standard/admin size limits remain correct, and multipart fields/parts are bounded.
- [x] Tests use controlled streams/stubs to prove admission order without large-memory flooding.
- [x] Update [bulk-import documentation](../implementation/bulk-import.md) with the final limits.

### A06 — Outbound timeouts do not cover response bodies

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `b576a806d`.

**Resolution:** `requestWithTimeout` keeps one deadline over the request and the body read, and
reports the status already received when only the body is late; eShip, Brevo email/contacts,
WhatsApp and Instagram (route and token refresh) use it, and `fetchWithTimeout` was removed.
Classification is unchanged: no response is `unknown`, a late 2xx body counts as sent, a late error
body keeps its status, and the label path stays fail-closed. The Instagram follow-up (cache before
token read, coalesced cold loads, env fallback when the token service cannot be built) is included.
Regressions: `fetchWithTimeout.test.js`, `eshipClient.test.js`, `brevoEmailService.test.js`,
`brevoContactService.test.js`, `instagram.test.js`, `instagramTokenService.test.js`.

**Evidence:** [fetchWithTimeout.js](../../server/api-util/fetchWithTimeout.js#L13), lines 13–20;
[eshipClient.js](../../server/api-util/eshipClient.js#L79), lines 79–84; body consumers in
[brevoEmailService.js](../../server/services/brevoEmailService.js) and
[brevoContactService.js](../../server/services/brevoContactService.js).

The shared helper returns a fetch response and clears its abort timer once headers arrive. Its
callers read the body afterward. eShip independently returns `response.json()` without awaiting it
inside the timeout's `try`, so `finally` clears the timer before parsing finishes; asynchronous body
errors also escape that local error translation.

**Trigger and impact:** a provider can return headers and stall the body indefinitely, holding a
shipping quote, label operation, or notification poll. The apparent ten-second timeout does not
bound the whole operation.

**Local reproduction:** a fetch stub resolves headers immediately and supplies a never-resolving
JSON body. After four times the configured deadline, body consumption is unresolved and the abort
signal remains untriggered. No external connection was needed.

**Recommended implementation:** make a shared abstraction own both fetching and consuming the body,
with one deadline and consistent error mapping. Await eShip parsing within the protected scope.
Preserve notification/label classification of unknown provider outcomes; a timeout after dispatch
must not introduce unsafe retries or duplicate paid side effects.

**Acceptance criteria / regression coverage:**

- [x] Deadlines cover stalled headers and stalled success/error bodies.
- [x] Abort and malformed-body errors are classified consistently by callers.
- [x] Timers are cleaned up after completion/failure without ending the deadline prematurely.
- [x] Notification and label unknown-outcome/reconciliation behavior remains fail-closed.
- [x] Avoid independent timeout implementations drifting across providers.

### A07 — Marketing consent can transfer between email addresses

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `1010f19a1`.

**Resolution:** consent lookups are keyed by the destination address, the user id only narrows the
match, and the matching-listing audience joins the same way; the footer links the account only when
it subscribes its own email. Existing rows need no migration: stale links are never consulted for
the account address and no suppression is lifted. Regressions: `marketingConsent.test.js`,
`brevo.test.js`, `notificationJobs.test.js`.

**Evidence:** [brevo.js](../../server/api/brevo.js#L81), lines 81–100;
[marketingConsent.js](../../server/services/marketingConsent.js#L142), lines 142–158.

A signed-in user's footer submission attaches their user ID to the submitted email without requiring
that address to match the account email. `getPreference` looks up email OR user ID and prefers a
user-ID match; `isEligible` does not verify that the returned preference belongs to the requested
destination email.

**Trigger and impact:** account email A submits secondary email B in the footer. Campaign jobs to A
can use B's grant because both are associated with A's account ID. An email change outside the
custom Contact Details revoke flow can retain the same fallback. This violates the documented
email-specific consent model.

**Local reproduction:** the actual eligibility checker returns true for primary email A when the
preference returned by its mocked store belongs only to secondary email B.

**Recommended implementation:** make destination email authoritative in eligibility checks, using
user ID only as an additional identity constraint. Associate footer consent with a signed-in user
only when the submitted address matches that user's email. Review existing associations for
compatibility without silently broadening consent or lifting suppression.

**Acceptance criteria / regression coverage:**

- [x] Consent for B never authorizes promotional mail to A, even with a matching user ID.
- [x] Footer signup for an unrelated address does not attach the current user's identity.
- [x] Email changes through UI, SDK, and operator paths cannot carry permission to a new address.
- [x] Anonymous consent, normalized matching addresses, withdrawal, and sticky suppression work.
- [x] Keep the [Brevo guide](../integrations/brevo.md) consistent with the final lookup rules.

### A08 — Promotional retries bypass current eligibility

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `fcf7aefda`.

**Resolution:** `evaluateJob` holds normal processing's checks and is shared with
`retryPromotionalDelivery`; `yarn notifications:retry` goes through
`notificationRetry.retryDelivery`, which re-evaluates a campaign delivery against current data,
refuses with a reason and no side effects, keeps the `--confirm-unknown` gate, and records a sent
retry on its job for the frequency cap. Essential mail keeps its stored-payload retry;
`retryNotification` refuses promotional payloads. Regressions: `notificationRetry.test.js`,
`notificationDelivery.test.js`.

**Evidence:** [notificationDelivery.js](../../server/services/notificationDelivery.js#L233), lines
233–254, compared with
[notificationCampaignService.js](../../server/services/notificationCampaignService.js#L475), lines
475–521.

Normal campaign processing reloads the user and checks destination identity, consent/suppression,
frequency cap, campaign state, and resource eligibility. Operator `retryNotification` prepares a
stored payload and sends it directly through `deliverNotification`, bypassing those checks. A
successful direct retry also bypasses the campaign job's normal completion/cap accounting.

**Trigger and impact:** retry a failed promotional delivery after the recipient opts out, changes
email, or the resource/campaign becomes ineligible. The stale payload can still be sent. Operator
access is required; this finding concerns an unsafe authorized retry path, not an anonymous retry
endpoint.

**Local reproduction:** an isolated retry with a withdrawn-recipient promotional payload reaches the
provider stub once with zero current eligibility lookups.

**Recommended implementation:** route promotional retries through current campaign eligibility and
accounting, sharing the same policy code as normal processing. Retain appropriate direct retries for
essential transactional/welcome mail. Preserve confirmation requirements for unknown outcomes.

**Acceptance criteria / regression coverage:**

- [x] Withdrawal, suppression, changed email, and stale resource state prevent promotional retry.
- [x] Retry respects the rolling frequency cap and records a successful send for future caps.
- [x] Eligible retries preserve deduplication and unknown-outcome controls.
- [x] Essential welcome/transactional retries remain supported under their own policy.
- [x] Document promotional retry behavior in the Brevo/operator retry guidance.

### A09 — Publication deduplication discards unfinished campaign work

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `315b1a494`.

**Resolution:** migration `010_listing_publication_completion.sql` separates completion from first
observation; an unfinished claim is re-run on replay or the next listing event with idempotent
writes keyed by the first observation (including the matching digest date), a 404 author/listing
completes with nothing scheduled, and five attempts bound a permanent failure. Regressions:
`notificationCampaignService.test.js` "recoverable publication scheduling". Migration 010 still has
to be applied on the Test and Live databases.

**Evidence:**
[notificationCampaignService.js](../../server/services/notificationCampaignService.js#L236), lines
236–280; [notificationJobs.js](../../server/services/notificationJobs.js#L221), permanent
publication claim.

`claimListingPublication` commits a first-publication marker before author/listing API reads,
seller-inactivity scheduling, and matching-user fanout. If subsequent work fails, poller replay sees
the marker and returns immediately instead of retrying unfinished work.

**Trigger and impact:** a transient Sharetribe lookup/database error or partial fanout failure can
permanently omit inactivity or matching-listing campaigns. Cursor replay alone cannot repair the
loss. A claim that proves first observation is being used as if it proved completed scheduling.

**Local reproduction:** the first resource lookup throws after the marker is claimed. Replaying the
event returns successfully with only one lookup total and zero scheduled jobs.

**Recommended implementation:** represent publication work as recoverable pending/completed state,
or atomically commit completion with the required scheduling writes. Reuse deterministic job keys
and idempotent append logic so replay can finish partial fanout safely. Avoid keeping database
transactions open across external API calls.

**Acceptance criteria / regression coverage:**

- [x] Failures after the claim, after seller scheduling, and during matching fanout recover on
      replay.
- [x] Replay schedules missing work without duplicating previously scheduled recipients/listings.
- [x] Process restart cannot permanently strand a claimed but unfinished publication.
- [x] Normal duplicate publication events remain deduplicated after successful completion.

### A10 — Public readiness requests perform unbounded diagnostic work

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `f529c9919`.

**Resolution:** the public probe is configuration plus one catalog query (poller state, required
tables, migration 010's column), coalesced and cached for 10 s; the bearer-protected details keep
the full diagnostics with their own 5 s coalesced cache. Regressions:
`notificationReadiness.test.js` "public probe", `notifications.test.js`.

**Evidence:** [notifications.js](../../server/api/notifications.js#L10), lines 10–12;
[notificationReadiness.js](../../server/services/notificationReadiness.js#L23), lines 23–63.

When the poller/database is enabled, every unauthenticated public readiness request invokes the full
diagnostic function: six database queries, including five full-table `COUNT`/`GROUP BY` aggregations
over deliveries, jobs, preferences, labels, and tracking. There is no request limit, cache, or
in-flight coalescing on this route. Protecting the details response does not protect the work done
by the boolean endpoint.

**Trigger and impact:** routine high-frequency probes or abusive traffic consume the same small
PostgreSQL pool used by the poller and shipping integrations. Cost grows with retained data.

**Validation:** traced the public route to all six queries. No production load test was run; the
report does not claim a measured latency or row-count threshold.

**Recommended implementation:** separate the public health decision from full diagnostics. Use a
lightweight, briefly cached/coalesced readiness query and bound request work. Keep detailed counts
behind the existing bearer-protected endpoint and consider caching them independently.

**Acceptance criteria / regression coverage:**

- [x] Public probes do not aggregate historical delivery/job/consent/label/tracking tables.
- [x] Concurrent public probes share bounded work rather than creating unbounded queries.
- [x] Database/configuration failures still produce the expected readiness status.
- [x] The protected details endpoint retains authorization and useful diagnostic information.

### A11 — Balance totals remain stale during SPA sessions

**Priority:** Medium / P2. **Status:** resolved in code. **Resolution PR/commit:** `2da576b14`.

**Resolution:** the summary is refetched once older than the server's 60 s cache, concurrent loads
share one request, a failure stays retryable, and the request moved to `util/api.js`
(`getMyBalanceSummary`). Regressions: `MyBalancePage.test.js` "summary freshness", `api.test.js`.

**Evidence:**
[MyBalancePage.duck.js](../../src/containers/MyBalancePage/MyBalancePage.duck.js#L180), lines
180–188.

After the first successful summary request, `summaryLoaded` prevents every subsequent request for
the rest of the session. Route `loadData` still refreshes the transaction rows when revisiting the
page. The server's 60-second summary cache cannot help because the client no longer requests it.

**Trigger and impact:** a seller views their balance, completes/cancels a transaction, and returns
through SPA navigation. Rows reflect the new state while totals retain the earlier state. A full
reload or new session is required to refresh them.

**Validation:** traced the summary state and route loading guard. Root logout resets Redux; this
finding is stale financial presentation within a session, not a confirmed cross-account cache leak.

**Recommended implementation:** refresh on page entry or track a fetched timestamp/TTL, coalescing
requests already in flight. Keep normal pagination/filter changes from needlessly rescanning the
entire history. Put the non-SDK HTTP wrapper in `src/util/api.js`, following the repository's API
boundary convention, if this loading path is refactored.

**Acceptance criteria / regression coverage:**

- [x] Revisiting after a relevant transition/cache expiry refreshes totals and rows consistently.
- [x] Concurrent loads do not issue duplicate summary requests.
- [x] Pagination/filter-only navigation respects the chosen freshness policy.
- [x] Failed refresh can be retried and does not mark the stale summary permanently fresh.

## Dependency review

### D01 — Dependency advisories require reachability and upgrade review

**Status:** resolved; two production-group moderates accepted with rationale. **Resolution
PR/commit:** `c93da3d9d`.

**Resolution:** resolutions pin `follow-redirects` 1.16.2, `axios` `^1.21.0` and react-router's
`path-to-regexp` `^1.9.0` (the v12.6.0 lock merge had restored 1.18.1/1.7.0); in-range re-resolution
patches `braces`, `micromatch`, `picomatch`, `semver@5` (pinned to 5.7.2 because 5.7.3 was five days
old), `yaml` and the dev-only `shell-quote`. `yarn audit --groups dependencies`: 22 → **2 moderate**
— `glob` 13 and `minimatch` 10 under `@sentry/node > @sentry/bundler-plugins`, which need
attacker-controlled glob patterns the app never passes and whose fixes are new majors under a
Sentry-owned dependency. Full tree: 117 (1 critical) → **63 (0 critical)**, every path starting at a
development/build tool that upstream locks identically. Server and client suites and
`yarn run build` pass. Details in
[live-launch §2.2](../pending/live-launch.md#22-remaining-dependency-advisories).

The external registry audit was run with explicit user approval. These are audit-time results, not a
claim that every advisory is exploitable in an application request path. The production manifest
group includes postinstall/CLI transitive dependencies as well as runtime code. Registry severity
can differ from maintainer severity or later advisory revisions.

| Audit scope                               | Unique registry advisory IDs | Severity distribution                   |
| ----------------------------------------- | ---------------------------- | --------------------------------------- |
| `yarn audit --groups dependencies --json` | 22                           | 12 high, 10 moderate                    |
| `yarn audit --json`                       | 117                          | 1 critical, 73 high, 36 moderate, 7 low |

Yarn's full-tree summary reports 536 affected dependency-path occurrences. That is not 536 unique
advisories. The table above deduplicates by registry advisory ID. Raw temporary audit logs were not
committed; the actionable production inventory is retained below.

Two findings deserve explicit review:

- [package.json:161](../../package.json#L161) forces `follow-redirects` to `1.16.1`, an affected
  version. The
  [maintainer advisory](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-mrwp-f3q8-3g9p)
  identifies `1.16.2` as patched. The issue requires a cross-realm custom-sensitive-header array and
  a cross-origin redirect; this audit did not establish those conditions in AV's SDK usage. Update
  the resolution after compatibility verification rather than treating the version pin as an
  established active credential leak.
- The full graph reports `shell-quote@1.9.0` through
  `webpack-dev-server > launch-editor > shell-quote`, rated critical by the registry audit. The
  [maintainer advisory](https://github.com/ljharb/shell-quote/security/advisories/GHSA-pqg4-j6r4-53mv)
  identifies `1.11.0` as patched. This is a development-tool path, not evidence of production remote
  code execution. Its dangerous quoting sequence and development-server exposure require separate
  reachability review.

**Acceptance criteria:**

- [x] Classify production advisory paths as runtime, browser, build/postinstall, or unreachable.
- [x] Update compatible direct/transitive versions and the explicit redirect resolution.
- [x] Verify Sharetribe SDK behavior, server/client tests, and the production build after upgrades.
- [x] Re-run both audit scopes; record remaining IDs with concrete reachability/risk rationale.
- [x] Review relevant upstream dependency updates instead of creating unnecessary permanent forks.
- [x] Do not equate a green test suite with advisory remediation or blindly apply major overrides.

### Production-group advisory inventory

Versions and patch ranges below are the registry snapshot from 2026-11-06. Recheck before choosing
versions. Multiple rows for one package represent separate advisories. Titles are shortened for
scanning; follow the linked advisory for prerequisites and exact affected ranges.

| Package/version           | Registry severity | Advisory / issue                                                                                                     | Reported patched range |
| ------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `glob@13.0.6`             | Moderate          | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): abort cancellation bypass                  | `>=14.0.2`             |
| `minimatch@10.2.6`        | Moderate          | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): globparts amplification                    | `>=11.0.1`             |
| `braces@3.0.2`            | High              | [GHSA-grv7-fg5c-xmjg](https://github.com/advisories/GHSA-grv7-fg5c-xmjg): uncontrolled resource consumption          | `>=3.0.3`              |
| `micromatch@4.0.2`        | Moderate          | [GHSA-952p-6rrq-rcjv](https://github.com/advisories/GHSA-952p-6rrq-rcjv): regular-expression denial of service       | `>=4.0.8`              |
| `path-to-regexp@1.7.0`    | High              | [GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j): backtracking expressions                   | `>=1.9.0`              |
| `semver@5.7.1`            | High              | [GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw): regular-expression denial of service       | `>=5.7.2`              |
| `picomatch@2.2.2`         | Moderate          | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p): POSIX class method injection               | `>=2.3.2`              |
| `picomatch@2.2.2`         | High              | [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj): extglob denial of service                  | `>=2.3.2`              |
| `yaml@2.3.4`              | Moderate          | [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp): deeply nested collections                  | `>=2.8.3`              |
| `axios@1.18.1`            | Moderate          | [GHSA-vh66-26gq-q6x8](https://github.com/advisories/GHSA-vh66-26gq-q6x8): fetch-options pollution gadget             | `>=1.20.0`             |
| `axios@1.18.1`            | Moderate          | [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g): inherited default method                   | `>=1.20.0`             |
| `axios@1.18.1`            | High              | [GHSA-c29m-xwm3-cm6r](https://github.com/advisories/GHSA-c29m-xwm3-cm6r): data-URI parser denial of service          | `>=1.20.0`             |
| `axios@1.18.1`            | High              | [GHSA-mghh-pgcx-3jjj](https://github.com/advisories/GHSA-mghh-pgcx-3jjj): proxy-host normalization denial of service | `>=1.20.0`             |
| `axios@1.18.1`            | High              | [GHSA-x97p-jq2g-jp4f](https://github.com/advisories/GHSA-x97p-jq2g-jp4f): form-data options pollution gadget         | `>=1.20.0`             |
| `axios@1.18.1`            | High              | [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v): HTTP/2 DNS/proxy controls bypass           | `>=1.20.0`             |
| `axios@1.18.1`            | High              | [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8): HTTP/2 unhandled session error             | `>=1.20.0`             |
| `axios@1.18.1`            | Moderate          | [GHSA-j8rh-479h-cp32](https://github.com/advisories/GHSA-j8rh-479h-cp32): inherited headers after interceptor        | `>=1.20.0`             |
| `axios@1.18.1`            | Moderate          | [GHSA-4hqw-qxg8-jxx2](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2): inherited FormData headers                 | `>=1.20.0`             |
| `axios@1.18.1`            | High              | [GHSA-m8m8-qj5v-23w3](https://github.com/advisories/GHSA-m8m8-qj5v-23w3): inherited socket connection gadget         | `>=1.20.0`             |
| `axios@1.18.1`            | Moderate          | [GHSA-44g4-m2mj-wpvx](https://github.com/advisories/GHSA-44g4-m2mj-wpvx): CIDR proxy exclusion bypass                | `>=1.20.0`             |
| `axios@1.18.1`            | High              | [GHSA-r4gj-5m52-g5wh](https://github.com/advisories/GHSA-r4gj-5m52-g5wh): fetch redirect-limit bypass                | `>=1.20.0`             |
| `follow-redirects@1.16.1` | High              | [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p): cross-realm sensitive headers              | `>=1.16.2`             |

Dependency paths reported by the production-group audit:

- `@sentry/node > @sentry/bundler-plugins > glob > minimatch`.
- `patch-package > find-yarn-workspace-root > micromatch > braces / picomatch` and
  `patch-package > yaml`.
- `react-router-dom > react-router > path-to-regexp`.
- `@mapbox/polyline > meow > read-pkg-up > read-pkg > normalize-package-data > semver`.
- `sharetribe-flex-sdk > axios`.
- `sharetribe-flex-integration-sdk > axios > follow-redirects`.

## Upstream policy and architecture review

At the audited baseline, comparing `src`, `server`, `resources`, `config`, and `scripts` with
`git diff --name-status --no-renames upstream/main` yields 556 added files, 151 modified existing
upstream files, and two deletions. Of the modified existing files, 124 are implementation JS/CSS
excluding `.test.js` and snapshots; 14 are CSS. Counts include deliberate integration seams and
minor/comment changes and do not imply every difference should be removed.

The existing extension approach is the pattern to retain: small composition/registration hooks,
AV-owned helpers, hosted configuration when supported, and global overrides for existing-element
restyles. Avoid copying an entire upstream page merely to eliminate a small necessary seam.

### U01 — Shared AV button styles live in an upstream page stylesheet

**Status:** resolved. **Resolution PR/commit:** `d3b500572`.

**Resolution:** the button system moved to the AV-owned `src/styles/avCtaButtons.module.css` with a
self-contained base; every consumer composes from it, the PageBuilder token helpers read it,
`.sectionDetailsH` moved to `extensions/pageBuilder/av/sectionLayout.module.css`, and the plain
`.ctaButton`/`.description` restyles are global overrides. `SectionBuilder.module.css` matches
upstream except the var-driven `.blockContainer` padding, kept there because its cascade position
against each section's column classes decides the padding. Verified by comparing computed styles
from the before/after production CSS in headless Chromium (every consumer and token CTA, light and
dark, rest and hover, 375/768/1024/1440 px): the only change is the welcome popup buttons getting
their own `margin-top: 0`, which had been losing to the base in production (24 px).

**Evidence:**
[SectionBuilder.module.css](../../src/containers/PageBuilder/SectionBuilder/SectionBuilder.module.css#L179)
contains the AV button classes and modifiers. Shared components such as
[AVWelcomePopup.module.css](../../src/components/AVWelcomePopup/AVWelcomePopup.module.css),
[AVBagItemCard.module.css](../../src/components/AVBagItemCard/AVBagItemCard.module.css),
[BagPopup.module.css](../../src/components/BagPopup/BagPopup.module.css), and
[AddToBagButton.module.css](../../src/components/AddToBagButton/AddToBagButton.module.css) compose
them from that upstream container stylesheet. AV pages and PageBuilder blocks also depend on it.

**Impact:** a shared UI foundation depends on a page implementation detail. The upstream stylesheet
cannot be restored independently, and unrelated components must follow future PageBuilder style
changes. This is both an organization inconsistency and avoidable merge-conflict exposure.

**Recommended implementation:** extract the shared AV button system into an AV-owned shared style
module, update AV consumers, and supply its classes through existing PageBuilder helper seams. Keep
existing upstream-class restyles in `avBrandOverrides.css`. Do not replace one upstream fork with a
duplicate full PageBuilder implementation.

**Acceptance criteria:**

- [x] Reusable components no longer compose AV button classes from an upstream container stylesheet.
- [x] Section/block CTA tokens and modifiers retain their behavior.
- [x] Dark theme, hover/focus, form-button, anchor, and responsive appearances are verified.
- [x] Restore the upstream stylesheet where possible; document any minimal remaining necessity.

### U02 — Remaining upstream restyles can use existing AV boundaries

**Status:** resolved; Checkout row closed as a kept fork. **Resolution PR/commit:** `042f3d25e`.

**Resolution:** SectionFeatures, SectionFooter and SectionColumns CSS modules are byte-identical to
`upstream/main`: new classes moved to `SectionFeatures.av.module.css` /
`SectionFooter.av.module.css`, restyles of existing classes to `avBrandOverrides.css`, and the
2/3-cols gap is self-chained so it keeps its 64 px default. The same computed-style comparison (616
element states, incl. feature, footer and column cases) shows no change. `CheckoutPage.module.css`
stays a documented fork: it moves the whole two-column layout to `--viewportMedium` with a fluid
ramp, and re-declaring ~25 upstream rules for 768–1023 px as global overrides on the payment page
would add risk without reducing merge exposure (decision with the owner, 2026-11-06; recorded in
CLAUDE.md).

| Area                                                                                                                         | Existing customization                                          | Preferred boundary                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [SectionFeatures.module.css](../../src/containers/PageBuilder/SectionBuilder/SectionFeatures/SectionFeatures.module.css#L40) | 99 added lines of AV feature layout classes                     | Colocated AV module for new classes; existing-class restyles through global overrides               |
| [SectionFooter.module.css](../../src/containers/PageBuilder/SectionBuilder/SectionFooter/SectionFooter.module.css#L3)        | Brand variables, typography, padding, layout, and `belowSlogan` | Global overrides for existing classes; AV module for the added class                                |
| [CheckoutPage.module.css](../../src/containers/CheckoutPage/CheckoutPage.module.css#L496)                                    | Fluid columns, breakpoint changes, and image sizing             | Scoped global overrides matching existing classes; preserve the verified tablet/desktop geometry    |
| [SectionColumns.module.css](../../src/containers/PageBuilder/SectionBuilder/SectionColumns/SectionColumns.module.css#L7)     | AV gap variables                                                | Evaluate a global base-column override; retain current token behavior and existing AV layout module |

These are cleanup opportunities, including some deliberately retained forks documented in
`CLAUDE.md`; they are not newly discovered functional regressions. Preserve behavior before reducing
diffs. Scoped selectors and CSS composition require explicit care: copying a nested class selector
to another module changes its generated class and may stop it matching the upstream element.

**Acceptance criteria:**

- [x] Keep new component-specific classes in AV-owned modules and existing-class restyles global.
- [x] Compare against current `upstream/main`, not a historical merge-base or this audit's SHA.
- [x] Verify mobile/tablet/desktop layout, section tokens, dark themes, and CTA states visually.
- [x] Keep necessary JS import/prop/registration seams small; do not wrap large upstream JSX trees.
- [x] Update the authoritative upstream watchlist after files are genuinely restored.

### Pristine boundaries verified at audit time

The following remain clean against the audited `upstream/main`; do not reintroduce AV code there
while implementing fixes:

- `src/translations/{en,es,de,fr}.json`.
- `src/components/Page/Page.js`.
- PageBuilder's original `BlockBuilder`, `BlockDefault`, and `BlockFooter` implementations.
- `TopbarDesktop/CustomLinksMenu/` originals.
- `EditListingWizard/EditListingPhotosPanel/`.
- `CheckoutPage/CheckoutPageTransactionHelpers.js`.
- `ListingImageGallery/image-gallery.css`.

The deliberate AV block/menu forks still require manual upstream-change review on future syncs;
their existence is not evidence that the original upstream files are dirty.

## Other observations and limits

### O01 — Documentation drift

**Status:** resolved. **Resolution PR/commit:** `88e4b7983`. The pending README now lists releasing
the merged v12.6.0 with these fixes (migration 010 first) instead of a future v12.4 merge, and the
importer guide states that the active UI accepts CSV and ZIP.

- The [pending release guidance](../pending/README.md#release-and-operations) still says to merge
  upstream v12.4 after launch and describes the fork as v12.1. The audited package version is 12.6.0
  and HEAD is the upstream handover merge. Replace the stale action with any actual remaining
  validation; do not infer that Live deployment or launch sign-off is complete from the source merge
  alone.
- [bulk-import.md:92](../implementation/bulk-import.md#L92) describes the active UI as CSV-only,
  while [BulkImportPage.js](../../src/containers/BulkImportPage/BulkImportPage.js#L246) accepts CSV
  and ZIP. Reconcile the operator instructions with the intended supported upload flow.

### Lower-priority integration follow-up

The Instagram route and token-refresh paths also merit review while addressing A06: bare fetch calls
lack a deadline, feed handling reads PostgreSQL before consulting the feed cache, and cold cache
misses are not coalesced. Service construction can throw before a fallback's promise catch. These
observations were not developed into separately reproduced high-priority findings; confirm their
reachability and operational impact before expanding remediation scope. **Resolved with A06**
(`b576a806d`).

### Known constraints and excluded false positives

- Bulk-import restart and multi-process coordination limitations are already documented in
  [operations/scaling.md](../operations/scaling.md) and [pending/scaling.md](../pending/scaling.md).
  They were not counted again. A04 and A05 occur within the supported single-process model.
- WhatsApp hardening remains documented in [pending/notifications.md](../pending/notifications.md)
  and the feature is release-locked. Those known dormant gaps were not counted as new defects.
- `BulkImportPageV2` is deliberately retained and unrouted according to the importer guide; its
  duplicate implementation was not treated as an accidental active code path.
- The client shipping debounce observation was not reported as a charge-tampering defect because
  server quote-context and amount checks protect that path. A01 is a separate label authority gap.
- Root logout resets Redux. A02 concerns an external queue and delayed effects that survive that
  reset; A11 concerns freshness within a session.
- The branch helper's missing `AVWelcomePopup/index.test.js` warning is a barrel-file false
  positive; the component has tests. Its `server/services` client-import hit is a test comment, not
  a bundled server dependency. Raw `sectionName` matches in the custom hero were not alone treated
  as a defect because CTA parsing delegates to the shared parser.

### Verification completed

| Check                                                       | Result                                        |
| ----------------------------------------------------------- | --------------------------------------------- |
| `CI=true yarn test-server --runInBand`                      | 66 suites, 837 tests passed                   |
| `CI=true yarn test -- --watchAll=false --runInBand`         | 201 suites, 2,204 tests, 170 snapshots passed |
| `yarn format-ci`                                            | Passed                                        |
| `yarn av-translation-check`                                 | Passed; 346 symmetric keys                    |
| `yarn env-template-check`                                   | Passed                                        |
| `git diff --check`                                          | Passed                                        |
| Optional local branch-review helper against `upstream/main` | Reviewed; false positives noted above         |
| Dependency audit, all groups and production group           | Completed; advisories listed under D01        |

Passing existing tests does not cover the reproduced trust-boundary, account-switch, body-timeout,
or partial-failure cases. Those need targeted regression tests as fixes are implemented.

### Remediation verification (2026-11-06, branch `fix/audit-2026-11-06`)

| Check                                                        | Result                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `CI=true yarn test-server --runInBand`                       | 68 suites, 942 tests passed                                                                          |
| `CI=true yarn test -- --watchAll=false --runInBand`          | 202 suites, 2,239 tests, 170 snapshots passed                                                        |
| New regressions against the pre-fix code                     | A02, A03, A04 cases fail on the old code and pass on the new                                         |
| `yarn format-ci`, `git diff --check`                         | Passed                                                                                               |
| `yarn av-translation-check` / `env-template-check`           | Passed (346 symmetric keys) / passed                                                                 |
| `yarn check-translations-sorted`                             | Passed                                                                                               |
| `yarn run build` (web + server)                              | Passed                                                                                               |
| `yarn audit --groups dependencies` / `yarn audit`            | 2 moderate / 63 (0 critical), see D01                                                                |
| Before/after computed styles of the production CSS (U01/U02) | 616 element states, 4 widths, light/dark, rest/hover: only the intended welcome-popup margin changed |
| `git diff upstream/main` of the restored CSS modules         | Empty for SectionFeatures, SectionFooter, SectionColumns                                             |

**Not performed:** Render/Test deployment, migration 010 on the Test/Live databases, live provider
calls, and the repository auditor-agent pass (`/review`; it stopped on an account spend limit before
reporting). A `/code-review` pass ran instead, see below. The A01 Test checks and migration 010 are
tracked in the [pending README](../pending/README.md#release-and-operations).

### Code-review follow-up (2026-11-08)

A `/code-review` (high) of PR #142 reported ten findings. Each was checked against the code first;
six were fixed and three dismissed with evidence. The tenth, a cleanup, was not adopted.

| Review finding                                                                                                                                 | Outcome                                                                                                                                               | Commit      |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| A08: a promotional send that crashed mid-delivery could never be retried (`campaign_job_not_found`; recovery had finished its job as `sent`)   | Fixed: the job lookup and outcome update take any status but `cancelled`; the frequency cap leaves out the job being evaluated                        | `cfb636c65` |
| A09: a replay on a later day keyed the matching digest to a past day, due at once outside the 09:00 slot                                       | Fixed: `publicationDigestAt` keeps the pinned digest until its day is over, then uses the next one                                                    | `cfb636c65` |
| A01: every shipping checkout waited for the `metadata.avShipping` write (token exchange, update, retry backoff)                                | Fixed: the write runs in the background; a failed write falls back to the protectedData copy the same call wrote                                      | `d97567c07` |
| A01: the label control kept its own copy of the rule and showed **Generar guía** for a legacy record after a dispute, with a "try again" error | Fixed: one rule in `src/config/configAVShippingLabel.js` for the endpoint and the control; `409 LABEL_NOT_ALLOWED` shows `AVShippingLabel.notAllowed` | `383182925` |
| A02: a dropped favorites operation stayed queued (replayed, queue never drained); one queue was reused across users in one session             | Fixed: dropped operations leave the queue; a queue belongs to one user                                                                                | `8c47536e6` |
| U01: static CTA token maps rebuilt on every parse, with an unused `css` argument                                                               | Fixed: module-level constants                                                                                                                         | `ed06e6223` |
| A05: an early `409`/`429`/`503` before Multer would reset the browser's upload                                                                 | Not reproduced: Node drains the unread body; headless Chromium received the JSON `409` for 1, 20 and 50 MB bodies, also with `Connection: close`      | —           |
| A08: a retry that ends `deduplicated` leaves the job unrecorded                                                                                | Not a defect: whichever claimer sends records the outcome (the worker's `finish` or the other retry's `recordRetryOutcome`)                           | —           |
| A06: the stalled-body classification is repeated in four clients                                                                               | Not adopted: each copy is about three lines mapping to a different domain error; a callback option would move them, not remove them                   | —           |

Every new regression (A01 checkout write, A01 label control, A02, A08, A09) fails on the previous
code and passes on the new. Verification after the follow-up: client 203 suites, 2,254 tests, 170
snapshots; server 68 suites, 951 tests; `yarn format-ci`, `av-translation-check` (347 keys),
`env-template-check`, `check-translations-sorted`, `git diff --check` and `yarn run build` passed.
With `--runInBand`, `TransactionPage.test.js` keeps the Jest process alive after all its tests pass;
`main` does the same, so it does not come from this branch.

**Not performed:** live Sharetribe/Stripe/eShip money operations, deployed configuration inspection,
real provider failure injection, multi-process/load testing, and a production build during this
read-only audit. No conclusion about current deployment exploitability or release readiness should
be inferred beyond the stated code-path evidence.

## Suggested remediation sequence and review process

1. Fix A01–A03 in bounded PRs with the stated security regressions. Coordinate any process/backend
   changes explicitly; keep payments and in-flight transaction compatibility under review.
2. Address A04–A06 to bound import/concurrency and outbound-provider work.
3. Fix A07–A09 together around a shared eligibility/replay model, with separate regressions for each
   failure. Do not enable deferred marketing campaigns as part of an unrelated code fix.
4. Address A10–A11 and complete D01's reachability/upgrade review.
5. Reduce upstream styling divergence through U01–U02 after behavior is stable, and reconcile O01.

For every fix, record the PR/commit, targeted regression evidence, broader required checks, and any
Test-environment verification in the finding's resolution field. Update the current guide that owns
the behavior. Tests and documentation are part of resolution, not a later cleanup task. Remove this
report and its index links when all findings have been resolved or explicitly closed with an
evidence-backed decision; Git history is the archive.
