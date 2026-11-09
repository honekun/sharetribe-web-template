'use strict';

// Operator retry entry point (`yarn notifications:retry`).
//
// Essential mail (seller welcome, transactional) replays its stored payload
// through notificationDelivery.retryNotification. Promotional mail is never
// replayed as stored: it goes back through the campaign policy — current user,
// consent and suppression, frequency cap, campaign and resource state — and a
// successful retry is recorded on its job like any send (audit A08).

const { createDeliveryStore, retryNotification } = require('./notificationDelivery');
const { promotionalCampaignForDelivery } = require('./marketingCampaigns');

/**
 * @returns {Promise<
 *   {status: 'sent'|'deduplicated'}
 *   | {status: 'refused', reason: string, retryAfter?: Date}
 *   | {status: 'not_found'}
 *   | {status: 'not_retryable'}
 * >}
 */
async function retryDelivery(
  key,
  { confirmUnknown = false, claimedBy = 'operator' } = {},
  deps = {}
) {
  const deliveryStore = deps.deliveryStore || createDeliveryStore();
  const delivery = await deliveryStore.get(key);
  if (!delivery) return { status: 'not_found' };

  if (!promotionalCampaignForDelivery(delivery)) {
    const result = await retryNotification(key, { confirmUnknown, claimedBy }, deliveryStore);
    return result || { status: 'not_retryable' };
  }

  // Required lazily: the campaign service pulls in the Integration SDK and
  // every campaign store, which essential retries do not need.
  const { getIntegrationSdk } = require('./integrationSdk');
  const { createMarketingConsentStore } = require('./marketingConsent');
  const {
    createMarketingEngagementStore,
    createNotificationJobStore,
  } = require('./notificationJobs');
  const { retryPromotionalDelivery } = require('./notificationCampaignService');

  return retryPromotionalDelivery(
    delivery,
    { confirmUnknown, claimedBy },
    {
      sdk: deps.sdk || getIntegrationSdk(),
      jobStore: deps.jobStore || createNotificationJobStore(),
      consentStore: deps.consentStore || createMarketingConsentStore(),
      engagementStore: deps.engagementStore || createMarketingEngagementStore(),
      deliveryStore,
    }
  );
}

module.exports = { retryDelivery };
