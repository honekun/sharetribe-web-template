# Per-Seller Provider Commission Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let AV charge specific sellers a negotiated provider commission percentage, stored in an AV-owned database table, falling back to the marketplace-wide rate when no override exists.

**Architecture:** A per-seller percentage lives in a new PostgreSQL table keyed by Sharetribe user ID — not on the Sharetribe user record, because every user field there is either seller-writable or publicly readable. Three server endpoints that build line items resolve the rate before calling `transactionLineItems`, so `lineItems.js` is never touched. A separate change to `getProviderCommissionMaybe` makes an explicit 0% keep the fixed fee and replaces a throw with a clamp, fixing a pre-existing defect where cheap listings break at payment time.

**Tech Stack:** Node (CommonJS server, ESM client via webpack), Express, `pg`, Jest, React + Final Form, Sharetribe Marketplace/Integration SDKs.

**Spec:** `docs/superpowers/specs/2026-08-14-per-seller-commission-override-design.md`

## Global Constraints

- **`MAX_PROVIDER_COMMISSION_PERCENTAGE = 75`.** Not 100. At 100% the fixed fee can never fit, breaking every checkout by that seller. Defined once, imported everywhere, asserted by the `CHECK` constraint.
- **Fixed fee is `REACT_APP_PROVIDER_COMMISSION_FIXED_FEE=1500`** (subunits, $15.00 MXN). Never overridden per seller.
- **Invariant:** `listingMinimumPrice × (1 - MAX_PROVIDER_COMMISSION_PERCENTAGE/100) >= fixedFee`. With 75 and 1500 this requires a minimum listing price of `6000`.
- **Never import `server/*` from client code.** The parser is deliberately duplicated (server CJS + client ESM); both copies are tested against the same matrix.
- **AV translations go in `src/translations/{en,es}_av.json` only** — never `en.json`/`es.json`. Run `yarn av-translation-check`.
- **Server files start with `'use strict';`** and use CommonJS `require`/`module.exports`.
- **AV database tables use the `av_` prefix** (matching `av_shipping_label_attempts`, `av_eship_tracking_notifications`).
- **Falling back is never silent when indeterminate.** "No override exists" (conclusive) logs at `info`; "could not determine" (missing author id, database error) logs at `error`. These must never collapse into the same code path.
- Test commands: `yarn test-server` (server), `yarn test -- --watchAll=false` (client).
- Node `>=18.20.1 <23.2.0`, Yarn.

---

### Task 1: Migration and commission store

Creates the table and the only module that talks to it.

**Files:**
- Create: `server/migrations/010_provider_commission_overrides.sql`
- Create: `server/services/providerCommissionStore.js`
- Test: `server/services/providerCommissionStore.test.js`

**Interfaces:**
- Consumes: `getPostgresPool()` from `server/services/postgres.js`
- Produces:
  - `ProviderCommissionStore` class (constructor takes a `pool`)
  - `createProviderCommissionStore(pool = getPostgresPool())`
  - `getOverride(userId)` → `Promise<{ found: true, percentage: number } | { found: false }>`; **rejects** on query failure, never resolves `{ found: false }` for an error
  - `setOverride(userId, percentage, updatedBy)` → `Promise<{ user_id, percentage, updated_at, updated_by }>`
  - `clearOverride(userId)` → `Promise<boolean>` (true if a row was deleted)

- [ ] **Step 1: Write the migration**

Create `server/migrations/010_provider_commission_overrides.sql`. The runner (`scripts/migrate-notification-db.js`) auto-discovers `.sql` files by name order, so no registration is needed.

```sql
CREATE TABLE IF NOT EXISTS av_provider_commission_overrides (
  user_id     TEXT PRIMARY KEY,
  percentage  NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 75),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

COMMENT ON TABLE av_provider_commission_overrides IS
  'Per-seller provider commission percentage; an absent row means the marketplace-wide rate applies';
```

Note: `user_id` is `TEXT` per the spec (it holds a Sharetribe user UUID) rather than `UUID`, so a malformed id returns "no row" instead of raising a type error. The `75` in the `CHECK` must stay in sync with `MAX_PROVIDER_COMMISSION_PERCENTAGE` in Task 2.

- [ ] **Step 2: Write the failing store test**

Create `server/services/providerCommissionStore.test.js`. The pool is mocked exactly as in `eshipTrackingStore.test.js` — these are unit tests, not database tests.

```js
'use strict';

const { ProviderCommissionStore } = require('./providerCommissionStore');

describe('ProviderCommissionStore', () => {
  test('getOverride returns the percentage as a number when a row exists', async () => {
    // pg returns NUMERIC columns as strings; the store must coerce.
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{ percentage: '5.50' }] }) };
    const store = new ProviderCommissionStore(pool);

    const result = await store.getOverride('user-1');

    expect(result).toEqual({ found: true, percentage: 5.5 });
    expect(pool.query.mock.calls[0][1]).toEqual(['user-1']);
  });

  test('getOverride reports a conclusive absence when there is no row', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const store = new ProviderCommissionStore(pool);

    await expect(store.getOverride('user-1')).resolves.toEqual({ found: false });
  });

  test('getOverride rejects on query failure instead of reporting absence', async () => {
    // This is the load-bearing assertion: "no override" and "could not read"
    // must not collapse into the same value.
    const pool = { query: jest.fn().mockRejectedValue(new Error('connection terminated')) };
    const store = new ProviderCommissionStore(pool);

    await expect(store.getOverride('user-1')).rejects.toThrow('connection terminated');
  });

  test('setOverride upserts rather than duplicating, and records the operator', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            user_id: 'user-1',
            percentage: '5.00',
            updated_at: '2026-08-15T00:00:00.000Z',
            updated_by: 'alex',
          },
        ],
      }),
    };
    const store = new ProviderCommissionStore(pool);

    const result = await store.setOverride('user-1', 5, 'alex');

    expect(result.percentage).toBe(5);
    expect(pool.query.mock.calls[0][0]).toContain('ON CONFLICT (user_id) DO UPDATE');
    expect(pool.query.mock.calls[0][1]).toEqual(['user-1', 5, 'alex']);
  });

  test('clearOverride reports whether a row was actually removed', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    const store = new ProviderCommissionStore(pool);
    await expect(store.clearOverride('user-1')).resolves.toBe(true);

    const emptyPool = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
    const emptyStore = new ProviderCommissionStore(emptyPool);
    await expect(emptyStore.clearOverride('user-1')).resolves.toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `yarn test-server -- --testPathPattern=providerCommissionStore`
Expected: FAIL — `Cannot find module './providerCommissionStore'`

- [ ] **Step 4: Implement the store**

Create `server/services/providerCommissionStore.js`:

```js
'use strict';

const { getPostgresPool } = require('./postgres');

const TABLE = 'av_provider_commission_overrides';

class ProviderCommissionStore {
  constructor(pool) {
    this.pool = pool;
  }

