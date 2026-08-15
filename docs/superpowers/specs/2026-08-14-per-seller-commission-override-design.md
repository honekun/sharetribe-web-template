# Per-seller provider commission override

**Date:** 2026-08-14
**Status:** Approved design, ready for implementation planning

**Revised 2026-08-15** after an audit found the accepted range of `[0, 100]` unimplementable: at
100% the fixed fee cannot fit at any price, so every checkout by that seller would fail. The range
is now `[0, 75]`, checkout clamps the fixed fee instead of throwing, and the Console minimum
listing price rises to `6000`. See [Commission overflow](#commission-overflow). The audit also
surfaced that the same defect already affects the marketplace-wide rate today, independently of
this feature.

A second audit finding corrected the error-handling posture: the old text defaulted to the
marketplace rate on *any* failure and justified it with a claim that this could only ever overcharge
a discounted seller. Both halves were wrong. The rate is now defaulted only when the absence of an
override is established. See [Error handling](#error-handling).

A third moved storage off the Sharetribe user record entirely. `profile.metadata` is
Integration-API-writable but **publicly readable**, so every negotiated rate would have been visible
to anyone querying that seller. The rate now lives in an AV-owned PostgreSQL table; see
[Why not Sharetribe user data](#why-not-sharetribe-user-data). This removed the verification probe,
simplified the endpoints and made the error-handling fallback rarer, so parts of the two earlier
revisions are simpler than when they were written.

## Problem

The provider commission percentage is marketplace-wide. It comes from the hosted
`commission.json` asset and applies identically to every seller. AV needs to charge specific
sellers a negotiated rate without changing the rate everyone else pays.

## Solution summary

A per-seller percentage held in an AV-owned PostgreSQL table keyed by Sharetribe user ID. No row
means "use the marketplace-wide rate". Any valid number in `[0, 75]` replaces the marketplace
percentage for that seller's sales.

The rate is commercially confidential, so it is never stored on the Sharetribe user record — see
[Why not Sharetribe user data](#why-not-sharetribe-user-data).

The upper bound is not arbitrary — see [Commission overflow](#commission-overflow). The AV fixed
fee is charged on top of the percentage and has to fit inside the order total, which bounds both
the accepted rate and the marketplace's minimum listing price.

The value is resolved server-side in the three endpoints that build line items, and is never
trusted from the client.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Storage location | AV PostgreSQL table, keyed by user ID | Negotiated rates are confidential. Every Sharetribe user field is either seller-writable or publicly readable — see [Why not Sharetribe user data](#why-not-sharetribe-user-data). |
| What the override replaces | The percentage, and it clears `minimum_amount` for that seller | A negotiated low rate must not be silently overruled by the marketplace minimum floor on cheap items. |
| Fixed fee | Still applies, never overridden per seller | `REACT_APP_PROVIDER_COMMISSION_FIXED_FEE=1500` (15.00) is a separate line item. Its *amount* is out of scope; its *overflow behaviour* is not — see [Commission overflow](#commission-overflow). |
| Accepted range | `[0, 75]`, not `[0, 100]` | 100% makes the fixed fee impossible to fit at *any* price, breaking every checkout. 75% is the highest rate that clears the fee at the new minimum listing price. |
| Overflow at checkout | Clamp the fixed fee to what fits | The design's own rule is that a misconfigured override must never take a checkout down. Clamping floors the payout at zero instead of throwing. |
| Minimum listing price | Raise the Console value to `6000` | The invariant needs `minPrice x (1 - maxPct/100) >= 1500`. At the current `500` no rate satisfies it, not even 0%. |
| Meaning of `0` | Zero percentage, fixed fee still applies | Client decision. Consistent with the fixed-fee rule at every other value. Requires a contained change in `getProviderCommissionMaybe` (see below). |
| Admin write path | CLI script only | No new HTTP surface on a money-affecting setting. Follows the existing `scripts/notification-deliveries.js` pattern. |
| Seller-facing estimator | Shows the seller's real rate | The seller acts on that number when pricing a listing; showing the wrong one is worse than not showing one. |
| Reading the seller server-side | One indexed query against the AV table, using the author id already on the listing | No Sharetribe call at all, and no `include: ['author']`. The listing's `relationships.author` carries the id. |
| When the read is inconclusive | Fall back and log at `error` | Defaulting on an *unknown* rate mischarges in whichever direction the seller was negotiated. Only an established absence is safe to default. |
| Estimator read path | New `GET /api/commission/me`, own rate only | The rate is no longer on `currentUser`, so the estimator needs a server read. Scoped to the caller so it cannot become a way to look up anyone else. |

## Why not Sharetribe user data

A negotiated rate is commercially confidential: a seller learning that a peer pays 5% while they
pay 10% is a conversation the marketplace should choose to have, not one the API should start on
its behalf. No Sharetribe user field can hold it safely.

| Field | Write | Read |
| --- | --- | --- |
| `publicData` | Seller can write it — they could zero their own rate | Public |
| `privateData` | Seller can write it — same flaw | Owner and Integration API |
| `metadata` | Integration API only — correct | **Public** |

`metadata` protects the write path and nothing else. An earlier version of this design used it and
justified the choice with "Integration-API-writable only; sellers cannot set their own rate" — true,
and beside the point, because it says nothing about who can read it. Anyone able to query that user
through the Marketplace API would see the rate.

That is also why the earlier verification probe was self-defeating. It existed to confirm that a
third party *can* read another user's `profile.metadata`, because the read path depended on it —
so the probe passing would have confirmed the exposure rather than clearing it.

An AV-owned table is the only option that gets both properties at once: written by operators only,
readable only by this server.

## Semantics

The stored value is a `numeric` column, so the parse matrix applies to CLI input and to defensive
reads rather than to arbitrary JSON. `null` means "use marketplace-wide".

| Stored / entered value | Result |
| --- | --- |
| no row for the user | marketplace-wide (the normal path) |
| `5`, `5.5` | override at that value |
| `0` | override at 0 -> no percentage line item, fixed fee still charged |
| `75` | override at 75 (the maximum) |
| `-1`, `75.1`, `100`, `101`, `'12%'`, `'abc'`, `NaN` | rejected by the CLI; never reaches the table |

The column is `NOT NULL` with a `CHECK (percentage >= 0 AND percentage <= 75)` constraint, so the
range is enforced by the database as well as the parser. Clearing an override deletes the row
rather than storing a sentinel, which keeps "no override" a single representable state.

The ceiling lives in one exported constant, `MAX_PROVIDER_COMMISSION_PERCENTAGE = 75`, so the
parser, the CLI and the migration's `CHECK` cannot drift apart on it.

Worked example, marketplace default 10% + 15.00 fixed, seller overridden to 5%, order of 1,000.00:

```
line-item/item                    1,000.00
line-item/provider-commission        -50.00   (5%, not 10%; no minimum floor)
line-item/provider-commission-fixed  -15.00
payoutTotal                         935.00
```

## Commission overflow

### Where the two commission layers come from

| Layer | Source | Scope |
| --- | --- | --- |
| Provider percentage + `minimum_amount` | Console `commission.json` | Marketplace-wide; this design overrides the percentage per seller |
| Minimum listing price | Console `transaction-size.json` (falls back to `500`) | Marketplace-wide |
| Fixed fee | `REACT_APP_PROVIDER_COMMISSION_FIXED_FEE=1500` | AV-only. Sharetribe does not know it exists, so nothing on their side accounts for it |

Sharetribe's own commission is always applied and is theirs to reason about. The env layer is the
part AV adds on top, and it is the part that can overflow the order total, because no Sharetribe
validation is aware of it.

### The invariant

Today `getProviderCommissionMaybe` throws when the percentage plus the fixed fee exceeds what the
buyer paid (`lineItemHelpers.js:406`) — the behaviour this section replaces. Writing that condition
out, a checkout currently fails when

```
price < fixedFee / (1 - pct/100)
```

| Rate | Listings below this break |
| --- | --- |
| 0% | 15.00 |
| 10% (today's marketplace rate) | 16.67 |
| 50% | 30.00 |
| 75% | 60.00 |
| 100% | every price, at any amount |

100% is therefore not a valid rate under any configuration: at 100% the percentage alone consumes
the entire order, so the fixed fee can never fit. Accepting it as the design previously did would
have broken every sale by that seller.

This also exposes a defect that predates the override: with the minimum listing price at `500` and
the fixed fee at `1500`, listings between 5.00 and 16.67 already break at payment time on today's
marketplace-wide 10%. No percentage — not even 0% — satisfies the invariant while the minimum
price sits below the fixed fee.

The invariant that must hold marketplace-wide is therefore

```
listingMinimumPrice x (1 - MAX_PROVIDER_COMMISSION_PERCENTAGE/100)  >=  fixedFee
```

which this design satisfies by raising the Console minimum to `6000` and capping the override at
`75`: `6000 x 0.25 = 1500`. Both numbers are Console/env values rather than code, so a test asserts
the relationship holds for the configured values and fails if either moves without the other.

The relationship holds at equality, which is the boundary worth naming: a 75% seller pricing at
exactly 6000 pays 4500 + 1500 and takes home nothing. Nothing breaks — the commission equals the
order rather than exceeding it — but 75% is only a sensible rate on listings priced well above the
minimum, and the CLI prints the implied minimum precisely so an operator sees that.

### Policy: clamp, do not throw

Raising the minimum listing price only constrains listings created or edited afterwards. Listings
already priced below it keep transacting, and lowering a seller's price or raising their rate can
re-create the overflow at any time. So prevention alone is not enough and the checkout path needs a
defined behaviour.

The fixed fee is clamped to what remains of the order after the percentage:

```js
const remaining = totalMoneyIn.amount - percentageAmount;
const fixedFeeToCharge = Math.min(PROVIDER_COMMISSION_FIXED_FEE, Math.max(0, remaining));
```

- Payout floors at zero; it never goes negative and the API is never sent an impossible breakdown.
- Checkout completes. This follows the rule already stated under Error handling — a misconfigured
  override must never take a seller's checkout down.
- When `fixedFeeToCharge` is `0` the line item is omitted entirely rather than sent as a zero.
- Every clamp is logged with the listing price, the rate and both fee amounts, because it means the
  platform earned less than intended and someone should see why.

The alternative — keeping the throw — was rejected: it guarantees revenue but converts a pricing
misconfiguration into a failed checkout for the buyer, which is the worse failure and contradicts
the design's own error-handling posture.

### The same invariant in three places

| Layer | Enforcement |
| --- | --- |
| CLI `set` | Rejects anything the parser rejects, which now includes `> 75`. Also refuses to write a rate whose implied minimum price (`fixedFee / (1 - pct/100)`) exceeds the configured `listingMinimumPrice`, so an operator cannot create a rate that is legal in isolation but impossible against the current Console setting. |
| Listing price validation | The Console `listingMinimumPrice` of `6000` is what the listing wizard already enforces. Because the cap guarantees the invariant for every accepted rate, a single global minimum covers all sellers and no per-seller price rule is needed. |
| EarningsEstimator | Applies the same clamp when computing the breakdown, so the seller sees the fee they will actually be charged rather than a figure the checkout would reduce. At a price where the fee clamps, it shows the reduced fee and a zero payout rather than a negative one. |

The estimator matters here beyond cosmetics: it is the number a seller prices against, and showing
an uncharged fee would misstate their earnings in the one place they are deciding.

## Architecture

### Migration `010_provider_commission_overrides.sql`

Follows the existing numbered-migration pattern.

```sql
CREATE TABLE provider_commission_overrides (
  user_id     text PRIMARY KEY,
  percentage  numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 75),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  updated_by  text
);
```

`user_id` is the Sharetribe user UUID as text, which is what the listing's `relationships.author`
already gives us. `updated_by` records the operator so a rate change is attributable — this is a
money setting and "who set this, and when" should be answerable from the row itself rather than
only from logs.

### New module: `server/services/providerCommissionStore.js`

Data access only, following `eshipTrackingStore.js` / `brevoWebhookStore.js`.

```js
getOverride(userId)                  // async -> { found: true, percentage } | { found: false }
setOverride(userId, pct, updatedBy)  // async; upsert
clearOverride(userId)                // async; DELETE
```

`getOverride` returns a tagged result rather than `number | null`, because "this seller has no
override" and "I could not read the table" must not collapse into the same value — that conflation
is the defect [Error handling](#error-handling) exists to prevent. A failed query rejects; it does
not resolve to `{ found: false }`.

### New module: `server/api-util/providerCommission.js`

AV-owned, pure, no I/O — the store above is the only thing that touches the database.

```js
parseCommissionOverride(raw)   // number | null; CLI input and defensive reads
applyOverride(commission, pct) // { ...commission, percentage: pct }, minimum_amount dropped

resolveProviderCommission(commission, sellerUserId, deps)  // async -> { commission, source }
```

`resolveProviderCommission` returns the Console asset object untouched when there is no override.
When there is one it returns `{ ...commission, percentage: <override> }` with `minimum_amount`
omitted entirely (not set to `undefined`). It also returns the `source` that produced the value
(`override` / `default` / `fallback`) so the caller can log it without re-deriving it.

**It is async**, because it reads the store. The three endpoints therefore `await` it — the same
shape `transactionLineItems` already took on when the eShip quote made it async.

### Call sites: the three endpoints

The resolver runs in the endpoints, before `transactionLineItems` is called. The signature of
`transactionLineItems` does not change and `lineItems.js` is not modified at all.

| File | Change |
| --- | --- |
| `server/api/transaction-line-items.js:11` | take the author id from `listing.relationships.author`, resolve |
| `server/api/initiate-privileged.js:76` | same |
| `server/api/transition-privileged.js:153` | same |

Only the author's **id** is needed, and that arrives in the listing's `relationships` on every one
of these responses. So no `include: ['author']`, no sparse `fields.user`, and no change to what any
of the three endpoints requests from Sharetribe — a smaller footprint than the metadata design,
which had to widen the `transaction-line-items` query to carry the author's profile.

### The `lineItemHelpers.js` change for 0%

`getProviderCommissionMaybe` currently early-returns `[]` at line 356 when there is neither a
percentage nor a minimum, and the fixed-fee block sits after that return at line 402. An override
of exactly `0` would therefore drop the fixed fee too.

The fix distinguishes an explicitly configured `0` from an absent percentage:

```js
const hasExplicitZeroPercentage = providerCommission?.percentage === 0;
if (!hasMinimumCommission && !hasCommissionPercentage && !hasExplicitZeroPercentage) return [];
```

and the percentage line item becomes conditional on `hasCommissionPercentage` (which requires
`> 0`), so a `-0%` line item is never sent to the API. At 0% the returned array contains the fixed
fee only.

Making this conditional on an *explicit* zero matters: an unconditional change would make a
marketplace with no commission asset configured suddenly start charging providers $15.

**Accepted marketplace-wide behaviour change:** if the Console asset is ever set to exactly 0%, the
fixed fee will now apply where it previously did not. This is the correct reading of an explicitly
configured zero, and today's Console is at 10%, so nothing changes in practice.

### The `lineItemHelpers.js` change for overflow

The second change to the same function replaces the throw at line 406 with the clamp specified
under [Commission overflow](#policy-clamp-do-not-throw). This is marketplace-wide, not
override-specific: it fixes the pre-existing case where a listing priced below `fixedFee / (1 -
pct/100)` fails at payment time on the ordinary 10% rate.

Both changes are confined to `getProviderCommissionMaybe`. Nothing else in `lineItemHelpers.js`
moves, and `lineItems.js` is still untouched.

### Client: EarningsEstimator

Moving the rate off the user record costs the estimator its free read. It can no longer take the
value from `state.user.currentUser`, because the rate is not in the Sharetribe payload any more —
which is the entire point.

**New endpoint: `GET /api/commission/me`.** Authenticated through the caller's own SDK instance in
the same way the other AV endpoints are, and it returns only the caller's own rate:

```json
{ "providerCommissionPercentage": 5 }   // or null for "marketplace-wide"
```

It takes no user parameter. There is deliberately no way to ask it about anyone else, so it cannot
become the leak the table was created to avoid.

This is a new HTTP surface, which the design otherwise avoids — the [Trust model](#trust-model)
covers why a read-only, self-scoped endpoint is a different proposition from a write one.

`EditListingPricingPanel.js:122` and `EditListingPricingAndStockPanel.js:108` already have
`currentUser` but do not pass it into their forms, and the AndStock form renders
`<EarningsEstimator price marketplaceCurrency />` with nothing else. Rather than prop-drill through
two panels and two forms, `EarningsEstimator` fetches its own rate on mount and falls back to
`config.earningsEstimate.providerCommissionPercentage` until the response arrives or if it fails.
One file changes and both call sites are fixed.

It also applies the same clamp as the server, so the fee it shows is the fee that will be charged.
Its current arithmetic (`EarningsEstimator.js:37`) adds the percentage and the fixed amount
unconditionally, which would overstate the deduction — and show a negative payout — at any price
where the server clamps.

No new "negotiated rate" label or translation keys; the estimator simply shows the correct number.

### Duplicated parser

`parseCommissionOverride` is needed on both sides. `server/` is CommonJS and the project rule is
that client code never imports from `server/`. The parser therefore exists twice, each copy
carrying a comment pointing at the other, and both tested against the same matrix table so
divergence surfaces as a test failure rather than a pricing bug.

### Operator CLI: `scripts/provider-commission.js`

Follows `scripts/notification-deliveries.js`: `require('../server/env').configureEnv()`,
`console.table`, usage text on bad arguments.

Writes go to the AV table through `providerCommissionStore`, so `set` and `clear` need
`DATABASE_URL` but no Sharetribe credentials. The Integration SDK is still used for one thing only:
resolving an `<email>` argument to a user id, and printing the display name back so the operator can
confirm they targeted the right seller. Passing a `<userId>` directly needs no Sharetribe access at
all.

```
yarn commission:get   <userId|email>
yarn commission:set   <userId|email> <pct>
yarn commission:clear <userId|email>
```

`set` validates through the same parser and refuses anything it rejects — including anything above
`MAX_PROVIDER_COMMISSION_PERCENTAGE` — rather than writing a value that would silently fall back at
checkout. It additionally refuses a rate whose implied minimum price exceeds the configured
`listingMinimumPrice`, so the invariant cannot be broken from the CLI even if the Console minimum
is later lowered.

It prints the resulting effective rate as confirmation, along with the minimum listing price that
rate implies, so the operator sees the constraint they have just placed on that seller.

### Operator documentation

A new section in `docs/operator-guide.md` covering: how to find a seller's user ID, the exact
commands, the `''` vs `0` vs `5` semantics table, the interaction with the fixed fee and the
cleared minimum floor, the `75` ceiling and why it exists, the minimum listing price each rate
implies, what a clamped fee looks like in the breakdown, and how to verify a change took effect on
a real checkout. Per repo convention this also means the ES translation and a fragment splice into
`docs/shareable/operator-guide.html`.

It must also cover the fallback: what an `error`-level commission-fallback log means, that
sustained ones are a pricing incident rather than noise, and how to list the transactions created
during the window so they can be reconciled. An operator who does not know to look for these will
not find the mispriced sales.

## Trust model

- The rate lives in an AV-owned table reachable only from this server. It is not part of any
  Sharetribe payload, so no API consumer — seller, buyer or competitor — can read another seller's
  negotiated rate.
- Sellers cannot write it either: the only write path is the CLI, which needs `DATABASE_URL`, a
  server secret absent from the browser bundle.
- One new HTTP surface, `GET /api/commission/me`, and it is read-only and self-scoped: it takes no
  user argument and returns only the authenticated caller's own rate. A seller learning their own
  rate is not a leak — they negotiated it. The rule this design keeps is the one that matters, that
  there is no HTTP *write* path for a money-affecting setting.
- The estimator's client-side read is display-only. The charged amount is always re-derived
  server-side from the table, the same posture as the eShip quote.

## Error handling

**Falling back is not a safe default, and the design must not pretend otherwise.** An earlier
version of this section claimed a fallback "can only overcharge a discounted seller rather than
undercharge the platform". That is wrong in both halves:

- Overrides are not necessarily *discounts*. The accepted range runs to 75% while the marketplace
  rate is 10%, so a seller negotiated upward falls back to a **lower** rate and the platform
  undercharges itself.
- Even in the discount direction it is not benign. Charging a seller 10% when 5% was agreed breaks
  the agreement; "we defaulted" is not a defence a seller has to accept.

So the rate is only defaulted when the absence of an override is *established*, never when it is
merely unknown.

### Determinacy, not failure count

| State | Determinacy | Behaviour |
| --- | --- | --- |
| Query returns no row | Conclusive: no override exists | Marketplace-wide, silent. The normal path. |
| Query returns a row | Conclusive | Apply it. The `CHECK` constraint means it is already in range. |
| Author id missing from the listing | Indeterminate — cannot identify the seller | Fall back, `error`-level log |
| Query rejects (database unreachable, timeout) | Indeterminate | Fall back, `error`-level log, flagged for reconciliation (below) |

Moving storage into the AV database shrank this table. The metadata design had to handle a missing
`included[]` author and a malformed free-text value; neither exists now. The author id is on the
listing itself, and the column is typed and constrained, so "present but nonsense" is not a
reachable state.

It also made the indeterminate branch far rarer. The read is a primary-key query against the
database this server already needs for the event poller, the shipping-label ledger and the rate
limiter — not a call to a third-party API. If it is down the process has larger problems than
commission accuracy, and the fallback window that [Accepted risk](#accepted-risk) describes narrows
accordingly.

### Accepted risk

When the authoritative lookup also fails, the transaction is still created, at the marketplace-wide
rate, in **both** money endpoints as well as the preview. This is a deliberate choice of
availability over pricing accuracy: an Integration outage does not stop the marketplace trading.

The cost is real and is accepted knowingly — during such an outage, transactions involving an
overridden seller are created at the wrong commission, in whichever direction that seller's
negotiated rate differs from the marketplace rate. That is a money defect, not a cosmetic one.

Three things make it recoverable rather than silent:

1. **Every resolution is logged**, not only applied overrides: seller id, the rate actually used,
   and which row of the table above produced it. No other PII.
2. **Fallbacks log at `error` level**, not `warn`, so they surface in alerting rather than sitting
   in noise. A fallback means money may be wrong; that is not a warning.
3. **The log line is designed to be queryable after the fact.** Because a fallback records the
   seller and the timestamp, the affected transactions can be listed and corrected once the outage
   is over. Without this the design would have no way to answer "who did we misprice on Tuesday?"

An operator noticing sustained fallback logs should treat it as a pricing incident, not a
transient warning — the operator guide says so explicitly.

Two pre-existing behaviours, one documented and one now fixed:

- The `minimum_amount > totalMoneyIn` throw at `lineItemHelpers.js:372` can no longer fire for
  overridden sellers now that the floor is cleared. Unchanged otherwise.
- The fixed-fee guard at `lineItemHelpers.js:406` used to throw when commission + fixed fee exceeded
  the order total, so any item under `fixedFee / (1 - pct/100)` broke checkout — already true today
  at 10%, for listings between the 5.00 minimum and 16.67. That guard is replaced by the clamp in
  [Commission overflow](#policy-clamp-do-not-throw), which is why this design raises the Console
  minimum listing price as well.

## Deployment prerequisites

| Prerequisite | Where | Notes |
| --- | --- | --- |
| Minimum listing price `6000` | Console `transaction-size.json` | Was `500`, or unset and falling back to it. Required by the [invariant](#the-invariant). |
| Provider commission | Console `commission.json` | Unchanged; the override replaces it per seller |
| Migration `010` applied | Every environment's database | Including the Render test database, via the existing `migrate-test-db` procedure |
| `DATABASE_URL` | Every environment | Already required for the event poller, shipping labels and rate limiting |

Raising the minimum only affects listings created or edited afterwards. Existing listings below
6000 keep transacting and rely on the clamp, which is the reason the clamp exists rather than
prevention alone. Auditing and repricing those listings is a separate operational task, not a
blocker for this design.

### The verification probe is no longer needed

An earlier version of this design required a probe before implementation, to confirm the
Marketplace API returns `profile.metadata` for a third-party user. That question disappears with
the storage change: the rate is read from the AV database, so nothing depends on what Sharetribe
exposes about a user.

Worth recording why, because the probe's result would have been misleading either way. It was
written as a go/no-go on the read path, but a *pass* would have meant "any API consumer can read
this seller's negotiated rate" — the [confidentiality problem](#why-not-sharetribe-user-data), not
a green light. The probe was measuring the right fact and drawing the wrong conclusion from it.

## Test plan

| Target | Coverage |
| --- | --- |
| `server/api-util/providerCommission.test.js` (new) | full parse matrix including the `75` boundary and rejection of `75.1`/`100`/`101`, passthrough with no override, `applyOverride` sets percentage and drops `minimum_amount` |
| `providerCommission.test.js` — determinacy | one case per row of the [Error handling](#error-handling) table: no row defaults silently; a row is applied; a missing author id falls back; a **rejecting** store falls back and returns `source: 'fallback'` so the log is provably emitted. The key assertion is the negative one — that "no override" and "could not read" do not take the same path, which means asserting the store rejects rather than resolving `{ found: false }` |
| `server/services/providerCommissionStore.test.js` (new) | round-trip set/get/clear, upsert replaces rather than duplicates, `CHECK` constraint rejects `-1` and `75.1` at the database level, `getOverride` distinguishes absent from unreadable |
| `GET /api/commission/me` | returns the caller's rate, returns `null` when they have none, rejects unauthenticated callers, and — the security-relevant case — accepts no parameter that could target another user |
| `server/api-util/lineItemHelpers.test.js` (extend) | explicit 0% emits fixed-fee only; absent percentage with no minimum still returns `[]` (regression guard for the early-return change); percentage > 0 unchanged; **clamp cases** — fee reduced to the remainder when it would overflow, line item omitted when nothing remains, payout never negative, and no throw at any price down to the minimum |
| Invariant test (new) | `listingMinimumPrice x (1 - MAX_PROVIDER_COMMISSION_PERCENTAGE/100) >= fixedFee` for the configured values, so raising the cap or the fee without revisiting the Console minimum fails the build rather than production |
| `server/api-util/lineItems.test.js` | untouched; passing unchanged is the signal that the resolver stayed out of the line-item core |
| `EarningsEstimator.test.js` (new, none exists today) | fetched rate preferred, falls back to config before the response arrives and if the request fails, clamped fee matches the server's for the same price and rate, payout never rendered negative |
| Manual | a real Test-marketplace checkout with an overridden seller, confirming the OrderBreakdown commission row and the resulting `payoutTotal` |

The three privileged endpoints have no test files today (only AV-owned endpoints do). Keep it that
way rather than standing up SDK-mocking harnesses for three upstream files; the logic worth testing
lives in the pure resolver.

## Out of scope

- Overriding the customer commission.
- Overriding the fixed fee per seller.
- Any admin UI or HTTP endpoint for *setting* the value. `GET /api/commission/me` reads the
  caller's own rate and cannot write or target anyone else.
- Per-listing or per-category commission rates.
