'use strict';

const { getPostgresPool } = require('./postgres');
const { normalizeEmail } = require('./emailAddress');

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_STALE_CLAIM_MINUTES = 15;

class NotificationJobStore {
  constructor(pool) {
    this.pool = pool;
  }

  async schedule({
    jobKey,
    campaign,
    sharetribeUserId,
    recipientEmail,
    resourceId = null,
    triggerEventId = null,
    payload = {},
    dueAt,
    refreshDueAt = false,
  }) {
    const result = await this.pool.query(
      `INSERT INTO av_notification_jobs (
         job_key, campaign, sharetribe_user_id, recipient_email, resource_id,
         trigger_event_id, payload, due_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (job_key) DO UPDATE
       SET payload = EXCLUDED.payload,
           recipient_email = EXCLUDED.recipient_email,
           trigger_event_id = COALESCE(EXCLUDED.trigger_event_id,
                                       av_notification_jobs.trigger_event_id),
           due_at = CASE WHEN $9::boolean THEN EXCLUDED.due_at
                         ELSE av_notification_jobs.due_at END,
           updated_at = NOW()
       WHERE av_notification_jobs.status = 'pending'
       RETURNING *`,
      [
        jobKey,
        campaign,
        sharetribeUserId,
        normalizeEmail(recipientEmail),
        resourceId,
        triggerEventId,
        JSON.stringify(payload),
        dueAt,
        refreshDueAt,
      ]
    );
    return result.rows[0] || null;
  }

  async appendMatchingListing({
    jobKey,
    sharetribeUserId,
    recipientEmail,
    triggerEventId,
    dueAt,
    firstName,
    listing,
  }) {
    const result = await this.pool.query(
      `INSERT INTO av_notification_jobs (
         job_key, campaign, sharetribe_user_id, recipient_email,
         trigger_event_id, payload, due_at
       )
       VALUES ($1, 'matching_listings', $2, $3, $4,
               jsonb_build_object('firstName', $5, 'listings', jsonb_build_array($6::jsonb)),
               $7)
       ON CONFLICT (job_key) DO UPDATE
       SET payload = jsonb_set(
             jsonb_set(
               av_notification_jobs.payload,
               '{firstName}',
               to_jsonb(COALESCE(NULLIF($5, ''),
                                 av_notification_jobs.payload->>'firstName',
                                 'Usuario')),
               true
             ),
             '{listings}',
             (
               SELECT COALESCE(jsonb_agg(candidate ORDER BY score DESC), '[]'::jsonb)
               FROM (
                 SELECT candidate, score
                 FROM (
                   SELECT DISTINCT ON (candidate->>'id') candidate,
                          COALESCE((candidate->>'score')::integer, 0) AS score
                   FROM jsonb_array_elements(
                     COALESCE(av_notification_jobs.payload->'listings', '[]'::jsonb)
                     || jsonb_build_array($6::jsonb)
                   ) candidate
                   ORDER BY candidate->>'id', score DESC
                 ) deduplicated
                 ORDER BY score DESC
                 LIMIT 20
               ) ranked
             ),
             true
           ),
           recipient_email = EXCLUDED.recipient_email,
           updated_at = NOW()
       WHERE av_notification_jobs.status = 'pending'
       RETURNING *`,
      [
        jobKey,
        sharetribeUserId,
        normalizeEmail(recipientEmail),
        triggerEventId,
        firstName || '',
        JSON.stringify(listing),
        dueAt,
      ]
    );
    return result.rows[0] || null;
  }

  async claimDue(claimedBy, limit = DEFAULT_BATCH_SIZE) {
    const staleClaimMinutes =
      Number.isInteger(Number(process.env.AV_NOTIFICATION_STALE_CLAIM_MINUTES)) &&
      Number(process.env.AV_NOTIFICATION_STALE_CLAIM_MINUTES) > 0
        ? Number(process.env.AV_NOTIFICATION_STALE_CLAIM_MINUTES)
        : DEFAULT_STALE_CLAIM_MINUTES;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `WITH due AS (
           SELECT id
           FROM av_notification_jobs
           WHERE (status = 'pending' AND due_at <= NOW())
              OR (
                status = 'processing'
                AND claimed_at < NOW() - MAKE_INTERVAL(mins => $3::integer)
              )
           ORDER BY due_at, id
           FOR UPDATE SKIP LOCKED
           LIMIT $1
         )
         UPDATE av_notification_jobs jobs
         SET status = 'processing',
             attempt_count = attempt_count + 1,
             claimed_by = $2,
             claimed_at = NOW(),
             last_error = NULL,
             updated_at = NOW()
         FROM due
         WHERE jobs.id = due.id
         RETURNING jobs.*`,
        [limit, claimedBy, staleClaimMinutes]
      );
      await client.query('COMMIT');
      return result.rows;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async finish(id, status, error = null) {
    const timestamps =
      status === 'sent'
        ? ', sent_at = NOW()'
        : status === 'cancelled' || status === 'skipped'
        ? ', cancelled_at = NOW()'
        : '';
    await this.pool.query(
      `UPDATE av_notification_jobs
       SET status = $2, last_error = $3, updated_at = NOW() ${timestamps}
       WHERE id = $1 AND status = 'processing'`,
      [id, status, error ? String(error).slice(0, 2000) : null]
    );
  }

