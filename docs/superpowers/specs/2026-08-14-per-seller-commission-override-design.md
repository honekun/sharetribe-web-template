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

**Revised 2026-08-16** after review found the second revision had not gone far enough: the error
table still defaulted to the marketplace rate after a missing author or a failed query, and still
created the transaction at that rate. The money endpoints now **retry once and then fail `503`** on
an indeterminate read; only the display-only preview falls back. Approved by the marketplace owner
on 2026-08-16 as availability-for-accuracy, the opposite of the trade the previous revision made.
The same review pinned the [invariant's configuration source](#the-same-invariant-in-three-places)
and removed the exemption that left the three money endpoints untested. See
[Error handling](#error-handling).

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
| When the read is inconclusive | Preview falls back; the two money endpoints retry once and then fail `503` | Defaulting on an *unknown* rate mischarges in whichever direction the seller was negotiated. A mispriced sale cannot be reliably found again afterwards, so it must not be created. See [Error handling](#error-handling). |
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
rather than storing a sentinel, which keeps "no override" a single representable state — the
operator trail that deletion would otherwise destroy lives in a separate append-only table, so the
two concerns do not have to be traded against each other.

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
`75`: `6000 x 0.25 = 1500`. Two of these three numbers live outside the repository, which is a
problem for enforcement rather than a detail — see [Where `listingMinimumPrice` comes
from](#where-listingminimumprice-comes-from) for which layer checks which copy, and why the CI test
can only speak for the code-side ones.

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

### Where `listingMinimumPrice` comes from

The invariant is stated against a number this repository does not own. Three of its four terms are
code or env constants; `listingMinimumPrice` is a hosted asset an operator can change in Console
tomorrow. Every enforcement below has to say which copy of that number it is reading, or it is
asserting nothing.

| Consumer | Reads | If it cannot read it |
| --- | --- | --- |
| CLI `set` | `transaction-size.json` via `sdk.assets.search()`, using the **public** `REACT_APP_SHARETRIBE_SDK_CLIENT_ID` | **Refuses to write.** An `--assume-min-price=<subunits>` flag exists for a disconnected operator and is echoed in the confirmation line, so a skipped check is never invisible. |
| Server readiness check | The same asset, once at boot, after hosted config loads | Logs `error` and continues. It is a diagnostic, not a gate — a marketplace that cannot fetch its own config has already failed louder elsewhere. |
| CI invariant test | The **code** constants only: `MAX_PROVIDER_COMMISSION_PERCENTAGE`, `PROVIDER_COMMISSION_FIXED_FEE`, and `configDefault.listingMinimumPriceSubUnits` | n/a |

This resolves a contradiction the previous revision carried: the CLI claimed both to validate
against the live Console minimum and to need no Sharetribe access when given a UUID. Both are true
only once the distinction is drawn — the *asset* read needs the public client id and network access,
which every browser session also has; the **Integration** credentials are what a `<userId>`
invocation avoids, and those are only ever needed to resolve an `<email>` to an id.

**CI cannot assert anything about the Console value, and should not pretend to.** A test that
fetches a mutable hosted asset is a test that fails when someone else edits it, which is a build
break rather than a finding. What CI can pin is that the code-side numbers are self-consistent — and
for that to be meaningful, `configDefault.listingMinimumPriceSubUnits` has to stop being `500`.

**The code fallback rises to `6000` alongside the clamp.** It is a watchlist file
(`src/config/configDefault.js:25`, upstream), so the change is the single number and nothing else.
It applies only where the Console asset is absent or `0`, which today means local development and
any freshly provisioned environment — exactly the places where a `500` minimum silently reintroduces
the overflow this design exists to close. It must land in the same commit as the clamp: raised
earlier it blocks listings between 5.00 and 60.00 with no clamp to justify it, raised later it
leaves a window where the invariant is false by default.

### The same invariant in three places

| Layer | Enforcement |
| --- | --- |
| CLI `set` | Rejects anything the parser rejects, which now includes `> 75`. Also refuses to write a rate whose implied minimum price (`fixedFee / (1 - pct/100)`) exceeds the `listingMinimumPrice` it read above, so an operator cannot create a rate that is legal in isolation but impossible against the current Console setting. |
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

CREATE TABLE provider_commission_override_history (
  id          bigserial PRIMARY KEY,
  user_id     text        NOT NULL,
  percentage  numeric(5,2),          -- NULL records a clear
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text
);
CREATE INDEX ON provider_commission_override_history (user_id, changed_at DESC);
```

`user_id` is the Sharetribe user UUID as text, which is what the listing's `relationships.author`
already gives us. `updated_by` records the operator so a rate change is attributable — this is a
money setting and "who set this, and when" should be answerable from the row itself rather than
only from logs.

The history table exists because the live table cannot answer that question after a `clear`. Storing
"no override" as the absence of a row is the right model — it keeps a single representable state,
and [Semantics](#semantics) explains why — but a `DELETE` takes `updated_by` and `updated_at` with
it, so the one operation that ends a negotiated rate is the one that leaves no trace of who ended
it. Every `set` and every `clear` appends a row here; a clear is recorded as a `NULL` percentage. The
table is append-only and never read by the checkout path, so it cannot affect pricing.

### New module: `server/services/providerCommissionStore.js`

Data access only, following `eshipTrackingStore.js` / `brevoWebhookStore.js`.

```js
getOverride(userId)                    // async -> { found: true, percentage } | { found: false }
setOverride(userId, pct, updatedBy)    // async; upsert + history append
clearOverride(userId, clearedBy)       // async; DELETE + history append (percentage NULL)
getHistory(userId)                     // async -> rows, newest first; operator/CLI only
```

`setOverride` and `clearOverride` write both tables in one transaction, so a recorded rate change
and its history entry cannot come apart. `clearOverride` takes the operator argument that the old
signature did not, which is the point of the history table.

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
(`override` / `default` / `indeterminate`, the last carrying a `reason`) so the caller can log it,
and decide on it, without re-deriving anything.

It never throws on an unreadable store and never refuses on its own: refusing is the caller's
policy, per the [determinacy table](#determinacy-decides-the-operation-decides-what-to-do-about-it).
`retries` is a parameter (`0` for the preview, `1` for the money paths) rather than a constant,
because the two have different tolerances for waiting.

**It is async**, because it reads the store. The three endpoints therefore `await` it — the same
shape `transactionLineItems` already took on when the eShip quote made it async.

### New module: `server/api-util/commissionEndpoint.js`

The three endpoints do the same four things: pull the author id off the listing, await the resolver,
log the resolution, and either use the result or refuse. Written inline that is the same dozen lines
in three upstream files — a merge-conflict surface, and untestable without an SDK harness for each.

```js
resolveCommissionForRequest(listing, commission, { operation, retries })
// async -> { commission, source, reason } ; logs the resolution
```

AV-owned, so it is unit-testable on its own, and each upstream endpoint keeps a call plus a refusal
check. This is the composition-root swap the repo's [upstream file policy](../../../CLAUDE.md)
prefers, applied to a helper rather than a component.

### Call sites: the three endpoints

The resolver runs in the endpoints, before `transactionLineItems` is called. The signature of
`transactionLineItems` does not change and `lineItems.js` is not modified at all.

| File | Change |
| --- | --- |
| `server/api/transaction-line-items.js:11` | take the author id from `listing.relationships.author`, resolve with `retries: 0`, use the result whatever its `source` |
| `server/api/initiate-privileged.js:76` | same author extraction, resolve with `retries: 1`, and **return `503 { code: 'COMMISSION_UNRESOLVED' }` when `source === 'indeterminate'`** |
| `server/api/transition-privileged.js:153` | same as `initiate-privileged` |

Only the author's **id** is needed, and that arrives in the listing's `relationships` on every one
of these responses. So no `include: ['author']`, no sparse `fields.user`, and no change to what any
of the three endpoints requests from Sharetribe — a smaller footprint than the metadata design,
which had to widen the `transaction-line-items` query to carry the author's profile.

The three call sites differ only in `retries` and in what they do with `indeterminate`, and that
difference is the whole of the money policy. It is small enough to read at a glance and important
enough that [the test plan](#test-plan) covers each of the three rather than trusting the resolver's
unit tests to imply them.

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

It responds with `Cache-Control: private, no-store`. The body is a per-seller confidential value on
a path that does not vary by user, which is exactly the shape a shared cache mis-serves: without the
header a proxy or service worker is free to hand one seller's negotiated rate to the next caller of
`/api/commission/me`. `private` alone would still permit browser-disk storage, so `no-store` is the
one that matters.

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
`DATABASE_URL` but no Sharetribe **credentials**. The Integration SDK is used for one thing only:
resolving an `<email>` argument to a user id, and printing the display name back so the operator can
confirm they targeted the right seller. Passing a `<userId>` directly avoids it entirely.

That is not the same as needing no Sharetribe *access*. `set` also reads `transaction-size.json` to
check the implied minimum price, which goes through `sdk.assets.search()` with the public marketplace
client id — no secret, but network access to Sharetribe, and a `--assume-min-price` escape hatch
when there is none. See [Where `listingMinimumPrice` comes
from](#where-listingminimumprice-comes-from).

```
yarn commission:get     <userId|email>
yarn commission:set     <userId|email> <pct>
yarn commission:clear   <userId|email>
yarn commission:history <userId|email>
```

`history` prints the append-only trail for one seller, which is the only way to answer "who cleared
this, and when" once the live row is gone.

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

It must also cover the failure mode: that `COMMISSION_UNRESOLVED` means the overrides table could
not be read and checkout is refused marketplace-wide until it can, that this is a database incident
affecting the poller and shipping labels too, and that the deliberate consequence is no mispriced
sale to hunt for afterwards. An operator who expects a degraded-but-trading marketplace needs to
know this one stops instead.

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
merely unknown. **And where "merely unknown" would otherwise mean moving money at a guessed rate,
the operation fails instead of guessing.**

### Determinacy decides; the operation decides what to do about it

Two facts combine. The resolver reports determinacy and nothing else; the caller applies the policy
its own consequences justify. A preview that renders the wrong number is a display bug. A money
endpoint that creates a transaction at the wrong number is a money defect, and no amount of logging
turns one back into the other.

| State | Determinacy | Resolver returns | Preview (`transaction-line-items`) | Money (`initiate-privileged`, `transition-privileged`) |
| --- | --- | --- | --- | --- |
| Query returns no row | Conclusive: no override exists | `source: 'default'` | Marketplace-wide, silent. The normal path. | Same. |
| Query returns a row | Conclusive | `source: 'override'` | Apply it. The `CHECK` constraint means it is already in range. | Same. |
| Author id missing from the listing | Indeterminate — cannot identify the seller | `source: 'indeterminate'`, `reason: 'no-author'` | Fall back, `warn`-level log | **Fail.** Not retried: a listing payload without `relationships.author` is not a transient condition. |
| Query rejects (database unreachable, timeout) | Indeterminate | `source: 'indeterminate'`, `reason: 'store-unreadable'` | Fall back, `warn`-level log | **Retry once, then fail.** `error`-level log. |

The resolver never throws on an indeterminate read and never decides the outcome. It returns the
marketplace-wide commission alongside `source: 'indeterminate'`, which the preview may use and the
money endpoints must not. Keeping the policy at the call site is what makes "which of these
creates a mispriced sale" answerable by reading three call sites rather than by tracing a flag
through a shared helper.

**Retry.** Only the store-unreadable branch is retried, once, after 200ms, and only on the money
paths. The realistic failure is a dropped pooled connection, which a second attempt clears; a
sustained outage is not something a retry loop should paper over while a buyer waits. The preview
does not retry at all — it has a correct-enough answer already and the seller is not being charged.

**Failing looks like this.** The two money endpoints respond `503` with
`{ code: 'COMMISSION_UNRESOLVED' }` and create nothing. The buyer sees the checkout error path that
already exists for a failed `initiate`; no new client state, no new translation key. A seller
accepting an offer through `transition-privileged` hits the same wall. That is the cost, stated
plainly: during a database outage, overridden or not, checkout and offer acceptance stop.

**Why that cost is the right one to take.** The alternative was creating the transaction at the
marketplace rate and reconciling afterwards. Reconciliation was the weak half of that plan: the only
correlation available is seller id plus timestamp, and because the preview resolves commission too —
several times per checkout, as the buyer edits the form — the log is dominated by resolutions that
never became transactions. "Who did we misprice on Tuesday" would return a list that cannot be
filtered down to the sales that actually happened without matching on time windows by hand. A
mispriced sale that cannot be reliably identified is not a recoverable defect; it is a silent one.

Moving storage into the AV database also made this branch far rarer, which is what makes the
fail-closed posture affordable. The read is a primary-key query against the database this server
already needs for the event poller, the shipping-label ledger and the rate limiter — not a call to a
third-party API. If it is unreachable, the poller has stopped, labels cannot be bought and the rate
limiter is failing too. Checkout stopping is consistent with that, not an outlier.

### Accepted risk

The risk this design accepts is **availability, not pricing accuracy** — the opposite trade from
the previous revision, and the reason that one was rejected is recorded above.

During a period when the overrides table is unreadable, checkout and offer acceptance return `503`
for every seller, overridden or not, because the resolver cannot tell which sellers are overridden
without reading the table. No transaction is created at a guessed rate, so there is nothing to
reconcile afterwards.

What makes it observable:

1. **Every resolution is logged**, not only applied overrides: seller id, the rate actually used or
   the reason none could be, which row of the determinacy table produced it, and the calling
   operation (`preview` / `initiate` / `transition`). No other PII. The operation field is what
   keeps the preview's chatter separable from the two paths that move money.
2. **Money-path failures log at `error`; preview fallbacks log at `warn`.** A refused checkout is an
   incident. A preview showing the marketplace rate for a moment is not, and giving both the same
   level would bury the first under the second — the preview resolves several times per checkout as
   the buyer edits the form.
3. **A refused checkout is loud by construction.** It is a `503` the buyer sees, not a line in a log
   someone has to know to query. This is the property the reconciliation plan was trying and failing
   to reproduce.

An operator seeing `COMMISSION_UNRESOLVED` should treat it as a database incident: the poller,
shipping labels and the rate limiter are affected by the same outage, and none of them recover by
being retried at the application layer.

**Explicitly out of scope, and why:** persisting a commission-provenance marker on the transaction
(`protectedData.avCommission`) was considered as reconciliation support. With fail-closed there is
no mispriced transaction to reconcile, so it would carry no information the applied rate does not
already imply. If the posture is ever reversed to availability-first, that marker becomes a
prerequisite rather than an option — seller id plus timestamp is not sufficient correlation.

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
| Code fallback `6000` | `src/config/configDefault.js:25` | Ships with the clamp, in the same commit. Covers environments where the asset is absent or `0`, which the Console value cannot. |
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
| `providerCommission.test.js` — determinacy | one case per row of the [Error handling](#error-handling) table: no row defaults silently; a row is applied; a missing author id returns `source: 'indeterminate', reason: 'no-author'`; a **rejecting** store returns `source: 'indeterminate', reason: 'store-unreadable'` without throwing. The key assertion is the negative one — that "no override" and "could not read" do not take the same path, which means asserting the store rejects rather than resolving `{ found: false }`. Plus: `retries: 1` re-reads once and succeeds if the second read does; `retries: 0` does not |
| `server/services/providerCommissionStore.test.js` (new) | round-trip set/get/clear, upsert replaces rather than duplicates, `CHECK` constraint rejects `-1` and `75.1` at the database level, `getOverride` distinguishes absent from unreadable, and — the history cases — a `set` and a `clear` each append a row with their operator, a clear records `NULL`, and a failed write leaves neither table changed |
| `GET /api/commission/me` | returns the caller's rate, returns `null` when they have none, rejects unauthenticated callers, and — the security-relevant case — accepts no parameter that could target another user |
| `server/api-util/lineItemHelpers.test.js` (extend) | explicit 0% emits fixed-fee only; absent percentage with no minimum still returns `[]` (regression guard for the early-return change); percentage > 0 unchanged; **clamp cases** — fee reduced to the remainder when it would overflow, line item omitted when nothing remains, payout never negative, and no throw at any price down to the minimum |
| Invariant test (new) | `listingMinimumPriceSubUnits x (1 - MAX_PROVIDER_COMMISSION_PERCENTAGE/100) >= fixedFee` for the three **code** constants, so raising the cap or the fee without raising the fallback fails the build. It deliberately does not fetch `transaction-size.json`: a test that reads a mutable hosted asset breaks the build when an operator edits Console, which is noise rather than a finding. The live value is checked by the CLI before each write and by the boot readiness check — see [Where `listingMinimumPrice` comes from](#where-listingminimumprice-comes-from) |
| `configDefault.js` fallback | `listingMinimumPriceSubUnits` is `6000`, pinned so it cannot drift back to the upstream `500` in a merge without the invariant test above failing too |
| `server/api-util/lineItems.test.js` | untouched; passing unchanged is the signal that the resolver stayed out of the line-item core |
| `EarningsEstimator.test.js` (new, none exists today) | fetched rate preferred, falls back to config before the response arrives and if the request fails, clamped fee matches the server's for the same price and rate, payout never rendered negative |
| `server/api-util/commissionEndpoint.js` (new) — the shared orchestration | the three endpoints' common half, extracted so it can be tested once: author id out of `listing.relationships.author`, resolver awaited, `indeterminate` mapped to a refusal or a fallback per the caller's policy. Cases: author id extracted from a real response shape; a missing `relationships` produces `no-author` rather than `undefined`; the resolved commission — not the original — is what reaches the returned config; the money policy returns a refusal where the preview policy returns line items |
| `server/api/*-privileged.test.js` (3 new, thin) | one test each: an indeterminate read yields `503 { code: 'COMMISSION_UNRESOLVED' }` from both money endpoints and a rendered breakdown from the preview. Enough to catch the wiring the resolver's own tests cannot see |
| Manual | a real Test-marketplace checkout with an overridden seller, confirming the OrderBreakdown commission row and the resulting `payoutTotal` |

The previous revision exempted the three privileged endpoints from testing, on the grounds that they
are upstream files and the logic worth testing lives in the pure resolver. That reasoning does not
survive contact with what the endpoints actually do now. A pure resolver test cannot see a missing
`await` — the resolver returning a promise that is spread into a config object produces
`percentage: undefined` and a silently commission-free sale. It cannot see the author id being read
from the wrong path, because it is handed an id. It cannot see an endpoint resolving the override
and then passing the *original* `commission` to `transactionLineItems`, which is the single most
likely way this feature ships as a no-op. And it cannot see a money endpoint that resolves
`indeterminate` and proceeds anyway, which is the entire policy this revision adds.

Extracting `commissionEndpoint.js` is what keeps the cost proportionate: the shared half becomes
AV-owned and unit-testable, each upstream endpoint keeps a two-line call, and the three endpoint
tests only have to assert that the call is present and its refusal honoured. Full SDK-mocking
harnesses for three upstream files were the right thing to refuse; testing nothing was not the only
alternative.

## Out of scope

- Overriding the customer commission.
- Overriding the fixed fee per seller.
- Any admin UI or HTTP endpoint for *setting* the value. `GET /api/commission/me` reads the
  caller's own rate and cannot write or target anyone else.
- Per-listing or per-category commission rates.
