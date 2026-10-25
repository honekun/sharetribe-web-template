# Per-seller provider commission override

**Date:** 2026-08-14 · **Revised 2026-10-23** (implemented on this revision)

The earlier revisions (an AV PostgreSQL table, an operator CLI, a `[0, 75]` range and a `6000`
minimum listing price) are superseded and kept only in Git history. The owner chose operator
convenience over confidentiality: the rate is a **Console user field in `metadata`**, which
operators edit in **Console → Manage → Users**, and which is publicly readable through the API.

## Problem

The provider commission percentage is marketplace-wide (hosted `transactions/commission.json`,
22 %). AV needs to charge specific sellers a negotiated percentage without changing what everyone
else pays.

## Decisions

| Decision                    | Choice                                                                                      | Rationale                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage                     | Console user field `avCommissionPercentage`, scope `metadata`                               | Only operators (Console, Integration API) can write `metadata`. No Sharetribe type is both operator-only-write and private: `privateData` is seller-writable, so a seller could zero their own rate.                              |
| Confidentiality             | Accepted: the rate is readable by anyone who fetches the seller through the API             | Owner decision (2026-10-23). The UI never displays it; the field must keep **Display on profile** off, because `ProfilePage` renders `metadata` user fields that opt in.                                                         |
| What it replaces            | The percentage only; `minimum_amount` is dropped for that seller                             | A negotiated rate must not be overruled by the marketplace minimum on cheap items (hosted minimum is `0` today anyway).                                                                                                          |
| Fixed fee                   | Always charged (`REACT_APP_PROVIDER_COMMISSION_FIXED_FEE`, \$15.00), including at 0 %        | Owner decision. `getProviderCommissionMaybe` already handles an explicit `0` (no percentage line item) and still appends the fixed fee.                                                                                          |
| Accepted range              | `[0, 25]`                                                                                   | Keeps the `2000` (\$20.00) minimum listing price: `2000 × (1 − 0.25) = 1500`, exactly the fixed fee. `MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE` is the single constant; `commissionInvariant.test.js` asserts it.               |
| End date                    | None                                                                                        | Owner decision. An override lasts until an operator clears the field.                                                                                                                                                           |
| Invalid value               | Ignored: the marketplace rate applies, and the server logs a warning                         | Console has no range check for a user field. Failing checkout would stop the seller selling; the estimator applies the identical rule, so the seller and operator see the rate that will be charged.                             |
| Where it is resolved        | Server, in the three line-item endpoints, from the listing author returned by Sharetribe     | Never trusted from the client. `metadata` is part of every user the Marketplace API returns, so no Integration API call is needed.                                                                                              |
| Missing author              | The request fails (`500`) rather than defaulting                                             | Every endpoint includes the author; its absence means the rate is unknown, and a sale created at the wrong rate cannot be found afterwards.                                                                                     |
| Seller-facing estimator     | Reads the same field from `currentUser.attributes.profile.metadata`                          | Same parser as the server (shared CommonJS module), so the estimate cannot diverge from the charge.                                                                                                                              |

## Semantics

The value may be a number (Console "Number" field) or a numeric string (a text field):

| Value                                           | Result                                                    |
| ----------------------------------------------- | --------------------------------------------------------- |
| absent, `null`, `''`                             | marketplace rate (normal path)                            |
| `15`, `12.5`, `'15'`, `' 12.5 '`                 | override at that percentage                               |
| `0`                                             | no percentage line item; the \$15.00 fixed fee is charged |
| `25`                                            | override at 25 (the maximum)                              |
| `-1`, `25.5`, `30`, `'15%'`, `'abc'`, `NaN`, `true` | ignored → marketplace rate, warning logged on the server  |

Worked example, seller at 15 %, item \$500.00: commission \$75.00 + fixed \$15.00 → payout \$410.00.

## Architecture

- `src/config/configAVCommission.js` (CommonJS, shared by client and server, like
  `configAVShipping.js`): `commissionOverrideFieldKey`, `MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE`,
  `parseCommissionOverride(value)`, `getCommissionOverride(user)`,
  `applyCommissionOverride(providerCommission, overridePercentage)`.
- `server/api-util/providerCommission.js`: `findListingAuthor(listing, included)` and
  `resolveProviderCommission(providerCommission, author)` (throws when the author is missing, warns
  on an invalid value).
- Call sites: `transaction-line-items.js` (adds `include: ['author']`), `initiate-privileged.js`
  (already includes `author`), `transition-privileged.js` (already includes `listing.author`). Each
  passes the resolved provider commission to `transactionLineItems`.
- `EarningsEstimator.js` reads `state.user.currentUser` and applies the override to
  `config.earningsEstimate.providerCommissionPercentage`.

## Out of scope

Customer commission, per-seller fixed fee, per-listing or per-category rates, end dates, and any
admin UI beyond the Console field.