  async defer(id, dueAt, reason) {
    await this.pool.query(
      `UPDATE av_notification_jobs
       SET status = 'pending', due_at = $2, claimed_by = NULL, claimed_at = NULL,
           last_error = $3, updated_at = NOW()
       WHERE id = $1 AND status = 'processing'`,
      [id, dueAt, reason]
    );
  }

  async cancel({ campaign = null, sharetribeUserId = null, resourceId = null }) {
    const result = await this.pool.query(
      `UPDATE av_notification_jobs
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE status = 'pending'
         AND ($1::text IS NULL OR campaign = $1)
         AND ($2::text IS NULL OR sharetribe_user_id = $2)
         AND ($3::text IS NULL OR resource_id = $3)`,
      [campaign, sharetribeUserId, resourceId]
    );
    return result.rowCount;
  }

  async promotionalNextAvailableAt(sharetribeUserId) {
    const result = await this.pool.query(
      `SELECT sent_at
       FROM av_notification_jobs
       WHERE sharetribe_user_id = $1
         AND status = 'sent'
         AND campaign IN (
           'viewed_listing', 'abandoned_checkout', 'matching_listings',
           'signup_no_listing', 'listing_no_activity'
         )
         AND sent_at > NOW() - INTERVAL '7 days'
       ORDER BY sent_at DESC
       LIMIT 2`,
      [sharetribeUserId]
    );
    if (result.rows.length < 2) return null;
    return new Date(new Date(result.rows[1].sent_at).getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  async claimListingPublication({ listingId, authorId, publishedAt, eventId }) {
    const result = await this.pool.query(
      `INSERT INTO av_listing_publications (listing_id, author_id, published_at, event_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (listing_id) DO NOTHING
       RETURNING listing_id`,
      [listingId, authorId, publishedAt, eventId]
    );
    return result.rowCount === 1;
  }
}

class MarketingEngagementStore {
  constructor(pool) {
    this.pool = pool;
  }

  async record({
    sharetribeUserId,
    email,
    firstName = null,
    action,
    listingId,
    listingAuthorId = null,
    listingData = {},
    occurredAt = new Date().toISOString(),
  }) {
    const result = await this.pool.query(
      `INSERT INTO av_marketing_engagement (
         sharetribe_user_id, email, first_name, action, listing_id,
         listing_author_id, listing_data, occurred_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING id`,
      [
        sharetribeUserId || null,
        email ? normalizeEmail(email) : null,
        firstName,
        action,
        listingId,
        listingAuthorId,
        JSON.stringify(listingData),
        occurredAt,
      ]
    );
    return result.rows[0] || null;
  }

  async hasActionSince({ sharetribeUserId = null, listingId, actions, since }) {
    const result = await this.pool.query(
      `SELECT 1
       FROM av_marketing_engagement
       WHERE listing_id = $1
         AND ($2::text IS NULL OR sharetribe_user_id = $2)
         AND action = ANY($3::text[])
         AND occurred_at >= $4
       LIMIT 1`,
      [listingId, sharetribeUserId, actions, since]
    );
    return result.rowCount > 0;
  }

  async matchingUsers(listingData) {
    const category = listingData?.category;
    if (!category) return [];
    const result = await this.pool.query(
      `SELECT DISTINCT ON (eng.sharetribe_user_id)
         eng.sharetribe_user_id, eng.email, eng.first_name, eng.listing_data
       FROM av_marketing_engagement eng
       JOIN av_marketing_preferences pref
         ON (pref.sharetribe_user_id = eng.sharetribe_user_id OR pref.email = eng.email)
       WHERE eng.occurred_at >= NOW() - INTERVAL '90 days'
         AND eng.action IN ('view', 'favorite')
         AND eng.listing_data->>'category' = $1
         AND pref.enabled = TRUE
         AND pref.suppressed = FALSE
       ORDER BY eng.sharetribe_user_id, eng.occurred_at DESC`,
      [category]
    );
    return result.rows.map(row => ({
      sharetribeUserId: row.sharetribe_user_id,
      email: row.email,
      firstName: row.first_name,
      listingData: row.listing_data || {},
    }));
  }
}

function createNotificationJobStore(pool = getPostgresPool()) {
  return new NotificationJobStore(pool);
}

function createMarketingEngagementStore(pool = getPostgresPool()) {
  return new MarketingEngagementStore(pool);
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  DEFAULT_STALE_CLAIM_MINUTES,
  MarketingEngagementStore,
  NotificationJobStore,
  createMarketingEngagementStore,
  createNotificationJobStore,
};
