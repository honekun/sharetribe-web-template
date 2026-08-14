'use strict';

const { getNotificationConfigReadiness } = require('./notificationConfig');
const { getNotificationMetrics } = require('./notificationMetrics');
const { getPostgresPool } = require('./postgres');

async function getNotificationReadiness({ pool = null } = {}) {
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
      ]);
      const pollerState = stateResult.rows[0] || {};
      database.ready = stateResult.rowCount === 1;
      database.migrated = stateResult.rowCount === 1;
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

module.exports = { getNotificationReadiness };
