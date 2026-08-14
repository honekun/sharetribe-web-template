'use strict';

const { getIntegrationSdk } = require('./integrationSdk');
const { maybeBuyLabelForEvent } = require('./shipmentService');
const { processDueEshipTrackingNotifications } = require('./eshipTrackingService');
const { getAdminPhone, lookupUserPhone } = require('./whatsappService');
const { claimOwnership, loadCursor, releaseOwnership, saveCursor } = require('./eventPollerCursor');
const { getLeadership } = require('./eventPollerLeadership');
const { deliverNotification } = require('./notificationDelivery');
const {
  isMarketingCampaignsEnabled,
  isWelcomeEmailEnabled,
  isWhatsAppEnabled,
} = require('./notificationConfig');
const {
  handleListingCampaignEvent,
  handleTransactionCampaignEvent,
  handleUserCreatedCampaigns,
  processDueNotificationJobs,
} = require('./notificationCampaignService');
const { buildSellerWelcomeEmail, isSellerUserType } = require('./marketingCampaigns');
const {
  recordPollCompleted,
  recordPollError,
  recordPollStarted,
} = require('./notificationMetrics');
const { createTTLCache } = require('../api-util/cache');

// Claim and run notifications in parallel; log each rejection independently.
async function runNotifications(tasks, ownerId) {
  const results = await Promise.allSettled(tasks.map(task => deliverNotification(task, ownerId)));
  const unrecordedFailures = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[eventPoller] ${tasks[i].label} delivery failed:`, r.reason);
      if (!r.reason?.notificationOutcomeRecorded) {
        unrecordedFailures.push(r.reason || new Error('Notification delivery rejected'));
      }
    }
  });
  if (unrecordedFailures.length > 0) throw unrecordedFailures[0];
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// Defer the first poll so the dyno's listen() callback returns and the load
// balancer can route a health check before the poller's I/O burst kicks in.
const INITIAL_POLL_DELAY_MS = 5 * 1000;
const LEADERSHIP_RETRY_MS = 30 * 1000;
const RECENT_EVENT_IDS_CAP = 500;
const EVENTS_PER_PAGE = 100;
const DEFAULT_MAX_PAGES_PER_POLL = 10;
const DEFAULT_PAGE_DELAY_MS = 250;
const DEFAULT_LAG_ALERT_MS = 15 * 60 * 1000;

function positiveIntegerEnv(name, fallback, { allowZero = false } = {}) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  const minimum = allowZero ? 0 : 1;
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

// Customer/provider relationships are immutable once a transaction exists, so
// 3 minutes is safe and absorbs message bursts within a single thread.
const TX_RELATIONSHIPS_CACHE_TTL_SECONDS = 180;
const txRelationshipsCache = createTTLCache(TX_RELATIONSHIPS_CACHE_TTL_SECONDS);

async function loadTransactionRelationships(sdk, transactionId) {
  if (!transactionId) return null;
  const { data: cached } = txRelationshipsCache[transactionId] || {};
  if (cached && cached.customerId !== undefined) return cached;

  const res = await sdk.transactions.show({ id: transactionId });
  const tx = res?.data?.data;
  const value = {
    customerId: tx?.relationships?.customer?.data?.id?.uuid || null,
    providerId: tx?.relationships?.provider?.data?.id?.uuid || null,
  };
  txRelationshipsCache[transactionId] = value;
  return value;
}

// Cursor — loaded from PostgreSQL on startup; on a totally fresh boot we look back
// 10 minutes to avoid missing events during deployments.
let lastSequenceId = null;

// Insertion-ordered Set; keeps the last RECENT_EVENT_IDS_CAP processed event
// IDs so a duplicate poll (after restart with overlapping window) skips them.
const recentEventIds = new Set();

// Concurrency guard — a slow poll must not overlap with the next interval tick.
let isPolling = false;

function rememberEventId(eventId) {
  if (!eventId) return;
  if (recentEventIds.has(eventId)) {
    // Re-add to push it to the end of the insertion order.
    recentEventIds.delete(eventId);
  }
  recentEventIds.add(eventId);
  while (recentEventIds.size > RECENT_EVENT_IDS_CAP) {
    const oldest = recentEventIds.values().next().value;
    recentEventIds.delete(oldest);
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleNewUser(eventId, resource, ownerId) {
  const attrs = resource?.attributes;
  if (!attrs) return;

  const email = attrs.email;
  const profile = attrs.profile || {};
  const firstName = profile.firstName || 'Usuario';
  const lastName = profile.lastName || '';
  const phone = profile.protectedData?.phoneNumber || null;
  const userType = profile.publicData?.userType || null;

  console.log(`[eventPoller] New user: ${email}`);

  const tasks = [];
  if (isWelcomeEmailEnabled() && isSellerUserType(userType)) {
    const welcomePayload = buildSellerWelcomeEmail({ email, firstName, lastName });
    tasks.push({
      eventId,
      channel: 'brevo',
      templateName: 'seller_welcome',
      recipient: email,
      payload: welcomePayload,
      label: 'welcome email',
    });
  }
  if (isWhatsAppEnabled()) {
    const adminPhone = getAdminPhone();
    if (adminPhone) {
      tasks.push({
        eventId,
        channel: 'whatsapp',
        templateName: 'av_admin_new_user',
        recipient: adminPhone,
        payload: {
          phone: adminPhone,
          templateName: 'av_admin_new_user',
          params: [firstName, lastName, email],
        },
        label: 'admin WhatsApp alert',
      });
    }
  }
  if (isWhatsAppEnabled() && phone) {
    tasks.push({
      eventId,
      channel: 'whatsapp',
      templateName: 'av_welcome_user',
      recipient: phone,
      payload: {
        phone,
        templateName: 'av_welcome_user',
        params: [firstName],
      },
      label: 'user welcome WhatsApp',
    });
  }

  await runNotifications(tasks, ownerId);
  if (isMarketingCampaignsEnabled()) {
    await handleUserCreatedCampaigns(eventId, resource);
  }
}

// Maps EXACT transition names → WhatsApp templates.
//
// Important: events carry `lastTransition` (the transition name, e.g.
// `transition/confirm-payment`), NOT the resulting state. A previous version
// keyed this map on state/past-tense fragments (`/purchased`, `/cancelled`, …)
// matched with `endsWith`, which silently broke 5 of 6 rules (e.g. `/purchased`
// only matched `transition/mark-received-from-purchased`; `/cancelled`,
// `/accepted`, `/declined`, `/offer-made` matched nothing). Transition names
// are verified against ext/transaction-processes/*/process.edn.
const TRANSITION_RULES = [
  {
    transitions: ['transition/confirm-payment'],
    buyerTemplate: 'av_purchase_confirmed',
    sellerTemplate: 'av_sale_received',
  },
  {
    transitions: ['transition/mark-delivered', 'transition/operator-mark-delivered'],
    buyerTemplate: 'av_delivered',
  },
  {
    transitions: ['transition/cancel', 'transition/auto-cancel', 'transition/operator-cancel'],
    buyerTemplate: 'av_cancelled',
    sellerTemplate: 'av_cancelled',
  },
  {
    transitions: ['transition/accept', 'transition/operator-accept'],
    buyerTemplate: 'av_booking_accepted',
  },
  {
    transitions: ['transition/decline', 'transition/operator-decline'],
    buyerTemplate: 'av_booking_declined',
  },
  {
    transitions: [
      'transition/make-offer',
      'transition/make-offer-after-inquiry',
      'transition/make-offer-from-request',
    ],
    sellerTemplate: 'av_new_message',
  },
];

// Resolve a transition name to its notification rule (or null). Exact match —
// never substring/endsWith — so e.g. `mark-received-from-purchased` does not
// trigger the purchase notification.
function matchTransitionRule(transition) {
  if (!transition) return null;
  return TRANSITION_RULES.find(rule => rule.transitions.includes(transition)) || null;
}

async function handleTransactionEvent(eventId, resource, ownerId) {
  if (isMarketingCampaignsEnabled()) {
    await handleTransactionCampaignEvent(eventId, resource);
  }
  if (!isWhatsAppEnabled()) return;

  const sdk = getIntegrationSdk();
  const attrs = resource?.attributes || {};
  const transition = attrs.lastTransition || '';
  const relationships = resource?.relationships || {};

  // Find matching rule
  const rule = matchTransitionRule(transition);
  if (!rule) return;

  // Resolve user IDs from relationships
  const customerId = relationships.customer?.data?.id?.uuid;
  const providerId = relationships.provider?.data?.id?.uuid;

  const [customerPhone, providerPhone] = await Promise.all([
    customerId ? lookupUserPhone(sdk, customerId) : Promise.resolve(null),
    providerId ? lookupUserPhone(sdk, providerId) : Promise.resolve(null),
  ]);

  const tasks = [];
  if (rule.buyerTemplate && customerPhone) {
    tasks.push({
      eventId,
      channel: 'whatsapp',
      templateName: rule.buyerTemplate,
      recipient: customerPhone,
      payload: { phone: customerPhone, templateName: rule.buyerTemplate },
      label: 'buyer WhatsApp',
    });
  }
  if (rule.sellerTemplate && providerPhone) {
    tasks.push({
      eventId,
      channel: 'whatsapp',
      templateName: rule.sellerTemplate,
      recipient: providerPhone,
      payload: { phone: providerPhone, templateName: rule.sellerTemplate },
      label: 'seller WhatsApp',
    });
  }
  await runNotifications(tasks, ownerId);
}

async function handleListingEvent(eventId, resource) {
  if (!isMarketingCampaignsEnabled()) return;
  await handleListingCampaignEvent(eventId, resource);
}

async function handleMessageEvent(eventId, resource, ownerId) {
  if (!isWhatsAppEnabled()) return;

  const sdk = getIntegrationSdk();
  const relationships = resource?.relationships || {};

  // Determine the recipient: the other party in the transaction
  const transactionId = relationships.transaction?.data?.id?.uuid;
  const senderId = relationships.sender?.data?.id?.uuid;

  if (!transactionId) return;

  const { customerId, providerId } = await loadTransactionRelationships(sdk, transactionId);

  // The recipient is whichever party is NOT the sender
  const recipientId = senderId === customerId ? providerId : customerId;
  if (!recipientId) return;

  const recipientPhone = await lookupUserPhone(sdk, recipientId);
  if (recipientPhone) {
    await runNotifications(
      [
        {
          eventId,
          channel: 'whatsapp',
          templateName: 'av_new_message',
          recipient: recipientPhone,
          payload: { phone: recipientPhone, templateName: 'av_new_message' },
          label: 'message WhatsApp',
        },
      ],
      ownerId
    );
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

async function pollEvents(options = {}) {
  const ownerId = activeOwnerId;
  if (!ownerId) {
    console.warn('[eventPoller] Poll skipped because this process is not the leader');
    return;
  }
  if (isPolling) {
    console.warn('[eventPoller] Previous poll still running — skipping this tick');
    return;
  }
  isPolling = true;
  let completePoll;
  currentPollCompletion = new Promise(resolve => {
    completePoll = resolve;
  });
  const maxPages =
    options.maxPages ||
    positiveIntegerEnv('AV_EVENT_POLLER_MAX_PAGES_PER_POLL', DEFAULT_MAX_PAGES_PER_POLL);
  const pageDelayMs =
    options.pageDelayMs ??
    positiveIntegerEnv('AV_EVENT_POLLER_PAGE_DELAY_MS', DEFAULT_PAGE_DELAY_MS, {
      allowZero: true,
    });
  const lagAlertMs = positiveIntegerEnv('AV_EVENT_POLLER_LAG_ALERT_MS', DEFAULT_LAG_ALERT_MS);
  let pagesProcessed = 0;
  let eventsProcessed = 0;
  let remainingEventCount = null;
  let oldestObservedEventAgeMs = 0;
  let backlogBoundHit = false;
  recordPollStarted();

  try {
    const sdk = getIntegrationSdk();

    while (pagesProcessed < maxPages) {
      const params =
        lastSequenceId != null
          ? { startAfterSequenceId: lastSequenceId, perPage: EVENTS_PER_PAGE }
          : {
              createdAtStart: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
              perPage: EVENTS_PER_PAGE,
            };

      let res;
      try {
        res = await sdk.events.query(params);
      } catch (err) {
        console.error('[eventPoller] Integration API query failed:', err);
        recordPollError(err);
        // Delayed jobs are stored independently and can still be delivered
        // while the event feed is temporarily unavailable.
        break;
      }

      const events = res?.data?.data || [];
      pagesProcessed += 1;
      eventsProcessed += events.length;
      const totalItems = res?.data?.meta?.totalItems;
      remainingEventCount =
        typeof totalItems === 'number' ? Math.max(0, totalItems - events.length) : null;

      if (events.length > 0) {
        console.log(`[eventPoller] Processing page=${pagesProcessed} events=${events.length}`);
        const oldestCreatedAt = events[0]?.attributes?.createdAt;
        const oldestTimestamp = oldestCreatedAt ? Date.parse(oldestCreatedAt) : NaN;
        if (Number.isFinite(oldestTimestamp)) {
          oldestObservedEventAgeMs = Math.max(
            oldestObservedEventAgeMs,
            Date.now() - oldestTimestamp
          );
        }
      }

      const pageStartSequenceId = lastSequenceId;
      const pageStartRecentEventIds = Array.from(recentEventIds);
      try {
        for (const event of events) {
          const { eventType, resource, sequenceId } = event.attributes;
          const eventId = event.id?.uuid || event.id;

          // Skip events we've already processed in a previous (overlapping) poll.
          if (eventId && recentEventIds.has(eventId)) {
            lastSequenceId = sequenceId;
            continue;
          }

          if (eventType === 'user/created') {
            await handleNewUser(eventId, resource, ownerId);
          } else if (
            eventType === 'transaction/initiated' ||
            eventType === 'transaction/transitioned'
          ) {
            await handleTransactionEvent(eventId, resource, ownerId);
            // Spec B: buy the eShip label once payment is confirmed. Independent
            // of the WhatsApp gate above; self-contained failure handling.
            await maybeBuyLabelForEvent(getIntegrationSdk(), resource);
          } else if (eventType === 'message/created') {
            await handleMessageEvent(eventId, resource, ownerId);
          } else if (eventType === 'listing/created' || eventType === 'listing/updated') {
            await handleListingEvent(eventId, resource);
          }

          rememberEventId(eventId);
          lastSequenceId = sequenceId;
        }

        await saveCursor(
          {
            lastSequenceId,
            recentEventIds: Array.from(recentEventIds),
          },
          ownerId
        );
      } catch (err) {
        lastSequenceId = pageStartSequenceId;
        recentEventIds.clear();
        for (const id of pageStartRecentEventIds) rememberEventId(id);
        throw err;
      }

      if (events.length < EVENTS_PER_PAGE) break;
      if (pagesProcessed >= maxPages) {
        backlogBoundHit = true;
        break;
      }
      if (pageDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, pageDelayMs));
      }
    }

    if (isMarketingCampaignsEnabled()) {
      const jobsProcessed = await processDueNotificationJobs(ownerId);
      if (jobsProcessed > 0) {
        console.log(`[eventPoller] Processed due campaign jobs=${jobsProcessed}`);
      }
    }

    const trackingNotificationsProcessed = await processDueEshipTrackingNotifications(ownerId);
    if (trackingNotificationsProcessed > 0) {
      console.log(
        `[eventPoller] Processed eShip tracking notifications=${trackingNotificationsProcessed}`
      );
    }

    const pollMetrics = {
      lastSequenceId,
      pagesProcessed,
      eventsProcessed,
      remainingEventCount,
      sequenceLagEvents: remainingEventCount,
      oldestObservedEventAgeMs,
      backlogBoundHit,
    };
    recordPollCompleted(pollMetrics);
    console.log(`[eventPoller] Poll metrics ${JSON.stringify(pollMetrics)}`);
    if (backlogBoundHit || oldestObservedEventAgeMs >= lagAlertMs) {
      console.error(
        `[notificationAlert] event backlog ${JSON.stringify({
          backlogBoundHit,
          oldestObservedEventAgeMs,
          remainingEventCount,
          sequenceLagEvents: remainingEventCount,
          lastSequenceId,
        })}`
      );
    }
  } catch (err) {
    console.error('[eventPoller] Poll processing failed:', err);
    recordPollError(err);
    throw err;
  } finally {
    isPolling = false;
    currentPollCompletion = null;
    completePoll();
  }
}

/**
 * Start the polling loop. Safe to call multiple times (idempotent via interval ID check).
 */
let pollIntervalId = null;
let initialTimer = null;
let leadershipRetryId = null;
let leadershipAttempt = null;
let leadershipInstance = null;
let leadershipLossUnsubscribe = null;
let activeOwnerId = null;
let isStarted = false;
let currentPollCompletion = null;

function clearPollingTimers() {
  if (initialTimer) clearTimeout(initialTimer);
  if (pollIntervalId) clearInterval(pollIntervalId);
  initialTimer = null;
  pollIntervalId = null;
}

function startPollingTimers() {
  initialTimer = setTimeout(() => {
    initialTimer = null;
    pollEvents().catch(err => console.error('[eventPoller] Initial poll failed:', err));
  }, INITIAL_POLL_DELAY_MS);
  initialTimer.unref?.();

  pollIntervalId = setInterval(() => {
    pollEvents().catch(err => console.error('[eventPoller] Poll failed:', err));
  }, POLL_INTERVAL_MS);
  pollIntervalId.unref?.();
}

function registerLeadershipLossHandler(leadership) {
  if (leadershipLossUnsubscribe) return;

  leadershipLossUnsubscribe = leadership.onLeadershipLost(() => {
    const previousOwnerId = activeOwnerId;
    activeOwnerId = null;
    clearPollingTimers();
    if (previousOwnerId) {
      releaseOwnership(previousOwnerId).catch(err =>
        console.error('[eventPoller] Failed to clear lost owner status:', err)
      );
    }
  });
}

async function attemptLeadership() {
  if (!isStarted || activeOwnerId || isPolling) return Boolean(activeOwnerId);
  if (leadershipAttempt) return leadershipAttempt;

  leadershipAttempt = (async () => {
    const leadership = getLeadership();
    leadershipInstance = leadership;
    registerLeadershipLossHandler(leadership);

    const acquired = await leadership.tryAcquire();
    if (!acquired) return false;

    const ownerId = leadership.leaseId;
    try {
      await claimOwnership(ownerId);
      const seed = await loadCursor();
      if (!isStarted) {
        await Promise.allSettled([releaseOwnership(ownerId), leadership.release()]);
        return false;
      }

      // Always refresh from shared state on leadership acquisition. This is
      // what lets a replacement process continue from the previous leader.
      lastSequenceId = seed.lastSequenceId;
      recentEventIds.clear();
      for (const id of seed.recentEventIds) rememberEventId(id);
      activeOwnerId = ownerId;

      console.log(
        `[eventPoller] Active owner=${ownerId}; lastSequenceId=${lastSequenceId}, dedupe size=${recentEventIds.size}`
      );
      startPollingTimers();
      return true;
    } catch (err) {
      await Promise.allSettled([releaseOwnership(ownerId), leadership.release()]);
      throw err;
    }
  })();

  try {
    return await leadershipAttempt;
  } finally {
    leadershipAttempt = null;
  }
}

async function startPoller() {
  if (isStarted) return;
  isStarted = true;

  console.log('[eventPoller] Starting Integration API event poller coordination (interval: 5 min)');

  leadershipRetryId = setInterval(() => {
    attemptLeadership().catch(err =>
      console.error('[eventPoller] PostgreSQL leadership attempt failed:', err)
    );
  }, LEADERSHIP_RETRY_MS);
  leadershipRetryId.unref?.();

  try {
    await attemptLeadership();
  } catch (err) {
    console.error(
      '[eventPoller] Initial PostgreSQL leadership attempt failed; standby retry remains active:',
      err
    );
  }
}

async function stopPoller() {
  if (!isStarted && !leadershipInstance) return;

  isStarted = false;
  if (leadershipRetryId) clearInterval(leadershipRetryId);
  leadershipRetryId = null;
  clearPollingTimers();

  if (leadershipLossUnsubscribe) leadershipLossUnsubscribe();
  leadershipLossUnsubscribe = null;

  if (leadershipAttempt) {
    await leadershipAttempt.catch(() => {});
  }
  if (currentPollCompletion) {
    await currentPollCompletion;
  }

  const ownerId = activeOwnerId;
  activeOwnerId = null;
  const tasks = [];
  if (ownerId) tasks.push(releaseOwnership(ownerId));
  if (leadershipInstance) tasks.push(leadershipInstance.release());
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[eventPoller] Shutdown cleanup failed:', result.reason);
    }
  }
  leadershipInstance = null;
}

module.exports = { startPoller, stopPoller, pollEvents, matchTransitionRule };
