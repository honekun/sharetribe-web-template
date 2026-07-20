'use strict';

const moment = require('moment-timezone');

const { getIntegrationSdk } = require('./integrationSdk');
const { createMarketingConsentStore } = require('./marketingConsent');
const {
  buildCampaignEmail,
  isPromotionalCampaign,
  isSellerUserType,
} = require('./marketingCampaigns');
const {
  createMarketingEngagementStore,
  createNotificationJobStore,
} = require('./notificationJobs');
const { deliverNotification } = require('./notificationDelivery');
const { normalizeEmail } = require('./emailAddress');

const MARKETPLACE_TIME_ZONE = 'America/Mexico_City';
const VIEW_DELAY_MS = 24 * 60 * 60 * 1000;
const ABANDONED_DELAY_MS = 30 * 60 * 1000;
const SIGNUP_DELAY_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_DELAY_MS = 72 * 60 * 60 * 1000;
const ACTION_TRANSITIONS = new Set([
  'transition/inquire',
  'transition/request-payment',
  'transition/request-payment-after-inquiry',
  'transition/confirm-payment',
]);
const PURCHASE_TRANSITIONS = new Set(['transition/confirm-payment']);
const ABANDONED_CANCEL_TRANSITIONS = new Set([
  'transition/confirm-payment',
  'transition/cancel',
  'transition/auto-cancel',
  'transition/operator-cancel',
]);

function uuid(resourceOrRelationship) {
  const id = resourceOrRelationship?.id || resourceOrRelationship?.data?.id;
  return id?.uuid || id || null;
}

function slugify(value) {
  return String(value || 'listing')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value || null;
}

function listingSnapshot(resource, included = []) {
  const attributes = resource?.attributes || {};
  const publicData = attributes.publicData || {};
  const listingId = uuid(resource);
  const imageId = uuid(resource?.relationships?.images?.data?.[0]);
  const image = included.find(item => item.type === 'image' && uuid(item) === imageId);
  const authorId = uuid(resource?.relationships?.author);
  const author = included.find(item => item.type === 'user' && uuid(item) === authorId);
  const variants = image?.attributes?.variants || {};
  const imageUrl =
    variants['scaled-small']?.url ||
    variants['landscape-crop']?.url ||
    variants.default?.url ||
    null;
  const price = attributes.price || {};

  return {
    id: listingId,
    title: attributes.title || '',
    slug: slugify(attributes.title),
    path: listingId ? `/l/${slugify(attributes.title)}/${listingId}` : '',
    price: {
      amount: typeof price.amount === 'number' ? price.amount : Number(price.amount) || null,
      currency: price.currency || 'MXN',
    },
    priceFormatted:
      Number.isFinite(Number(price.amount)) && price.currency === 'MXN'
        ? new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(Number(price.amount) / 100)
        : '',
    closet:
      author?.attributes?.profile?.displayName || author?.attributes?.profile?.firstName || '',
    imageUrl,
    category: publicData.categoryLevel1 || publicData.category || publicData.categoryLevel2 || null,
    brand: firstValue(publicData.brand),
    sizes: Array.isArray(publicData.all_sizes)
      ? publicData.all_sizes
      : publicData.all_sizes
      ? [publicData.all_sizes]
      : publicData.size
      ? [publicData.size]
      : [],
    colors: Array.isArray(publicData.color)
      ? publicData.color
      : publicData.color
      ? [publicData.color]
      : [],
    state: attributes.state || null,
  };
}

function userSnapshot(resource) {
  const attributes = resource?.attributes || {};
  const profile = attributes.profile || {};
  return {
    id: uuid(resource),
    email: normalizeEmail(attributes.email),
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    userType: profile.publicData?.userType || null,
    protectedData: profile.protectedData || {},
  };
}

function transactionRelationships(resource) {
  return {
    id: uuid(resource),
    listingId: uuid(resource?.relationships?.listing),
    customerId: uuid(resource?.relationships?.customer),
    providerId: uuid(resource?.relationships?.provider),
  };
}

async function loadUser(sdk, userId) {
  if (!userId) return null;
  const response = await sdk.users.show({ id: userId });
  return userSnapshot(response?.data?.data);
}

async function loadListing(sdk, listingId) {
  if (!listingId) return null;
  const response = await sdk.listings.show({
    id: listingId,
    include: ['images', 'author'],
    'fields.image': ['variants.scaled-small', 'variants.landscape-crop'],
  });
  return {
    resource: response?.data?.data,
    snapshot: listingSnapshot(response?.data?.data, response?.data?.included || []),
  };
}

function nextDigestAt(now = new Date()) {
  const localNow = moment.tz(now, MARKETPLACE_TIME_ZONE);
  const next = localNow
    .clone()
    .hour(9)
    .minute(0)
    .second(0)
    .millisecond(0);
  if (!next.isAfter(localNow)) next.add(1, 'day');
  return next.toDate();
}

