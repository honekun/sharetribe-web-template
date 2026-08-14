# Runtime scaling constraints

The current supported deployment uses **one web process**. Keep Heroku at `web=1` (or the equivalent
on another host) because bulk-import coordination lives in one Node process.

## Current bulk-import state

The bulk importer (`/admin/bulk-import`; see
[`implementation/bulk-import.md`](../implementation/bulk-import.md)) keeps these mechanisms in
in-process JavaScript `Map`s:

| Mechanism                                   | Current backing store             |
| ------------------------------------------- | --------------------------------- |
| Job progress and owner-scoped status        | In-memory job map, one-hour TTL   |
| One active job per user (`409`)             | In-memory job map                 |
| Global maximum of three active jobs (`503`) | Count of the in-memory job map    |
| Hourly per-user limits (`429`)              | In-memory rate-limit map          |
| Short-lived bulk-import action tokens       | In-memory token map               |
| Import worker                               | Async work inside the web process |

On the supported single-process deployment, ownership and concurrency behavior are correct.

## Restart behavior

A deploy, process restart, configuration change, or crash clears process memory:

- an in-flight import stops and its status endpoint later returns `404`;
- listings already created through Sharetribe persist;
- remaining CSV rows are not processed;
- job progress, active-job locks, action tokens, and rate-limit counters reset; and
- rerunning the entire ZIP can duplicate rows that already succeeded.

When an import is interrupted, compare its success results with **Console → Manage → Listings** and
build a new ZIP containing only rows that did not create a listing.

## Why multiple web processes are unsupported today

With two or more web processes, each process has different maps:

- status polling can reach a process that does not know the job and return a false `404`;
- the same user can start one job per process;
- the global cap becomes three jobs per process;
- hourly limits multiply by the process count; and
- an action token issued by one process can be rejected by another.

These failures affect coordination and memory control. Sharetribe records already created are not
corrupted, but duplicate listing creation becomes easier and users can lose progress visibility.

## State that is already safe across processes

| Subsystem                 | Current behavior                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Notification/event poller | PostgreSQL advisory-lock leadership elects one poller; the durable cursor and delivery claims are shared.           |
| Shipping-label purchase   | PostgreSQL claims prevent concurrent duplicate purchases; unknown carrier outcomes fail closed.                     |
| Hosted-asset cache        | Each process has an independent bounded cache; cold processes make extra asset calls but correctness is unaffected. |
| Upload temporary files    | Files exist only while an import is processed and are not used as durable state.                                    |

Every process that participates in notifications or labels must use the same migrated
`DATABASE_URL`. Keep `AV_DATABASE_POOL_MAX` at least `2`, since the leader holds one advisory-lock
connection while other database work uses another.

## Operational checks

- [ ] Confirm the deployment runs exactly one web process.
- [ ] Run database migrations before enabling notifications or labels.
- [ ] Confirm `GET /api/notifications/readiness` returns `200`.
- [ ] Confirm exactly one process logs poller leadership.
- [ ] Do not restart or deploy during a bulk import.
- [ ] Warn sellers before planned maintenance that active imports will be interrupted.
- [ ] Review [pending scaling work](../pending/scaling.md) before horizontal scaling.

The future shared-state and worker options are intentionally kept out of this current-state runbook.
