# Notification PostgreSQL Setup

The notification event poller requires PostgreSQL for four related guarantees:

- a durable cursor and recent-event set that survive application replacement; and
- a session-level advisory lock that elects one active poller across all web processes; and
- an atomic notification-delivery ledger that deduplicates provider sends across replay and
  concurrent workers; and
- durable campaign jobs, marketing consent/suppression, first-party engagement, and Brevo webhook
  audit.

Every deployed process may start the poller coordinator, but only the process holding the PostgreSQL
lock schedules Integration API polling. The other processes remain standbys and retry leadership
every 30 seconds.

## 1. Local setup with Docker

Prerequisites:

- Docker Desktop or another Docker Engine with Compose v2;
- port `5432` available on the host; and
- project dependencies installed with `yarn install`.

Start PostgreSQL, wait for its health check, and apply the idempotent schema migration:

```sh
yarn db:setup
```

The command creates a persistent Docker volume and a development-only database:

```text
database: archivo_vintach
user:     archivo_vintach
password: archivo_vintach_dev
port:     5432
```

To use the regular server commands, add this server-only value to `.env.development`; do not use it
in a `REACT_APP_*` variable:

```sh
DATABASE_URL=postgresql://archivo_vintach:archivo_vintach_dev@localhost:5432/archivo_vintach
```

The regular development frontend/API pair does not run the notification poller. If you prefer not to
edit `.env.development`, use the production-like SSR helper; it supplies the container URL:

```sh
yarn run dev-server:notifications
```

This also requires the Sharetribe Integration API and relevant Brevo/WhatsApp variables. Enable the
poller and explicitly enable or disable each channel:

```sh
AV_NOTIFICATIONS_ENABLED=true
AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED=true
AV_BREVO_CAMPAIGNS_ENABLED=false
AV_WHATSAPP_NOTIFICATIONS_ENABLED=false
```

## 2. Local database commands

```sh
yarn db:setup    # Start the container, wait until healthy, and migrate
yarn db:up       # Start an already initialized container
yarn db:migrate  # Apply the schema using DATABASE_URL
yarn db:status   # Show container and health status
yarn db:verify   # Verify leadership, cursor restoration, and atomic delivery claims
yarn db:down     # Stop the container; preserve the database volume
```

The Compose service mounts `server/migrations/` into the official PostgreSQL image for first-time
initialization. `yarn db:setup` also runs every `.sql` migration in filename order, so existing
volumes receive future idempotent changes.

Inspect the shared cursor and current owner:

```sh
docker compose exec postgres psql \
  -U archivo_vintach \
  -d archivo_vintach \
  -c "SELECT poller_name, last_sequence_id, owner_id, owner_acquired_at, heartbeat_at, updated_at FROM av_notification_event_poller_state;"
```

Expected ownership logs include:

```text
[eventPoller] Leadership acquired owner=HOST:PID:LEASE_UUID lock=731747821
[eventPoller] Active owner=HOST:PID:LEASE_UUID; lastSequenceId=...
[eventPoller] Standby owner=HOST:PID; PostgreSQL leader lock is held elsewhere
```

Inspect delivery outcomes without exposing the full retry payload:

```sh
yarn notifications:list
yarn notifications:list failed
yarn notifications:list unknown
```

Inspect campaign job counts without exposing recipient or template parameters:

```sh
docker compose exec postgres psql \
  -U archivo_vintach \
  -d archivo_vintach \
  -c "SELECT campaign, status, COUNT(*) FROM av_notification_jobs GROUP BY campaign, status ORDER BY campaign, status;"
```

Retry a definite failure:

```sh
yarn notifications:retry NOTIFICATION_KEY
```

An `unknown` outcome means the HTTP request ended without a definitive provider response. Check the
Brevo or Meta dashboard first. Only when a resend is known to be safe should the operator
acknowledge the ambiguity:

```sh
yarn notifications:retry NOTIFICATION_KEY --confirm-unknown
```

The same acknowledgement can recover a `processing` claim only after it is older than
`AV_NOTIFICATION_STALE_CLAIM_MINUTES` (default 15), preventing a retry from racing a live sender.

## 3. Readiness and backlog metrics

`GET /api/notifications/readiness` returns HTTP `200` when the explicit configuration and
notification database are ready, or `503` otherwise. It distinguishes:

- global poller, seller welcome, Brevo campaign, and WhatsApp flags and missing variable names;
- database migration, active ownership, heartbeat, and current sequence ID;
- delivery ledger and delayed-job counts by outcome, plus the marketing-preference count; and
- pages/events processed, sequence lag in remaining events, oldest observed event age, page-bound
  state, and repeated-error counters.

The poller drains up to `AV_EVENT_POLLER_MAX_PAGES_PER_POLL` 100-event pages in one tick (default
10), waiting `AV_EVENT_POLLER_PAGE_DELAY_MS` between full pages (default 250 ms). It emits
`[notificationAlert]` when the page bound is reached, the oldest observed event exceeds
`AV_EVENT_POLLER_LAG_ALERT_MS` (default 15 minutes), or errors repeat. Route that marker to the
production alerting system.

## 4. Production setup

1. Provision a durable managed PostgreSQL database.
2. Set its server-only `DATABASE_URL` on every web process. All processes must use the same
   database.
3. Set `AV_NOTIFICATIONS_ENABLED` explicitly. When it is `true`, explicitly set seller welcome,
   Brevo campaign, and WhatsApp flags, then supply credentials/template IDs for each enabled
   channel. Incomplete production configuration prevents startup.
4. Add the provider's required TLS parameters to the connection URL, such as `sslmode=require`,
   according to that provider's certificate guidance.
5. Run `yarn db:migrate` as a release/pre-deploy command before the new application version starts.
6. Deploy and confirm that readiness is `200`, exactly one process logs `Leadership acquired`, and
   all others log `Standby`.
7. Query `av_notification_event_poller_state` and confirm that `heartbeat_at` and `last_sequence_id`
   advance.
8. Replace the active process and confirm a standby acquires leadership and continues from the
   stored sequence ID.

`AV_DATABASE_POOL_MAX` defaults to `5` and must be at least `2`: the leader holds one connection for
the advisory lock while cursor reads and writes use another connection.

PostgreSQL session advisory locks are held until explicitly released or until the database session
ends, so a crashed process releases leadership automatically. See the
[PostgreSQL advisory-lock reference](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
and the [Docker Official PostgreSQL image documentation](https://hub.docker.com/_/postgres).

## 5. Failure behavior

- If `DATABASE_URL` or the migrated table is missing, the poller does not run without coordination.
  It logs the failed leadership attempt and retries.
- If the leader's dedicated PostgreSQL connection fails, its polling timers stop. PostgreSQL
  releases the session lock and a standby can take over.
- Cursor updates include the current owner ID. A stale process cannot overwrite the new leader's
  cursor after ownership changes.
- A definite provider rejection is stored as `failed`; selected retryable responses receive one
  bounded automatic retry.
- Marketing withdrawal/provider suppression cancels pending promotional jobs. Claimed marketing
  jobs recheck consent, email identity, the weekly cap, and live campaign/resource state before send.
- Campaign jobs left in `processing` by a worker restart are reclaimed after
  `AV_NOTIFICATION_STALE_CLAIM_MINUTES`; the delivery ledger then deduplicates any provider send
  that completed before the interruption.
- A provider request with no definitive response is stored as `unknown` and never automatically
  retried. PostgreSQL cannot atomically commit a third-party HTTP request, so operator
  reconciliation remains required for this outcome.
- The delivery payload supports operator retry and can contain recipient data. Restrict database and
  command access and apply the project's privacy/retention policy.