function digestDateKey(dueAt) {
  return moment.tz(dueAt, MARKETPLACE_TIME_ZONE).format('YYYY-MM-DD');
}

function overlap(left = [], right = []) {
  return left.some(value => right.includes(value));
}

function matchScore(listing, behavior) {
  if (!listing?.category || listing.category !== behavior?.category) return 0;
  let score = 10;
  if (listing.brand && listing.brand === behavior.brand) score += 3;
  if (overlap(listing.sizes, behavior.sizes)) score += 2;
  if (overlap(listing.colors, behavior.colors)) score += 1;
  return score;
}

async function handleUserCreatedCampaigns(
  eventId,
  resource,
  { jobStore = createNotificationJobStore(), consentStore = createMarketingConsentStore() } = {}
) {
  const user = userSnapshot(resource);
  if (!user.id || !user.email) return;

  if (user.protectedData.marketingConsent === true) {
    await consentStore.setPreference({
      email: user.email,
      enabled: true,
      source: user.protectedData.marketingConsentSource || 'signup_email',
      locale: user.protectedData.marketingConsentLocale || 'es',
      policyVersion: user.protectedData.marketingConsentPolicyVersion,
      sharetribeUserId: user.id,
      occurredAt: user.protectedData.marketingConsentAt || new Date().toISOString(),
    });
  }

  if (!isSellerUserType(user.userType)) return;
  const createdAt = resource?.attributes?.createdAt || new Date().toISOString();
  await jobStore.schedule({
    jobKey: `signup-no-listing:${user.id}`,
    campaign: 'signup_no_listing',
    sharetribeUserId: user.id,
    recipientEmail: user.email,
    resourceId: user.id,
    triggerEventId: eventId,
    payload: { firstName: user.firstName, createdAt },
    dueAt: new Date(new Date(createdAt).getTime() + SIGNUP_DELAY_MS),
  });
}

async function handleListingCampaignEvent(
  eventId,
  resource,
  {
    sdk = getIntegrationSdk(),
    jobStore = createNotificationJobStore(),
    engagementStore = createMarketingEngagementStore(),
  } = {}
) {
  const listingId = uuid(resource);
  if (!listingId) return;
  const state = resource?.attributes?.state;
  const authorId = uuid(resource?.relationships?.author);

  if (state && state !== 'published') {
    await jobStore.cancel({ campaign: 'listing_no_activity', resourceId: listingId });
    return;
  }
  if (state !== 'published') return;

  const publishedAt =
    resource?.attributes?.updatedAt || resource?.attributes?.createdAt || new Date().toISOString();
  const isFirstPublication = await jobStore.claimListingPublication({
    listingId,
    authorId,
    publishedAt,
    eventId,
  });
  if (!isFirstPublication) return;

  const [author, loadedListing] = await Promise.all([
    loadUser(sdk, authorId),
    loadListing(sdk, listingId),
  ]);
  const listing = loadedListing?.snapshot || listingSnapshot(resource);
  if (!author || !listing.id) return;

  await jobStore.cancel({ campaign: 'signup_no_listing', sharetribeUserId: author.id });
  if (isSellerUserType(author.userType)) {
    await jobStore.schedule({
      jobKey: `listing-no-activity:${listing.id}`,
      campaign: 'listing_no_activity',
      sharetribeUserId: author.id,
      recipientEmail: author.email,
      resourceId: listing.id,
      triggerEventId: eventId,
      payload: { firstName: author.firstName, listing, publishedAt },
      dueAt: new Date(new Date(publishedAt).getTime() + INACTIVITY_DELAY_MS),
    });
  }

  const matchingUsers = await engagementStore.matchingUsers(listing);
  const dueAt = nextDigestAt();
  await Promise.all(
    matchingUsers
      .filter(user => user.sharetribeUserId !== author.id)
      .map(user =>
        jobStore.appendMatchingListing({
          jobKey: `matching-listings:${user.sharetribeUserId}:${digestDateKey(dueAt)}`,
          sharetribeUserId: user.sharetribeUserId,
          recipientEmail: user.email,
          triggerEventId: eventId,
          dueAt,
          firstName: user.firstName,
          listing: { ...listing, score: matchScore(listing, user.listingData) },
        })
      )
  );
}

async function recordTransactionEngagement({
  sdk,
  engagementStore,
  transaction,
  transition,
  occurredAt,
}) {
  if (!ACTION_TRANSITIONS.has(transition) || !transaction.customerId || !transaction.listingId) {
    return;
  }
  const [customer, listingResult] = await Promise.all([
    loadUser(sdk, transaction.customerId),
    loadListing(sdk, transaction.listingId),
  ]);
  if (!customer || !listingResult?.snapshot) return;
  await engagementStore.record({
    sharetribeUserId: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    action: PURCHASE_TRANSITIONS.has(transition) ? 'purchase' : 'inquiry',
    listingId: transaction.listingId,
    listingAuthorId: transaction.providerId,
    listingData: listingResult.snapshot,
    occurredAt,
  });
}

