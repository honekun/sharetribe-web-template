# Bulk-import horizontal scaling

Status: pending only if the web tier must run more than one process or imports must survive deploys.
The current supported constraint is documented in
[`operations/scaling.md`](../operations/scaling.md).

## Option 1 — Shared coordination store

Use Redis or an equivalent shared store for job state, owner locks, the global concurrency counter,
rate limits, action tokens, and the in-flight row registry. Preserve the current `jobStore` and `rateLimiter` interfaces while
making their operations asynchronous and atomic.

Acceptance criteria:

- any web process can serve owner-scoped status;
- one active job per user and the global cap are atomic across processes;
- rate limits do not multiply with process count;
- action tokens work regardless of request routing;
- each row is claimed atomically by its import key before the listing lookup and create, so two
  processes cannot both create it (see Row claim below); and
- crash recovery cannot leave permanent locks or counters.

This restores coordination across web processes but does not make the import work survive a process
restart.

## Option 2 — Durable job and dedicated worker

Persist jobs and enqueue them for a dedicated worker process. Status reads from the database, and
the web tier no longer performs the memory-intensive import.

Acceptance criteria:

- work resumes or is safely reclaimed after a worker restart;
- only one worker owns a job at a time;
- retries cannot recreate successful rows without an explicit idempotency strategy;
- job ownership, progress, row results, and expiry are durable;
- worker memory is isolated from request-serving processes; and
- deployment/rollback procedures cover both web and worker processes.

## Row claim (required by either option)

Row idempotency (`server/api/bulk-import/rowIdempotency.js`) matches each row's content key against
the author's recent listings, then creates the listing. Between that lookup and the create, only a
**process-local** in-flight map stops a second attempt. That is sufficient on one web process, which
is the supported deployment, and it is why this is deferred rather than open: it is needed **only
before** web scales past 1 process or a separate worker is added.

The replacement must be a durable, atomic claim on the import key taken before the lookup and held
until the row settles, with expiry so a crashed holder cannot block the key for good. The existing
PostgreSQL label-purchase claims (`AV_SHIPPING_LABELS_ENABLED`) are the in-repo pattern to follow.
A row that loses the claim fails with `row-in-flight`, as it does today within one process.

## Decision gate

- [ ] Confirm why horizontal web scaling or durable imports are required.
- [ ] Choose shared coordination only or a durable worker.
- [ ] Approve the new managed dependency and operating cost.
- [ ] Design migration and single-process fallback behavior.
- [ ] Replace the in-flight row registry with a durable atomic claim per import key.
- [ ] Add concurrent-process, restart, ownership, rate-limit, row-claim, and load tests.
- [ ] Remove the `web=1` deployment constraint only after staging proves the chosen guarantees.
