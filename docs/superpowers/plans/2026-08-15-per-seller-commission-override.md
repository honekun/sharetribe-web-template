# Per-Seller Provider Commission Override Implementation Plan

> **Revised 2026-10-23** to the Console-metadata design in
> [the spec](../specs/2026-08-14-per-seller-commission-override-design.md). The earlier plan
> (PostgreSQL table, CLI, 75 % ceiling) is in Git history. The fixed-fee clamp from the earlier
> Task 3 has already shipped (`getProviderCommissionMaybe`).

**Goal:** a seller whose Console `metadata.avCommissionPercentage` holds a valid number in
`[0, 25]` is charged that percentage instead of the marketplace one, plus the \$15.00 fixed fee.

## Global Constraints

- The value is resolved on the server; the client never sends a rate.
- One parser, in `src/config/configAVCommission.js` (CommonJS), used by server and client.
- Upstream files touched minimally (one call per endpoint, one import appended after the file's own
  imports).
- Tests: `yarn test-server` for server code, `yarn test -- --watchAll=false <path>` for client code.

### Task 1: Shared config module

`src/config/configAVCommission.js` + `configAVCommission.test.js`: the Semantics table of the spec,
one assertion per row; `getCommissionOverride` reads `user.attributes.profile.metadata`;
`applyCommissionOverride` returns the hosted object untouched for `null`, otherwise
`{ ...hosted, percentage }` without `minimum_amount`.

### Task 2: Server resolver

`server/api-util/providerCommission.js` + test: `findListingAuthor` finds the author in `included`
by `listing.relationships.author.data.id`; `resolveProviderCommission` throws a `500` error when
the author is missing, warns once per call for an invalid value, otherwise returns the applied
commission.

### Task 3: Endpoints

Wire the resolver into `transaction-line-items.js` (add `include: ['author']`),
`initiate-privileged.js`, `transition-privileged.js`. Endpoint tests mock the SDK and assert the
provider commission passed to `transactionLineItems`.

### Task 4: Earnings estimator

`EarningsEstimator.js` uses the current user's override. New `EarningsEstimator.test.js`: no
override → 22 %; override 15 → 15 %; override 0 → `(0% + $15.00)`; invalid → 22 %.

### Task 5: Invariant

`commissionInvariant.test.js` also asserts the minimum price leaves room for the fixed fee at
`MAX_PROVIDER_COMMISSION_OVERRIDE_PERCENTAGE`.

### Task 6: Documentation and Console prerequisites

Operator guide §14.6 (create the field once per environment, set/clear, verification), CLAUDE.md,
`docs/pending/README.md`, `docs/pending/live-launch.md`, rebuilt shareable HTML.

### Task 7: Full verification

`CI=true yarn test-ci`, `yarn format-ci`, `yarn av-translation-check`.