async function handleTransactionCampaignEvent(
  eventId,
  resource,
  {
    sdk = getIntegrationSdk(),
    jobStore = createNotificationJobStore(),
    engagementStore = createMarketingEngagementStore(),
  } = {}
) {
  const attributes = resource?.attributes || {};
  const transition = attributes.lastTransition || '';
  const transaction = transactionRelationships(resource);
  const occurredAt =
    attributes.lastTransitionedAt || attributes.updatedAt || new Date().toISOString();

  if (transaction.customerId && transaction.listingId && ACTION_TRANSITIONS.has(transition)) {
    await jobStore.cancel({
      campaign: 'viewed_listing',
      sharetribeUserId: transaction.customerId,
      resourceId: transaction.listingId,
    });
  }
  if (transaction.id && ABANDONED_CANCEL_TRANSITIONS.has(transition)) {
    await jobStore.cancel({ campaign: 'abandoned_checkout', resourceId: transaction.id });
  }

  await recordTransactionEngagement({
    sdk,
    engagementStore,
    transaction,
    transition,
    occurredAt,
  });

  if (
    transition !== 'transition/expire-payment' ||
    !transaction.customerId ||
    !transaction.listingId
  ) {
    return;
  }
  const [customer, listingResult] = await Promise.all([
    loadUser(sdk, transaction.customerId),
    loadListing(sdk, transaction.listingId),
  ]);
  if (!customer || !listingResult?.snapshot) return;
  await jobStore.schedule({
    jobKey: `abandoned-checkout:${transaction.id}`,
    campaign: 'abandoned_checkout',
    sharetribeUserId: customer.id,
    recipientEmail: customer.email,
    resourceId: transaction.id,
    triggerEventId: eventId,
    payload: {
      firstName: customer.firstName,
      listing: listingResult.snapshot,
      transactionId: transaction.id,
      expiredAt: occurredAt,
    },
    dueAt: new Date(new Date(occurredAt).getTime() + ABANDONED_DELAY_MS),
  });
}

async function recordListingEngagement(
  { user, listingResource, included = [], action, occurredAt = new Date().toISOString() },
  {
    jobStore = createNotificationJobStore(),
    engagementStore = createMarketingEngagementStore(),
  } = {}
) {
  const listing = listingSnapshot(listingResource, included);
  const listingAuthorId = uuid(listingResource?.relationships?.author);
  const isAuthenticated = Boolean(user?.id && user?.email);
  if (!listing.id || user?.id === listingAuthorId || (action === 'favorite' && !isAuthenticated)) {
    return null;
  }

  await engagementStore.record({
    sharetribeUserId: isAuthenticated ? user.id : null,
    email: isAuthenticated ? user.email : null,
    firstName: isAuthenticated ? user.firstName : null,
    action,
    listingId: listing.id,
    listingAuthorId,
    listingData: listing,
    occurredAt,
  });

  if (action === 'favorite') {
    await jobStore.cancel({
      campaign: 'viewed_listing',
      sharetribeUserId: user.id,
      resourceId: listing.id,
    });
    return { recorded: true, scheduled: false };
  }
  if (action === 'view') {
    if (!isAuthenticated) return { recorded: true, scheduled: false };
    await jobStore.schedule({
      jobKey: `viewed-listing:${user.id}:${listing.id}`,
      campaign: 'viewed_listing',
      sharetribeUserId: user.id,
      recipientEmail: user.email,
      resourceId: listing.id,
      payload: { firstName: user.firstName, listing, viewedAt: occurredAt },
      dueAt: new Date(new Date(occurredAt).getTime() + VIEW_DELAY_MS),
      refreshDueAt: true,
    });
    return { recorded: true, scheduled: true };
  }
  return { recorded: true, scheduled: false };
}