  // Returns a tagged result so that "this seller has no override" and "I could
  // not read the table" cannot collapse into the same value. A failed query
  // rejects; it never resolves to { found: false }.
  async getOverride(userId) {
    const result = await this.pool.query(
      `SELECT percentage FROM ${TABLE} WHERE user_id = $1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) return { found: false };
    // pg returns NUMERIC as a string.
    return { found: true, percentage: Number(row.percentage) };
  }

  async setOverride(userId, percentage, updatedBy = null) {
    const result = await this.pool.query(
      `INSERT INTO ${TABLE} (user_id, percentage, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET percentage = EXCLUDED.percentage,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
       RETURNING user_id, percentage, updated_at, updated_by`,
      [userId, percentage, updatedBy]
    );
    const row = result.rows[0];
    return { ...row, percentage: Number(row.percentage) };
  }

  async clearOverride(userId) {
    const result = await this.pool.query(`DELETE FROM ${TABLE} WHERE user_id = $1`, [userId]);
    return result.rowCount > 0;
  }
}

function createProviderCommissionStore(pool = getPostgresPool()) {
  return new ProviderCommissionStore(pool);
}

module.exports = { ProviderCommissionStore, createProviderCommissionStore };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test-server -- --testPathPattern=providerCommissionStore`
Expected: PASS (5 tests)

- [ ] **Step 6: Apply the migration locally and confirm the constraint**

Run: `yarn db:setup`

Then verify the `CHECK` rejects an out-of-range value:

```bash
docker compose exec -T postgres psql -U archivo_vintach -d archivo_vintach -c \
  "INSERT INTO av_provider_commission_overrides (user_id, percentage) VALUES ('probe', 75.1);"
```

Expected: `ERROR: new row for relation "av_provider_commission_overrides" violates check constraint`

- [ ] **Step 7: Commit**

```bash
git add server/migrations/010_provider_commission_overrides.sql \
        server/services/providerCommissionStore.js \
        server/services/providerCommissionStore.test.js
git commit -m "feat(commission): add per-seller commission override table and store"
```

---

### Task 2: Pure resolver module

The decision logic, with no I/O of its own. This is where the determinacy rules live.

**Files:**
- Create: `server/api-util/providerCommission.js`
- Test: `server/api-util/providerCommission.test.js`

**Interfaces:**
- Consumes: `getOverride(userId)` from Task 1 (injected via `deps.store`, never imported directly, so the module stays pure and testable)
- Produces:
  - `MAX_PROVIDER_COMMISSION_PERCENTAGE` = `75`
  - `parseCommissionOverride(raw)` → `number | null`
  - `applyOverride(commission, percentage)` → commission object with `minimum_amount` removed
  - `resolveProviderCommission(commission, sellerUserId, deps)` → `Promise<{ commission, source }>` where `source` is `'override' | 'default' | 'fallback'`
  - `impliedMinimumPrice(percentage, fixedFee)` → `number` (used by the CLI in Task 7)

- [ ] **Step 1: Write the failing test**

Create `server/api-util/providerCommission.test.js`:

```js
'use strict';

const {
  MAX_PROVIDER_COMMISSION_PERCENTAGE,
  applyOverride,
  impliedMinimumPrice,
  parseCommissionOverride,
  resolveProviderCommission,
} = require('./providerCommission');

const MARKETPLACE = { percentage: 10, minimum_amount: 200 };

describe('parseCommissionOverride', () => {
  test.each([
    ['5', 5],
    ['5.5', 5.5],
    [5, 5],
    [5.5, 5.5],
    [0, 0],
    ['0', 0],
    [75, 75],
  ])('accepts %p as %p', (input, expected) => {
    expect(parseCommissionOverride(input)).toBe(expected);
  });

  test.each([
    [undefined],
    [null],
    [''],
    ['   '],
    [-1],
    [-0.1],
    [75.1],
    [100],
    [101],
    ['12%'],
    ['abc'],
    [NaN],
    [Infinity],
    [true],
    [{}],
    [[]],
  ])('rejects %p', input => {
    expect(parseCommissionOverride(input)).toBeNull();
  });

  test('the ceiling is exactly the exported constant', () => {
    expect(MAX_PROVIDER_COMMISSION_PERCENTAGE).toBe(75);
    expect(parseCommissionOverride(MAX_PROVIDER_COMMISSION_PERCENTAGE)).toBe(75);
    expect(parseCommissionOverride(MAX_PROVIDER_COMMISSION_PERCENTAGE + 0.1)).toBeNull();
  });
});

describe('applyOverride', () => {
  test('replaces the percentage and drops the minimum floor entirely', () => {
    const result = applyOverride(MARKETPLACE, 5);

    expect(result.percentage).toBe(5);
    expect('minimum_amount' in result).toBe(false);
  });

  test('does not mutate the marketplace commission object', () => {
    applyOverride(MARKETPLACE, 5);
    expect(MARKETPLACE).toEqual({ percentage: 10, minimum_amount: 200 });
  });
});

describe('impliedMinimumPrice', () => {
  test('is the price at which the fixed fee exactly fits', () => {
    expect(impliedMinimumPrice(0, 1500)).toBe(1500);
    expect(impliedMinimumPrice(75, 1500)).toBe(6000);
  });
});

describe('resolveProviderCommission determinacy', () => {
  const logger = () => ({ info: jest.fn(), error: jest.fn() });

  test('applies the override when the store finds a row', async () => {
    const store = { getOverride: jest.fn().mockResolvedValue({ found: true, percentage: 5 }) };
    const log = logger();

    const result = await resolveProviderCommission(MARKETPLACE, 'user-1', { store, logger: log });

    expect(result.source).toBe('override');
    expect(result.commission.percentage).toBe(5);
    expect('minimum_amount' in result.commission).toBe(false);
    expect(log.error).not.toHaveBeenCalled();
  });

  test('uses the marketplace rate silently when absence is conclusive', async () => {
    const store = { getOverride: jest.fn().mockResolvedValue({ found: false }) };
    const log = logger();

    const result = await resolveProviderCommission(MARKETPLACE, 'user-1', { store, logger: log });

    expect(result.source).toBe('default');
    expect(result.commission).toEqual(MARKETPLACE);
    // A conclusive absence is the normal path: informational, not an error.
    expect(log.error).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalled();
  });

  test('falls back and logs at error level when the store rejects', async () => {
    // The key negative assertion: an unreadable table must NOT take the same
    // path as a conclusive absence, even though both end at the default rate.
    const store = { getOverride: jest.fn().mockRejectedValue(new Error('db down')) };
    const log = logger();

    const result = await resolveProviderCommission(MARKETPLACE, 'user-1', { store, logger: log });

    expect(result.source).toBe('fallback');
    expect(result.commission).toEqual(MARKETPLACE);
    expect(log.error).toHaveBeenCalled();
  });

  test('falls back and logs at error level when the seller cannot be identified', async () => {
    const store = { getOverride: jest.fn() };
    const log = logger();

    const result = await resolveProviderCommission(MARKETPLACE, null, { store, logger: log });

    expect(result.source).toBe('fallback');
    expect(store.getOverride).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalled();
  });

  test('the fallback log names the seller so mispriced sales can be reconciled', async () => {
    const store = { getOverride: jest.fn().mockRejectedValue(new Error('db down')) };
    const log = logger();

    await resolveProviderCommission(MARKETPLACE, 'user-42', { store, logger: log });

    expect(String(log.error.mock.calls[0][0])).toContain('user-42');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test-server -- --testPathPattern=api-util/providerCommission`
Expected: FAIL — `Cannot find module './providerCommission'`

- [ ] **Step 3: Implement the resolver**

Create `server/api-util/providerCommission.js`:

```js
'use strict';

// Per-seller provider commission resolution.
//
// The percentage lives in an AV-owned table (server/services/providerCommissionStore.js)
// rather than on the Sharetribe user record, because `publicData`/`privateData` are
// seller-writable and `metadata` is publicly readable — a negotiated rate is
// confidential and none of those three protect it.
//
// NOTE: parseCommissionOverride is duplicated on the client in
// src/util/avCommission.js because client code may never import from server/.
// Both copies are tested against the same matrix; keep them in step.

// 100% is not a valid rate: the percentage alone would consume the whole order,
// leaving nothing for the AV fixed fee, so every checkout by that seller would
// fail. 75 is the highest rate that clears the fee at the 6000 minimum price.
const MAX_PROVIDER_COMMISSION_PERCENTAGE = 75;

const parseCommissionOverride = raw => {
  const isNumber = typeof raw === 'number';
  const isString = typeof raw === 'string';
  if (!isNumber && !isString) return null;

  const trimmed = isString ? raw.trim() : raw;
  if (trimmed === '') return null;

  const parsed = isNumber ? raw : Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > MAX_PROVIDER_COMMISSION_PERCENTAGE) return null;

  return parsed;
};

// The order total at which the fixed fee exactly fits alongside the percentage.
const impliedMinimumPrice = (percentage, fixedFee) =>
  Math.ceil(fixedFee / (1 - percentage / 100));

// An override replaces the marketplace percentage AND clears the minimum floor,
// so a negotiated low rate is not silently overruled by it on cheap items.
const applyOverride = (commission, percentage) => {
  const { minimum_amount, ...rest } = commission || {};
  return { ...rest, percentage };
};

// Resolves the commission for one seller.
//
// Defaulting to the marketplace rate is only safe when the ABSENCE of an
// override is established. An unknown rate mischarges in whichever direction
// the seller was negotiated — overrides run to 75% against a 10% marketplace
// rate, so a fallback can undercharge the platform just as easily as it can
// overcharge a discounted seller.
const resolveProviderCommission = async (commission, sellerUserId, deps = {}) => {
  const { store, logger = console } = deps;

  if (!sellerUserId) {
    logger.error(
      '[providerCommission] Indeterminate: no seller id on the listing; falling back to the marketplace rate. Transactions in this window may be mispriced.'
    );
    return { commission, source: 'fallback' };
  }

  let result;
  try {
    result = await store.getOverride(sellerUserId);
  } catch (e) {
    logger.error(
      `[providerCommission] Indeterminate: override lookup failed for seller ${sellerUserId}; falling back to the marketplace rate. Transactions in this window may be mispriced. Cause: ${e.message}`
    );
    return { commission, source: 'fallback' };
  }

  if (!result.found) {
    logger.info(
      `[providerCommission] seller=${sellerUserId} rate=${commission?.percentage} source=default`
    );
    return { commission, source: 'default' };
  }

  logger.info(
    `[providerCommission] seller=${sellerUserId} rate=${result.percentage} source=override`
  );
  return { commission: applyOverride(commission, result.percentage), source: 'override' };
};

module.exports = {
  MAX_PROVIDER_COMMISSION_PERCENTAGE,
  applyOverride,
  impliedMinimumPrice,
  parseCommissionOverride,
  resolveProviderCommission,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test-server -- --testPathPattern=api-util/providerCommission`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/api-util/providerCommission.js server/api-util/providerCommission.test.js
git commit -m "feat(commission): add per-seller commission resolver with determinacy rules"
```

---

### Task 3: Fix `getProviderCommissionMaybe` — explicit 0% and fee clamping

Two changes to one function. Both are marketplace-wide, not override-specific: the clamp fixes a pre-existing defect where listings priced under `fixedFee / (1 - pct/100)` fail at payment time on today's ordinary 10% rate.

**Files:**
- Modify: `server/api-util/lineItemHelpers.js:351-419` (`getProviderCommissionMaybe` only)
- Test: `server/api-util/lineItemHelpers.test.js` (extend)

**Interfaces:**
- Consumes: nothing from earlier tasks (independent — can be done in parallel with Tasks 1–2)
- Produces: no new exports. `getProviderCommissionMaybe(providerCommission, order, currency)` keeps its signature; only its behaviour at 0% and at overflow changes.

- [ ] **Step 1: Write the failing tests**

Append to `server/api-util/lineItemHelpers.test.js`. Match the existing file's import style and `Money` construction.

```js
describe('getProviderCommissionMaybe — explicit zero percentage', () => {
  const order = {
    code: 'line-item/item',
    unitPrice: new Money(100000, 'MXN'),
    quantity: 1,
    includeFor: ['customer', 'provider'],
  };

  test('an explicit 0% still charges the fixed fee', () => {
    const result = getProviderCommissionMaybe({ percentage: 0 }, order, 'MXN');

    // No percentage line item (a -0% row must never be sent to the API),
    // but the fixed fee survives.
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('line-item/provider-commission-fixed');
    expect(result[0].unitPrice.amount).toBe(1500);
  });

  test('an ABSENT percentage with no minimum still returns nothing', () => {
    // Regression guard: making the early return unconditional would start
    // charging $15 on a marketplace with no commission asset configured.
    expect(getProviderCommissionMaybe({}, order, 'MXN')).toEqual([]);
    expect(getProviderCommissionMaybe(undefined, order, 'MXN')).toEqual([]);
  });

  test('a normal percentage is unchanged', () => {
    const result = getProviderCommissionMaybe({ percentage: 10 }, order, 'MXN');

    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('line-item/provider-commission');
    expect(result[0].percentage).toBe(-10);
    expect(result[1].code).toBe('line-item/provider-commission-fixed');
  });
});

describe('getProviderCommissionMaybe — fixed fee clamping', () => {
  const orderAt = amount => ({
    code: 'line-item/item',
    unitPrice: new Money(amount, 'MXN'),
    quantity: 1,
    includeFor: ['customer', 'provider'],
  });

  test('clamps the fixed fee to what remains instead of throwing', () => {
    // 2000 order at 10% = 200 commission, leaving 1800 — the full 1500 fits.
    // 1600 order at 10% = 160 commission, leaving 1440 — the fee must clamp.
    const result = getProviderCommissionMaybe({ percentage: 10 }, orderAt(1600), 'MXN');

    const fixed = result.find(li => li.code === 'line-item/provider-commission-fixed');
    expect(fixed.unitPrice.amount).toBe(1440);
  });

  test('omits the fixed-fee line item entirely when nothing remains', () => {
    // At 100% of a 1000 order the percentage consumes everything.
    const result = getProviderCommissionMaybe({ percentage: 100 }, orderAt(1000), 'MXN');

    expect(result.find(li => li.code === 'line-item/provider-commission-fixed')).toBeUndefined();
  });

  test('never throws at any price down to the minimum listing price', () => {
    [500, 1000, 1500, 1600, 6000].forEach(amount => {
      expect(() => getProviderCommissionMaybe({ percentage: 10 }, orderAt(amount), 'MXN')).not.toThrow();
    });
  });

  test('the payout never goes negative', () => {
    const result = getProviderCommissionMaybe({ percentage: 75 }, orderAt(1000), 'MXN');

    const percentageAmount = 750;
    const fixed = result.find(li => li.code === 'line-item/provider-commission-fixed');
    const fixedAmount = fixed ? fixed.unitPrice.amount : 0;

    expect(percentageAmount + fixedAmount).toBeLessThanOrEqual(1000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test-server -- --testPathPattern=lineItemHelpers`
Expected: FAIL — the 0% cases return `[]`, and the clamp cases throw `Total provider commission (percentage + fixed fee) exceeds the order total`

- [ ] **Step 3: Apply the explicit-zero change**

In `server/api-util/lineItemHelpers.js`, replace the early return at line 356:

```js
  // A percentage explicitly set to 0 is a real configuration, not an absent one:
  // that seller pays no percentage but still owes the AV fixed fee. Keeping this
  // conditional on an EXPLICIT zero matters — an unconditional change would make
  // a marketplace with no commission asset start charging the fixed fee.
  const hasExplicitZeroPercentage = providerCommission?.percentage === 0;

  if (!hasMinimumCommission && !hasCommissionPercentage && !hasExplicitZeroPercentage) {
    return [];
  }
```

Then make the percentage line item conditional, so a `-0%` row is never emitted. Replace the `const lineItems = useMinimumCommission ? [...] : [...]` assignment:

```js
  const lineItems = useMinimumCommission
    ? [
        {
          code: 'line-item/provider-commission',
          unitPrice: new Money(providerCommission?.minimum_amount, currency),
          quantity: getNegation(1),
          includeFor: ['provider'],
        },
      ]
    : hasCommissionPercentage
    ? [
        {
          code: 'line-item/provider-commission',
          unitPrice: totalMoneyIn,
          percentage: getNegation(providerCommission.percentage),
          includeFor: ['provider'],
        },
      ]
    : [];
```

- [ ] **Step 4: Apply the clamp change**

Replace the whole `if (PROVIDER_COMMISSION_FIXED_FEE > 0) { ... }` block:

```js
  // Append fixed fee line item if configured (additive, not max-based)
  if (PROVIDER_COMMISSION_FIXED_FEE > 0) {
    const percentageAmount = useMinimumCommission
      ? providerCommission.minimum_amount
      : estimatedCommissionFromPercentage;

    // Clamp rather than throw. A pricing misconfiguration must not turn into a
    // failed checkout for the buyer; the payout floors at zero instead. This
    // also fixes the pre-existing case where any listing priced below
    // fixedFee / (1 - pct/100) broke at payment time on the ordinary rate.
    const remaining = totalMoneyIn.amount - percentageAmount;
    const fixedFeeToCharge = Math.min(PROVIDER_COMMISSION_FIXED_FEE, Math.max(0, remaining));

    if (fixedFeeToCharge < PROVIDER_COMMISSION_FIXED_FEE) {
      // The platform earned less than intended; someone should see why.
      console.error(
        `[lineItems] Provider fixed fee clamped: order=${totalMoneyIn.amount} percentage=${providerCommission?.percentage} percentageAmount=${percentageAmount} fee=${PROVIDER_COMMISSION_FIXED_FEE} charged=${fixedFeeToCharge}`
      );
    }

    if (fixedFeeToCharge > 0) {
      lineItems.push({
        code: 'line-item/provider-commission-fixed',
        unitPrice: new Money(fixedFeeToCharge, currency),
        quantity: getNegation(1),
        includeFor: ['provider'],
      });
    }
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test-server -- --testPathPattern=lineItemHelpers`
Expected: PASS

- [ ] **Step 6: Verify the line-item core is untouched**

Run: `yarn test-server -- --testPathPattern=lineItems`
Expected: PASS with no edits to `lineItems.js` — this passing unchanged is the signal that the change stayed inside `getProviderCommissionMaybe`.

- [ ] **Step 7: Commit**

```bash
git add server/api-util/lineItemHelpers.js server/api-util/lineItemHelpers.test.js
git commit -m "fix(commission): charge fixed fee at 0% and clamp it instead of throwing"
```

---

### Task 4: Raise the minimum listing price and assert the invariant

The clamp handles overflow at checkout; this prevents most of it from arising. The test fails the build if the ceiling, the fee, or the minimum price ever move independently.

**Files:**
- Modify: `src/config/configDefault.js:33`
- Create: `src/config/commissionInvariant.test.js`
- Create: `src/util/avCommission.js`
- Test: `src/util/avCommission.test.js`

**Interfaces:**
- Consumes: `MAX_PROVIDER_COMMISSION_PERCENTAGE` conceptually from Task 2 (the value `75`, re-declared client-side — client code may not import from `server/`)
- Produces:
  - `src/util/avCommission.js` exporting `MAX_PROVIDER_COMMISSION_PERCENTAGE`, `parseCommissionOverride`, `clampFixedFee(percentageAmount, fixedFee, orderTotal)` → `number`
  - `clampFixedFee` is consumed by `EarningsEstimator` in Task 6

- [ ] **Step 1: Write the failing client parser + clamp test**

Create `src/util/avCommission.test.js`. This is the same matrix as the server test in Task 2 — that is the point, so the two copies cannot drift.

```js
import {
  MAX_PROVIDER_COMMISSION_PERCENTAGE,
  clampFixedFee,
  parseCommissionOverride,
} from './avCommission';

describe('parseCommissionOverride (client copy)', () => {
  test.each([
    ['5', 5],
    ['5.5', 5.5],
    [5, 5],
    [0, 0],
    [75, 75],
  ])('accepts %p as %p', (input, expected) => {
    expect(parseCommissionOverride(input)).toBe(expected);
  });

  test.each([
    [undefined],
    [null],
    [''],
    ['   '],
    [-1],
    [75.1],
    [100],
    ['12%'],
    ['abc'],
    [NaN],
    [true],
    [{}],
  ])('rejects %p', input => {
    expect(parseCommissionOverride(input)).toBeNull();
  });

  test('ceiling matches the server constant', () => {
    expect(MAX_PROVIDER_COMMISSION_PERCENTAGE).toBe(75);
  });
});

describe('clampFixedFee', () => {
  test('returns the full fee when it fits', () => {
    expect(clampFixedFee(200, 1500, 100000)).toBe(1500);
  });

  test('reduces the fee to what remains', () => {
    expect(clampFixedFee(160, 1500, 1600)).toBe(1440);
  });

  test('returns zero when nothing remains', () => {
    expect(clampFixedFee(1000, 1500, 1000)).toBe(0);
  });

  test('never returns a negative fee', () => {
    expect(clampFixedFee(2000, 1500, 1000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn test -- --watchAll=false --testPathPattern=avCommission`
Expected: FAIL — `Cannot find module './avCommission'`

- [ ] **Step 3: Implement the client module**

Create `src/util/avCommission.js`:

```js
// Client-side copy of the commission parser and fee clamp.
//
// NOTE: deliberately duplicated from server/api-util/providerCommission.js and
// server/api-util/lineItemHelpers.js. Client code may never import from server/
// (CommonJS, and it would pull server secrets into the browser bundle). Both
// copies are tested against the same matrix so divergence fails a test rather
// than silently mispricing a listing. Keep them in step.

export const MAX_PROVIDER_COMMISSION_PERCENTAGE = 75;

export const parseCommissionOverride = raw => {
  const isNumber = typeof raw === 'number';
  const isString = typeof raw === 'string';
  if (!isNumber && !isString) return null;

  const trimmed = isString ? raw.trim() : raw;
  if (trimmed === '') return null;

  const parsed = isNumber ? raw : Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > MAX_PROVIDER_COMMISSION_PERCENTAGE) return null;

  return parsed;
};

// Mirrors the server clamp in getProviderCommissionMaybe: the fixed fee is
// reduced to whatever the order has left after the percentage, so the estimator
// shows the fee that will actually be charged rather than one the checkout
// would silently reduce.
export const clampFixedFee = (percentageAmount, fixedFee, orderTotal) =>
  Math.min(fixedFee, Math.max(0, orderTotal - percentageAmount));
```

- [ ] **Step 4: Write the failing invariant test**

Create `src/config/commissionInvariant.test.js`:

```js
// configDefault.js uses `export default defaultConfig` (line 154), not a named export.
import defaultConfig from './configDefault';
import { MAX_PROVIDER_COMMISSION_PERCENTAGE } from '../util/avCommission';

// The AV fixed fee is invisible to Sharetribe, so nothing on their side stops a
// listing from being priced below what the fee needs. This test is the guard:
// raising the ceiling or the fee without revisiting the minimum listing price
// fails the build instead of production.
describe('commission invariant', () => {
  test('the minimum listing price leaves room for the fixed fee at the maximum rate', () => {
    const fixedFee = parseInt(process.env.REACT_APP_PROVIDER_COMMISSION_FIXED_FEE, 10) || 0;
    const minPrice = defaultConfig.listingMinimumPriceSubUnits;
    const headroom = minPrice * (1 - MAX_PROVIDER_COMMISSION_PERCENTAGE / 100);

    expect(headroom).toBeGreaterThanOrEqual(fixedFee);
  });
});
```

The default export is confirmed at `src/config/configDefault.js:154`. Do not add a new named export for this.

- [ ] **Step 5: Run it to verify it fails**

Run: `yarn test -- --watchAll=false --testPathPattern=commissionInvariant`
Expected: FAIL — `500 × 0.25 = 125` is less than `1500`

- [ ] **Step 6: Raise the code-side minimum**

In `src/config/configDefault.js:33`, change the fallback:

```js
  // AV: must satisfy listingMinimumPrice x (1 - MAX_PROVIDER_COMMISSION_PERCENTAGE/100) >= the
  // provider fixed fee, or a sale cannot cover the fee. See src/config/commissionInvariant.test.js.
  listingMinimumPriceSubUnits: 6000,
```

The Console `transaction-size.json` asset must be raised to `6000` as well — it overrides this value at runtime. That is a deployment step, recorded in Task 8.

- [ ] **Step 7: Run both tests to verify they pass**

Run: `yarn test -- --watchAll=false --testPathPattern="avCommission|commissionInvariant"`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/util/avCommission.js src/util/avCommission.test.js \
        src/config/commissionInvariant.test.js src/config/configDefault.js
git commit -m "feat(commission): add client parser/clamp and enforce the fee invariant"
```

---

### Task 5: Resolve the override in the three line-item endpoints

Where the feature actually takes effect on money.

**Files:**
- Modify: `server/api/transaction-line-items.js`
- Modify: `server/api/initiate-privileged.js:76`
- Modify: `server/api/transition-privileged.js:153`

**Interfaces:**
- Consumes: `resolveProviderCommission` (Task 2), `createProviderCommissionStore` (Task 1)
- Produces: no new exports. All three endpoints keep their existing request/response contracts.

- [ ] **Step 1: Wire `transaction-line-items.js`**

Only the author's **id** is needed, and it arrives in the listing's `relationships` on every one of these responses — so no `include: ['author']` and no change to what any endpoint requests from Sharetribe.

Add the imports:

```js
const { resolveProviderCommission } = require('../api-util/providerCommission');
const { createProviderCommissionStore } = require('../services/providerCommissionStore');
```

Then, inside the `.then(async ([showListingResponse, fetchAssetsResponse]) => {` block, after `providerCommission` is destructured, replace the `transactionLineItems` call:

```js
      const sellerUserId = listing?.relationships?.author?.data?.id?.uuid || null;
      const resolved = await resolveProviderCommission(providerCommission, sellerUserId, {
        store: createProviderCommissionStore(),
      });

      const lineItems = await transactionLineItems(
        listing,
        orderData,
        resolved.commission,
        customerCommission
      );
```

- [ ] **Step 2: Wire `initiate-privileged.js`**

Add the same two imports. This endpoint already includes the author, so the id is available either denormalized or as a relationship — accept both, the way `shippingQuoteService.resolveOrigin` does:

```js
      const sellerUserId =
        listing?.author?.id?.uuid || listing?.relationships?.author?.data?.id?.uuid || null;
      const resolved = await resolveProviderCommission(providerCommission, sellerUserId, {
        store: createProviderCommissionStore(),
      });

      lineItems = await transactionLineItems(
        listing,
        fullOrderData,
        resolved.commission,
        customerCommission,
        { resolvedShippingRate: resolvedRate }
      );
```

- [ ] **Step 3: Wire `transition-privileged.js`**

Add the same two imports. Here `listing` comes from `getListingRelationShip(...)`, which returns the included resource, so use the same both-shapes lookup:

```js
      const sellerUserId =
        listing?.author?.id?.uuid || listing?.relationships?.author?.data?.id?.uuid || null;
      const resolved = await resolveProviderCommission(providerCommission, sellerUserId, {
        store: createProviderCommissionStore(),
      });

      lineItems = await transactionLineItems(
        listing,
        fullOrderData,
        resolved.commission,
        customerCommission,
        { resolvedShippingRate: resolvedRate }
      );
```

- [ ] **Step 4: Verify nothing regressed**

Run: `yarn test-server`
Expected: PASS. The three endpoints have no test files (only AV-owned endpoints do) and this plan does not add them — the logic worth testing lives in the pure resolver from Task 2. What this run proves is that the shared helpers still behave.

- [ ] **Step 5: Manually verify the preview endpoint end to end**

Start the app (`yarn run dev`), set an override for a test seller once Task 7 exists — or insert a row directly for now:

```bash
docker compose exec -T postgres psql -U archivo_vintach -d archivo_vintach -c \
  "INSERT INTO av_provider_commission_overrides (user_id, percentage, updated_by) VALUES ('<seller-uuid>', 5, 'manual-test');"
```

Open a listing by that seller and start checkout. Expected: the OrderBreakdown provider commission reflects 5%, and the server log shows `[providerCommission] seller=<uuid> rate=5 source=override`.

- [ ] **Step 6: Commit**

```bash
git add server/api/transaction-line-items.js server/api/initiate-privileged.js server/api/transition-privileged.js
git commit -m "feat(commission): resolve per-seller commission in the line-item endpoints"
```

---

### Task 6: `GET /api/commission/me` and the EarningsEstimator

The seller prices against the estimator's number, so it has to be their real rate and their real fee.

**Files:**
- Create: `server/api/commission/index.js`
- Test: `server/api/commission/index.test.js`
- Modify: `server/customApiRoutes.js`
- Modify: `src/containers/EditListingPage/EditListingWizard/EditListingPricingPanel/EarningsEstimator.js`
- Test: `src/containers/EditListingPage/EditListingWizard/EditListingPricingPanel/EarningsEstimator.test.js`

**Interfaces:**
- Consumes: `createProviderCommissionStore` (Task 1), `clampFixedFee` (Task 4), `getSdk` from `server/api-util/sdk`
- Produces: `GET /api/commission/me` → `{ providerCommissionPercentage: number | null }`

- [ ] **Step 1: Write the failing endpoint test**

Create `server/api/commission/index.test.js`, following the mock-`res` pattern in `server/api/topbar-local-design-users.test.js`:

```js
'use strict';

const mockCurrentUserShow = jest.fn();
const mockGetOverride = jest.fn();

jest.mock('../../api-util/sdk', () => ({
  getSdk: () => ({ currentUser: { show: (...args) => mockCurrentUserShow(...args) } }),
}));
jest.mock('../../services/providerCommissionStore', () => ({
  createProviderCommissionStore: () => ({ getOverride: (...args) => mockGetOverride(...args) }),
}));

const { handleGetMyCommission } = require('./index');

const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = jest.fn(code => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn(body => {
    res.body = body;
    return res;
  });
  return res;
};

describe('GET /api/commission/me', () => {
  beforeEach(() => {
    mockCurrentUserShow.mockReset();
    mockGetOverride.mockReset();
  });

  test('returns the caller own rate', async () => {
    mockCurrentUserShow.mockResolvedValue({ data: { data: { id: { uuid: 'user-1' } } } });
    mockGetOverride.mockResolvedValue({ found: true, percentage: 5 });
    const res = mockRes();

    await handleGetMyCommission({}, res);

    expect(res.body).toEqual({ providerCommissionPercentage: 5 });
    expect(mockGetOverride).toHaveBeenCalledWith('user-1');
  });

  test('returns null when the caller has no override', async () => {
    mockCurrentUserShow.mockResolvedValue({ data: { data: { id: { uuid: 'user-1' } } } });
    mockGetOverride.mockResolvedValue({ found: false });
    const res = mockRes();

    await handleGetMyCommission({}, res);

    expect(res.body).toEqual({ providerCommissionPercentage: null });
  });

  test('rejects an unauthenticated caller', async () => {
    mockCurrentUserShow.mockRejectedValue(new Error('401'));
    const res = mockRes();

    await handleGetMyCommission({}, res);

    expect(res.statusCode).toBe(401);
    expect(mockGetOverride).not.toHaveBeenCalled();
  });

  test('ignores any attempt to target another user', async () => {
    // The security-relevant case: the handler takes no user parameter, so a
    // supplied one must have no effect on which rate is returned.
    mockCurrentUserShow.mockResolvedValue({ data: { data: { id: { uuid: 'user-1' } } } });
    mockGetOverride.mockResolvedValue({ found: true, percentage: 5 });
    const res = mockRes();

    await handleGetMyCommission({ query: { userId: 'user-2' }, body: { userId: 'user-2' } }, res);

    expect(mockGetOverride).toHaveBeenCalledWith('user-1');
    expect(mockGetOverride).not.toHaveBeenCalledWith('user-2');
  });

  test('returns 503 rather than a wrong rate when the store is unreadable', async () => {
    mockCurrentUserShow.mockResolvedValue({ data: { data: { id: { uuid: 'user-1' } } } });
    mockGetOverride.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await handleGetMyCommission({}, res);

    expect(res.statusCode).toBe(503);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn test-server -- --testPathPattern=api/commission`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Implement the endpoint**

Create `server/api/commission/index.js`:

```js
'use strict';

// GET /api/commission/me — the authenticated caller's own provider commission
// percentage, or null when the marketplace-wide rate applies.
//
// Read-only and self-scoped by construction: it takes no user parameter, so it
// cannot become a way to look up another seller's negotiated rate. That
// confidentiality is the whole reason the rate is not stored on the Sharetribe
// user record in the first place.

const express = require('express');
const { getSdk } = require('../../api-util/sdk');
const { createProviderCommissionStore } = require('../../services/providerCommissionStore');

const handleGetMyCommission = async (req, res) => {
  const sdk = getSdk(req, res);

  let userId;
  try {
    const me = await sdk.currentUser.show();
    userId = me?.data?.data?.id?.uuid;
  } catch (e) {
    userId = null;
  }
  if (!userId) return res.status(401).json({ code: 'UNAUTHORIZED' });

  try {
    const result = await createProviderCommissionStore().getOverride(userId);
    return res.json({
      providerCommissionPercentage: result.found ? result.percentage : null,
    });
  } catch (e) {
    // Do not guess. The estimator falls back to the marketplace rate on its own.
    console.error(`[commission] Override lookup failed for ${userId}: ${e.message}`);
    return res.status(503).json({ code: 'COMMISSION_UNAVAILABLE' });
  }
};

const router = express.Router();
router.get('/me', handleGetMyCommission);

module.exports = router;
module.exports.handleGetMyCommission = handleGetMyCommission;
```

- [ ] **Step 4: Mount the router**

In `server/customApiRoutes.js`, add the import alongside the others:

```js
const commissionRouter = require('./api/commission');
```

and the mount inside `mountCustomApiRoutes` (GET-only, so no body parser):

```js
  app.use('/api/commission', commissionRouter);
```

- [ ] **Step 5: Run the endpoint test to verify it passes**

Run: `yarn test-server -- --testPathPattern=api/commission`
Expected: PASS (5 tests)

- [ ] **Step 6: Write the failing estimator test**

Create `EarningsEstimator.test.js` in the same directory. It has no test today.

```js
import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';
import { types as sdkTypes } from '../../../../util/sdkLoader';
import EarningsEstimator from './EarningsEstimator';

const { screen, waitFor } = testingLibrary;
const { Money } = sdkTypes;

describe('EarningsEstimator', () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test('falls back to the marketplace rate before the response arrives', () => {
    global.fetch = jest.fn(() => new Promise(() => {}));
    render(<EarningsEstimator price={new Money(100000, 'MXN')} marketplaceCurrency="MXN" />);

    expect(screen.getByText(/10%/)).toBeInTheDocument();
  });

  test('prefers the fetched override once it arrives', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ providerCommissionPercentage: 5 }) })
    );
    render(<EarningsEstimator price={new Money(100000, 'MXN')} marketplaceCurrency="MXN" />);

    await waitFor(() => expect(screen.getByText(/5%/)).toBeInTheDocument());
  });

  test('keeps the marketplace rate when the request fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    render(<EarningsEstimator price={new Money(100000, 'MXN')} marketplaceCurrency="MXN" />);

    await waitFor(() => expect(screen.getByText(/10%/)).toBeInTheDocument());
  });

  test('never renders a negative payout when the fee clamps', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ providerCommissionPercentage: 75 }) })
    );
    render(<EarningsEstimator price={new Money(1000, 'MXN')} marketplaceCurrency="MXN" />);

    await waitFor(() => expect(screen.queryByText(/-\$/)).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `yarn test -- --watchAll=false --testPathPattern=EarningsEstimator`
Expected: FAIL — the component does not fetch, so the 5% case never appears

- [ ] **Step 8: Update the estimator**

In `EarningsEstimator.js`, add the imports:

```js
import React, { useEffect, useState } from 'react';
import { clampFixedFee } from '../../../../util/avCommission';
```

After the existing `config.earningsEstimate` destructuring, add the fetch and prefer its result:

```js
  // The rate is not on currentUser — it lives in an AV table, deliberately, so
  // that one seller's negotiated rate is not readable by anyone else. Fetch our
  // own and fall back to the marketplace rate until it arrives or if it fails.
  const [ownPercentage, setOwnPercentage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/commission/me', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data && typeof data.providerCommissionPercentage === 'number') {
          setOwnPercentage(data.providerCommissionPercentage);
        }
      })
      .catch(() => {
        // Marketplace rate stays in place; nothing to do.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const effectivePercentage = ownPercentage != null ? ownPercentage : providerCommissionPercentage;
```

Then replace the `marketplaceCut` calculation so it clamps exactly as the server does:

```js
  const percentageAmount = Math.round((gross * effectivePercentage) / 100);
  const fixedFeeCharged = clampFixedFee(
    percentageAmount,
    providerCommissionFixedAmountInSubunits,
    gross
  );
  const marketplaceCut = percentageAmount + fixedFeeCharged;
```

Finally, replace the two remaining uses of `providerCommissionPercentage` in the rendered fee label with `effectivePercentage`, and derive `fixedFeeFormatted` from `fixedFeeCharged` rather than the configured amount, so the label never advertises a fee that will not be charged:

```js
  const fixedFeeFormatted = fixedFeeCharged > 0 ? fmt(fixedFeeCharged) : null;
```

`fmt` is defined below these lines in the current file — move the `const fmt = ...` declaration above this block, or inline `formatMoney(intl, new Money(fixedFeeCharged, currency))`.

- [ ] **Step 9: Run the estimator test to verify it passes**

Run: `yarn test -- --watchAll=false --testPathPattern=EarningsEstimator`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add server/api/commission server/customApiRoutes.js \
        src/containers/EditListingPage/EditListingWizard/EditListingPricingPanel/EarningsEstimator.js \
        src/containers/EditListingPage/EditListingWizard/EditListingPricingPanel/EarningsEstimator.test.js
git commit -m "feat(commission): add self-scoped rate endpoint and show real rate in the estimator"
```

---

### Task 7: Operator CLI

**Files:**
- Create: `scripts/provider-commission.js`
- Modify: `package.json` (scripts block, near the existing `notifications:*` entries)

**Interfaces:**
- Consumes: `createProviderCommissionStore` (Task 1); `parseCommissionOverride`, `impliedMinimumPrice`, `MAX_PROVIDER_COMMISSION_PERCENTAGE` (Task 2); `getIntegrationSdk` from `server/services/integrationSdk`
- Produces: `yarn commission:get|set|clear`

- [ ] **Step 1: Implement the script**

Create `scripts/provider-commission.js`, following `scripts/notification-deliveries.js`:

```js
'use strict';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
require('../server/env').configureEnv();

const os = require('os');

const {
  MAX_PROVIDER_COMMISSION_PERCENTAGE,
  impliedMinimumPrice,
  parseCommissionOverride,
} = require('../server/api-util/providerCommission');
const { createProviderCommissionStore } = require('../server/services/providerCommissionStore');
const { getIntegrationSdk } = require('../server/services/integrationSdk');
const { closePostgresPool } = require('../server/services/postgres');

const FIXED_FEE = parseInt(process.env.REACT_APP_PROVIDER_COMMISSION_FIXED_FEE, 10) || 0;
const LISTING_MINIMUM_PRICE = parseInt(process.env.AV_LISTING_MINIMUM_PRICE, 10) || 6000;

function printUsage() {
  console.log(`Usage:
  yarn commission:get   <userId|email>
  yarn commission:set   <userId|email> <percentage>
  yarn commission:clear <userId|email>

Percentage must be between 0 and ${MAX_PROVIDER_COMMISSION_PERCENTAGE}. An absent override means the
marketplace-wide rate applies. Setting 0 means the seller pays no percentage but still pays the
fixed fee of ${FIXED_FEE} subunits.`);
}

// A <userId> needs no Sharetribe access at all. An <email> costs one Integration
// lookup, purely so the operator can confirm they targeted the right seller.
async function resolveUser(identifier) {
  if (!identifier.includes('@')) return { userId: identifier, displayName: null };

  const res = await getIntegrationSdk().users.show({ email: identifier });
  const user = res?.data?.data;
  if (!user) throw new Error(`No user found for ${identifier}`);
  return { userId: user.id.uuid, displayName: user.attributes?.profile?.displayName || null };
}

function describe(userId, displayName, percentage) {
  const who = displayName ? `${displayName} (${userId})` : userId;
  if (percentage == null) {
    console.log(`${who}: no override — marketplace-wide rate applies`);
    return;
  }
  const minPrice = impliedMinimumPrice(percentage, FIXED_FEE);
  console.log(`${who}: ${percentage}%`);
  console.log(`  implied minimum listing price: ${minPrice} subunits (fixed fee ${FIXED_FEE})`);
}

async function main() {
  const [command, identifier, value] = process.argv.slice(2);
  const known = ['get', 'set', 'clear'].includes(command);
  if (!known || !identifier || (command === 'set' && value === undefined)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { userId, displayName } = await resolveUser(identifier);
  const store = createProviderCommissionStore();

  if (command === 'get') {
    const result = await store.getOverride(userId);
    describe(userId, displayName, result.found ? result.percentage : null);
    return;
  }

  if (command === 'set') {
    const percentage = parseCommissionOverride(value);
    if (percentage === null) {
      throw new Error(
        `"${value}" is not a valid percentage. Use a number between 0 and ${MAX_PROVIDER_COMMISSION_PERCENTAGE}.`
      );
    }

    // Refuse a rate that is legal in isolation but impossible against the
    // configured minimum listing price — otherwise the operator creates a seller
    // whose cheapest listings silently have their fixed fee clamped.
    const minPrice = impliedMinimumPrice(percentage, FIXED_FEE);
    if (minPrice > LISTING_MINIMUM_PRICE) {
      throw new Error(
        `${percentage}% requires a minimum listing price of ${minPrice} subunits, but the marketplace minimum is ${LISTING_MINIMUM_PRICE}. Lower the rate or raise the minimum.`
      );
    }

    await store.setOverride(userId, percentage, `operator:${os.hostname()}`);
    console.log('Override saved.');
    describe(userId, displayName, percentage);
    return;
  }

  const removed = await store.clearOverride(userId);
  console.log(removed ? 'Override cleared.' : 'No override existed.');
  describe(userId, displayName, null);
}

main()
  .catch(err => {
    console.error('[provider-commission] Command failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() =>
    closePostgresPool().catch(err => {
      console.error('[provider-commission] Pool shutdown failed:', err);
      process.exitCode = 1;
    })
  );
```

- [ ] **Step 2: Register the yarn scripts**

In `package.json`, beside the existing `notifications:*` entries:

```json
    "commission:get": "node scripts/provider-commission.js get",
    "commission:set": "node scripts/provider-commission.js set",
    "commission:clear": "node scripts/provider-commission.js clear",
```

- [ ] **Step 3: Exercise every branch manually**

```bash
yarn commission:set <seller-uuid> 5        # -> "Override saved." + implied minimum 1579
yarn commission:get <seller-uuid>          # -> 5%
yarn commission:set <seller-uuid> 80       # -> fails: not a valid percentage
yarn commission:set <seller-uuid> 12%      # -> fails: not a valid percentage
yarn commission:clear <seller-uuid>        # -> "Override cleared."
yarn commission:get <seller-uuid>          # -> no override
```

Expected: the two invalid `set` calls exit non-zero and write nothing.

- [ ] **Step 4: Commit**

```bash
git add scripts/provider-commission.js package.json
git commit -m "feat(commission): add operator CLI for per-seller commission rates"
```

---

### Task 8: Operator documentation and deployment prerequisites

The feature is unusable without this — there is no UI, so the docs are the interface.

**Files:**
- Modify: `docs/operator-guide.md` (canonical EN source)
- Modify: `docs/shareable/operator-guide.html` (EN regenerated from the md; ES is hand-translated fragments)
- Modify: `docs/operations/release-checklist.md`
- Modify: `.env-template`

**Interfaces:**
- Consumes: the CLI from Task 7
- Produces: no code.

- [ ] **Step 1: Write the operator-guide section**

Add a new section to `docs/operator-guide.md` covering, in this order:

1. **What it is** — a per-seller commission percentage; no row means the marketplace-wide rate.
2. **Finding a seller's user ID** — from the Console user page URL, or pass their email to the CLI.
3. **The commands** — `yarn commission:get|set|clear`, with a worked example.
4. **The semantics table** — no override / `0` / `5` / `75`, and that `0` still charges the fixed fee.
5. **The `75` ceiling and why it exists** — at 100% the fixed fee cannot fit at any price, so every checkout by that seller would fail.
6. **The implied minimum price** — each rate needs `fixedFee / (1 - pct/100)`; the CLI prints it.
7. **What a clamped fee looks like** — when a listing is priced too low, the fixed fee is reduced rather than the checkout failing, so the platform earns less than intended; it is logged.
8. **Reading the logs** — `[providerCommission] ... source=override|default|fallback`. **A `fallback` at `error` level means the rate could not be determined and transactions in that window may be mispriced.** Sustained fallbacks are a pricing incident, not noise: list the transactions created during the window and reconcile them.
9. **Verifying a change** — start a checkout on a listing by that seller and confirm the OrderBreakdown commission row.

- [ ] **Step 2: Splice the ES edition**

`docs/shareable/operator-guide.html` has a generated EN edition and a hand-translated ES one. Regenerate EN:

```bash
node docs/shareable/build-shareable-guide.js
```

Then hand-translate the new section into the ES fragment, following the existing structure. See `memory/operator-guide-html` for how the two editions relate.

- [ ] **Step 3: Document the env var**

Add to `.env-template` near the existing `REACT_APP_PROVIDER_COMMISSION_FIXED_FEE` block:

```sh
# Marketplace minimum listing price in subunits, used by the commission CLI to reject a
# per-seller rate that could not cover the fixed fee. Must match the Console
# transaction-size.json value. See docs/operator-guide.md.
# AV_LISTING_MINIMUM_PRICE=6000
```

- [ ] **Step 4: Verify the env template check passes**

Run: `yarn env-template-check`
Expected: PASS

- [ ] **Step 5: Record the deployment prerequisites**

Add to `docs/operations/release-checklist.md`:

- Console `transaction-size.json` → `listingMinimumPrice` raised to `6000` **before** release. The code default now matches, but Console overrides it at runtime.
- Migration `010` applied to every environment, including the Render test database via the `migrate-test-db` procedure.
- Note that existing listings priced below `6000` keep transacting and rely on the clamp — auditing and repricing them is a separate operational task, not a release blocker.

- [ ] **Step 6: Commit**

```bash
git add docs/operator-guide.md docs/shareable/operator-guide.html \
        docs/operations/release-checklist.md .env-template
git commit -m "docs(commission): document per-seller commission overrides for operators"
```

---

### Task 9: Full-suite verification

- [ ] **Step 1: Run the whole server suite**

Run: `yarn test-server`
Expected: PASS, no new failures

- [ ] **Step 2: Run the whole client suite**

Run: `yarn test -- --watchAll=false`
Expected: PASS. If snapshots involving the pricing panels changed because the estimator now renders a clamped fee, inspect each diff before running `yarn test -u` — a changed fee figure is expected, a changed *label* is not.

- [ ] **Step 3: Check formatting and translations**

```bash
yarn format-ci
yarn av-translation-check
```

Expected: both PASS. This plan adds no new translation keys, so the second is a regression check.

- [ ] **Step 4: End-to-end manual verification**

With an override of 5% set on a test seller and a listing priced at $1,000.00 MXN, complete a checkout and confirm:

- OrderBreakdown shows a provider commission of $50.00 plus a $15.00 fixed fee, not $100.00
- The transaction's `payoutTotal` is $935.00
- The server logged `source=override` for that seller
- Clearing the override and repeating shows $100.00 + $15.00 and logs `source=default`

- [ ] **Step 5: Commit any snapshot updates**

```bash
git add -A
git commit -m "test(commission): update snapshots for clamped estimator fee"
```

---

## Notes for the implementer

**Tasks 1–2 and Task 3 are independent** and can be done in either order. Everything else depends on them: Task 5 needs 1 and 2, Task 6 needs 1 and 4, Task 7 needs 1 and 2.

**The one thing not to "simplify":** `getOverride` returning `{ found: boolean }` instead of `number | null` looks like ceremony. It is the entire point of the error-handling design — "this seller has no override" and "I could not read the table" must not reach the same code path, because defaulting on an *unknown* rate mischarges in whichever direction that seller was negotiated. If you collapse it, Task 2's determinacy tests will fail, and that failure is correct.

**Upstream file policy:** `lineItemHelpers.js`, `configDefault.js`, and the three endpoints are upstream files already carrying AV changes. Keep every edit additive and minimal — no reformatting, no restructuring beyond what each step specifies.
