# Bulk-import horizontal scaling

Status: pending only if the web tier must run more than one process or imports must survive deploys.
The current supported constraint is documented in
[`operations/scaling.md`](../operations/scaling.md).

## Option 1 — Shared coordination store

Use Redis or an equivalent shared store for job state, owner locks, the global concurrency counter,
rate limits, and action tokens. Preserve the current `jobStore` and `rateLimiter` interfaces while
making their operations asynchronous and atomic.

Acceptance criteria:

- any web process can serve owner-scoped status;
- one active job per user and the global cap are atomic across processes;
- rate limits do not multiply with process count;
- action tokens work regardless of request routing; and
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

## Decision gate

- [ ] Confirm why horizontal web scaling or durable imports are required.
- [ ] Choose shared coordination only or a durable worker.
- [ ] Approve the new managed dependency and operating cost.
- [ ] Design migration and single-process fallback behavior.
- [ ] Add concurrent-process, restart, ownership, rate-limit, and load tests.
- [ ] Remove the `web=1` deployment constraint only after staging proves the chosen guarantees.