async function campaignStillEligible(job, { sdk, engagementStore }) {
  const payload = job.payload || {};
  if (job.campaign === 'signup_no_listing') {
    const response = await sdk.listings.query({
      authorId: job.sharetribe_user_id,
      states: ['published'],
      perPage: 1,
    });
    return (response?.data?.data || []).length === 0;
  }
  if (job.campaign === 'viewed_listing') {
    const listingResult = await loadListing(sdk, job.resource_id);
    if (listingResult?.snapshot?.state !== 'published') return false;
    return !(await engagementStore.hasActionSince({
      sharetribeUserId: job.sharetribe_user_id,
      listingId: job.resource_id,
      actions: ['favorite', 'inquiry', 'purchase'],
      since: payload.viewedAt,
    }));
  }
  if (job.campaign === 'abandoned_checkout') {
    const response = await sdk.transactions.show({ id: job.resource_id });
    return response?.data?.data?.attributes?.lastTransition === 'transition/expire-payment';
  }
  if (job.campaign === 'listing_no_activity') {
    const listingResult = await loadListing(sdk, job.resource_id);
    if (listingResult?.snapshot?.state !== 'published') return false;
    return !(await engagementStore.hasActionSince({
      listingId: job.resource_id,
      actions: ['view', 'favorite', 'inquiry', 'purchase'],
      since: payload.publishedAt,
    }));
  }
  if (job.campaign === 'matching_listings') {
    const candidates = Array.isArray(payload.listings) ? payload.listings : [];
    const currentListings = await Promise.all(
      candidates.map(candidate => loadListing(sdk, candidate.id).catch(() => null))
    );
    payload.listings = currentListings
      .filter(result => result?.snapshot?.state === 'published')
      .map(result => {
        const stored = candidates.find(candidate => candidate.id === result.snapshot.id);
        return { ...result.snapshot, score: stored?.score || 0 };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
    return payload.listings.length > 0;
  }
  return true;
}

async function processJob(job, { ownerId, sdk, jobStore, consentStore, engagementStore }) {
  try {
    const user = await loadUser(sdk, job.sharetribe_user_id);
    if (!user || user.email !== normalizeEmail(job.recipient_email)) {
      await jobStore.finish(job.id, 'skipped', 'recipient_email_changed');
      return;
    }

    if (isPromotionalCampaign(job.campaign)) {
      const consented = await consentStore.isEligible({
        email: user.email,
        sharetribeUserId: user.id,
      });
      if (!consented) {
        await jobStore.finish(job.id, 'skipped', 'marketing_consent_missing');
        return;
      }
      const nextAvailableAt = await jobStore.promotionalNextAvailableAt(user.id);
      if (nextAvailableAt && nextAvailableAt > new Date()) {
        await jobStore.defer(job.id, nextAvailableAt, 'promotional_frequency_cap');
        return;
      }
    }

    if (!(await campaignStillEligible(job, { sdk, engagementStore }))) {
      await jobStore.finish(job.id, 'skipped', 'campaign_no_longer_eligible');
      return;
    }

    const emailPayload = buildCampaignEmail({
      campaign: job.campaign,
      recipientKey: user.id,
      email: user.email,
      firstName: user.firstName || job.payload?.firstName,
      payload: job.payload,
    });
    const result = await deliverNotification(
      {
        eventId: job.trigger_event_id || job.job_key,
        channel: 'brevo',
        templateName: emailPayload.templateName,
        recipient: user.email,
        payload: emailPayload,
      },
      ownerId
    );
    await jobStore.finish(job.id, 'sent', result.status === 'deduplicated' ? 'deduplicated' : null);
  } catch (err) {
    const status = err?.notificationOutcome === 'unknown' ? 'unknown' : 'failed';
    await jobStore.finish(job.id, status, err.message);
    console.error(`[notificationCampaigns] job=${job.job_key} failed:`, err);
  }
}

async function processDueNotificationJobs(
  ownerId,
  {
    sdk = getIntegrationSdk(),
    jobStore = createNotificationJobStore(),
    consentStore = createMarketingConsentStore(),
    engagementStore = createMarketingEngagementStore(),
  } = {}
) {
  const jobs = await jobStore.claimDue(ownerId);
  const jobsByUser = jobs.reduce((groups, job) => {
    const key = job.sharetribe_user_id || `job:${job.id}`;
    const group = groups.get(key) || [];
    group.push(job);
    groups.set(key, group);
    return groups;
  }, new Map());

  await Promise.all(
    Array.from(jobsByUser.values()).map(async userJobs => {
      // Jobs for different users can run concurrently. A single user's jobs
      // run in due order so each successful send is visible to the rolling
      // frequency-cap query before that user's next job is considered.
      for (const job of userJobs) {
        await processJob(job, { ownerId, sdk, jobStore, consentStore, engagementStore });
      }
    })
  );
  return jobs.length;
}

module.exports = {
  ABANDONED_DELAY_MS,
  INACTIVITY_DELAY_MS,
  MARKETPLACE_TIME_ZONE,
  SIGNUP_DELAY_MS,
  VIEW_DELAY_MS,
  digestDateKey,
  handleListingCampaignEvent,
  handleTransactionCampaignEvent,
  handleUserCreatedCampaigns,
  listingSnapshot,
  matchScore,
  nextDigestAt,
  processDueNotificationJobs,
  recordListingEngagement,
  slugify,
  transactionRelationships,
  userSnapshot,
};
