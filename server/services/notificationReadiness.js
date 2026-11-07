'use strict';

const { createTTLCache } = require('../api-util/cache');
const { getNotificationConfigReadiness } = require('./notificationConfig');
const { getNotificationMetrics } = require('./notificationMetrics');
const { getPostgresPool } = require('./postgres');

// Tables the notification and shipping-label features need (migrations 001–010).
const REQUIRED_TABLES = [
  'av_notification_event_poller_state',
  'av_notification_deliveries',
  'av_notification_jobs',
  'av_marketing_preferences',
  'av_listing_publications',
  'av_shipping_label_attempts',
  'av_eship_tracking_notifications',
];

// Probes are cheap and bursty; one answer per window is plenty (audit A10).
const PUBLIC_READINESS_TTL_SECONDS = 10;
const DETAILS_TTL_SECONDS = 5;

/**
 * Catalog lookups only — no table scans: the poller state row, the required
 * tables, and the newest migration's column. Throws when PostgreSQL is
 * unreachable or the poller-state table is missing.
 */
async function queryMigrationState(pool) {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::integer
          FROM av_notification_event_poller_state
         WHERE poller_name = 'notifications') AS poller_rows,
       (SELECT COUNT(*)::integer
          FROM unnest($1::text[]) AS required(name)
         WHERE to_regclass(required.name) IS NULL) AS missing_tables,
       EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'av_listing_publications'
            AND column_name = 'completed_at'
       ) AS publications_migrated`,
    [REQUIRED_TABLES]
  );
  const row = result.rows[0] || {};
  return {
    pollerStatePresent: row.poller_rows === 1,
    migrated:
      row.poller_rows === 1 && row.missing_tables === 0 && row.publications_migrated === true,
  };
}

// One in-flight computation per key, then a short TTL. The public probe and the
// detailed diagnostics are cached independently.
const createCoalescedLoader = (ttlSeconds, compute) => {
  const cache = createTTLCache(ttlSeconds, { maxEntries: 1 });
  let pending = null;
  const load = options => {
    const { data: cached } = cache.result || {};
    if (cached) return Promise.resolve(cached);
    if (pending) return pending;
    pending = compute(options)
      .then(result => {
        cache.result = result;
        return result;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  load.reset = () => {
    delete cache.result;
    pending = null;
  };
  return load;
};

/**
 * The public readiness decision: `{ ready }` only, from the configuration and a
 * single catalog query. It never aggregates the delivery, job, consent, label
 * or tracking tables, so a probe's cost does not grow with retained data, and
 * concurrent probes share one query (audit A10).
 */
async function computePublicReadiness({ pool = null } = {}) {
  const config = getNotificationConfigReadiness();
  let databaseReady = !config.poller.enabled;
  if (config.poller.enabled && process.env.DATABASE_URL) {
    try {
      databaseReady = (await queryMigrationState(pool || getPostgresPool())).migrated;
    } catch (err) {
      databaseReady = false;
    }
  }
  return { ready: config.ready && databaseReady };
}

const getPublicNotificationReadiness = createCoalescedLoader(
  PUBLIC_READINESS_TTL_SECONDS,
  computePublicReadiness
);

// Full diagnostics for the bearer-protected endpoint.
async function computeNotificationReadiness({ pool = null } = {}) {
  const config = getNotificationConfigReadiness();
  const database = {
    required: config.poller.enabled,
    ready: !config.poller.enabled,
    migrated: false,
    ownerActive: false,
    lastSequenceId: null,
    heartbeatAt: null,
    deliveriesByStatus: {},
    jobsByStatus: {},
    shippingLabelsByStatus: {},
    eshipTrackingByStatus: {},
    marketingPreferences: 0,
  };

  if (config.poller.enabled && process.env.DATABASE_URL) {
    try {
      const databasePool = pool || getPostgresPool();
      const [
        stateResult,
        deliveryResult,
        jobsResult,
        preferencesResult,
        shippingLabelsResult,
        eshipTrackingResult,
        migrationState,
      ] = await Promise.all([
        databasePool.query(
          `SELECT last_sequence_id, owner_id, heartbeat_at
           FROM av_notification_event_poller_state
           WHERE poller_name = 'notifications'`
        ),
        databasePool.query(
          `SELECT status, COUNT(*)::integer AS count
           FROM av_notification_deliveries
           GROUP BY status`
        ),
        databasePool.query(
          `SELECT status, COUNT(*)::integer AS count
           FROM av_notification_jobs
           GROUP BY status`
        ),
        databasePool.query(
          `SELECT COUNT(*)::integer AS count
           FROM av_marketing_preferences`
        ),
        databasePool.query(
          `SELECT status, COUNT(*)::integer AS count
           FROM av_shipping_label_attempts
           GROUP BY status`
        ),
        databasePool.query(
          `SELECT status, COUNT(*)::integer AS count
           FROM av_eship_tracking_notifications
           GROUP BY status`
        ),
        queryMigrationState(databasePool),
      ]);
      const pollerState = stateResult.rows[0] || {};
      database.ready = stateResult.rowCount === 1 && migrationState.migrated;
      database.migrated = migrationState.migrated;
      database.ownerActive = Boolean(pollerState.owner_id);
      database.lastSequenceId = pollerState.last_sequence_id ?? null;
      database.heartbeatAt = pollerState.heartbeat_at ?? null;
      database.deliveriesByStatus = Object.fromEntries(
        deliveryResult.rows.map(row => [row.status, row.count])
      );
      database.jobsByStatus = Object.fromEntries(
        jobsResult.rows.map(row => [row.status, row.count])
      );
      database.marketingPreferences = preferencesResult.rows[0]?.count || 0;
      database.shippingLabelsByStatus = Object.fromEntries(
        shippingLabelsResult.rows.map(row => [row.status, row.count])
      );
      database.eshipTrackingByStatus = Object.fromEntries(
        eshipTrackingResult.rows.map(row => [row.status, row.count])
      );
    } catch (err) {
      database.ready = false;
      database.error = 'notification_database_unavailable_or_unmigrated';
    }
  }

  return {
    ready: config.ready && database.ready,
    intentionallyDisabled: config.poller.configured && !config.poller.enabled,
    config,
    database,
    metrics: getNotificationMetrics(),
  };
}

// Uncached, for tests and scripts; the details endpoint uses the coalesced one.
const getNotificationReadiness = computeNotificationReadiness;
const getNotificationReadinessDetails = createCoalescedLoader(
  DETAILS_TTL_SECONDS,
  computeNotificationReadiness
);

module.exports = {
  REQUIRED_TABLES,
  getNotificationReadiness,
  getNotificationReadinessDetails,
  getPublicNotificationReadiness,
  _test: {
    reset: () => {
      getPublicNotificationReadiness.reset();
      getNotificationReadinessDetails.reset();
    },
  },
};
