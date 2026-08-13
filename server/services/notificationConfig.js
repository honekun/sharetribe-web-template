'use strict';

const { TEMPLATE_ENV } = require('./marketingCampaigns');

const FLAG_NAMES = {
  poller: 'AV_NOTIFICATIONS_ENABLED',
  shippingLabels: 'AV_SHIPPING_LABELS_ENABLED',
  brevo: 'AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED',
  campaigns: 'AV_BREVO_CAMPAIGNS_ENABLED',
  whatsapp: 'AV_WHATSAPP_NOTIFICATIONS_ENABLED',
};

// WhatsApp notifications are intentionally excluded from the first release.
// Keep the dormant configuration and sender code in place for a later reviewed rollout.
const WHATSAPP_NOTIFICATIONS_RELEASED = false;

function readBooleanFlag(name) {
  const raw = process.env[name];
  if (raw === 'true') return { configured: true, enabled: true };
  if (raw === 'false') return { configured: true, enabled: false };
  return { configured: false, enabled: false };
}

function missingVariables(names) {
  return names.filter(name => {
    const value = process.env[name];
    return typeof value !== 'string' || value.trim() === '';
  });
}

function missingTemplateIds(names) {
  return names.filter(
    name => !Number.isInteger(Number(process.env[name])) || Number(process.env[name]) <= 0
  );
}

function getNotificationConfigReadiness() {
  const pollerFlag = readBooleanFlag(FLAG_NAMES.poller);
  const shippingLabelsFlag = readBooleanFlag(FLAG_NAMES.shippingLabels);
  const brevoFlag = readBooleanFlag(FLAG_NAMES.brevo);
  const campaignsFlag = readBooleanFlag(FLAG_NAMES.campaigns);
  const whatsappFlag = readBooleanFlag(FLAG_NAMES.whatsapp);

  const eventPollerEnabled = pollerFlag.enabled || shippingLabelsFlag.enabled;
  const pollerMissing = eventPollerEnabled
    ? missingVariables([
        'SHARETRIBE_INTEGRATION_CLIENT_ID',
        'SHARETRIBE_INTEGRATION_CLIENT_SECRET',
        'DATABASE_URL',
      ])
    : [];
  const missingPollerFlags = [
    ...(pollerFlag.configured ? [] : [FLAG_NAMES.poller]),
    ...(shippingLabelsFlag.configured ? [] : [FLAG_NAMES.shippingLabels]),
  ];
  const pollerReady =
    missingPollerFlags.length === 0 && (!eventPollerEnabled || pollerMissing.length === 0);
  const channelFlagRequired = pollerFlag.enabled;
  const shippingLabelsMissing = shippingLabelsFlag.enabled
    ? missingVariables(['ESHIP_API_KEY', 'ESHIP_BASE_URL'])
    : [];
  const shippingLabelsReady =
    shippingLabelsFlag.configured &&
    (!shippingLabelsFlag.enabled || shippingLabelsMissing.length === 0);

  const brevoMissing =
    pollerFlag.enabled && brevoFlag.enabled
      ? missingVariables(['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME']).concat(
          missingTemplateIds([TEMPLATE_ENV.seller_welcome])
        )
      : [];
  const brevoReady =
    !channelFlagRequired ||
    (brevoFlag.configured && (!brevoFlag.enabled || brevoMissing.length === 0));

  const campaignTemplateVariables = Object.entries(TEMPLATE_ENV)
    .filter(([key]) => key !== 'seller_welcome')
    .map(([, value]) => value);
  const campaignsMissing =
    pollerFlag.enabled && campaignsFlag.enabled
      ? missingVariables([
          'BREVO_API_KEY',
          'BREVO_SENDER_EMAIL',
          'BREVO_SENDER_NAME',
          'BREVO_LIST_ID',
          'BREVO_WEBHOOK_SECRET',
        ]).concat(missingTemplateIds(campaignTemplateVariables))
      : [];
  const campaignsReady =
    !channelFlagRequired ||
    (campaignsFlag.configured && (!campaignsFlag.enabled || campaignsMissing.length === 0));

  const whatsappMissing =
    pollerFlag.enabled && whatsappFlag.enabled
      ? missingVariables([
          'WHATSAPP_ACCESS_TOKEN',
          'WHATSAPP_PHONE_NUMBER_ID',
          'WHATSAPP_ADMIN_PHONE',
        ])
      : [];
  const whatsappReady =
    !channelFlagRequired ||
    (whatsappFlag.configured && (!whatsappFlag.enabled || whatsappMissing.length === 0));

  return {
    ready: pollerReady && shippingLabelsReady && brevoReady && campaignsReady && whatsappReady,
    poller: {
      configured: missingPollerFlags.length === 0,
      enabled: eventPollerEnabled,
      ready: pollerReady,
      missing: [...missingPollerFlags, ...pollerMissing],
    },
    shippingLabels: {
      configured: shippingLabelsFlag.configured,
      enabled: shippingLabelsFlag.enabled,
      ready: shippingLabelsReady,
      missing: shippingLabelsFlag.configured ? shippingLabelsMissing : [FLAG_NAMES.shippingLabels],
    },
    brevo: {
      configured: brevoFlag.configured,
      enabled: pollerFlag.enabled && brevoFlag.enabled,
      ready: brevoReady,
      missing: channelFlagRequired && !brevoFlag.configured ? [FLAG_NAMES.brevo] : brevoMissing,
    },
    campaigns: {
      configured: campaignsFlag.configured,
      enabled: pollerFlag.enabled && campaignsFlag.enabled,
      ready: campaignsReady,
      missing:
        channelFlagRequired && !campaignsFlag.configured
          ? [FLAG_NAMES.campaigns]
          : campaignsMissing,
    },
    whatsapp: {
      configured: whatsappFlag.configured,
      enabled: WHATSAPP_NOTIFICATIONS_RELEASED && pollerFlag.enabled && whatsappFlag.enabled,
      releaseLocked: !WHATSAPP_NOTIFICATIONS_RELEASED,
      ready: whatsappReady,
      missing:
        channelFlagRequired && !whatsappFlag.configured ? [FLAG_NAMES.whatsapp] : whatsappMissing,
    },
  };
}

function assertProductionNotificationConfig() {
  const readiness = getNotificationConfigReadiness();
  if (process.env.NODE_ENV === 'production' && !readiness.ready) {
    const missing = [
      ...readiness.poller.missing,
      ...readiness.shippingLabels.missing,
      ...readiness.brevo.missing,
      ...readiness.campaigns.missing,
      ...readiness.whatsapp.missing,
    ];
    throw new Error(
      `Notification configuration is incomplete: ${[...new Set(missing)].join(', ')}`
    );
  }
  return readiness;
}

function isNotificationPollerEnabled() {
  return readBooleanFlag(FLAG_NAMES.poller).enabled;
}

function isShippingLabelsEnabled() {
  return readBooleanFlag(FLAG_NAMES.shippingLabels).enabled;
}

function isEventPollerEnabled() {
  return isNotificationPollerEnabled() || isShippingLabelsEnabled();
}

function isWelcomeEmailEnabled() {
  return isNotificationPollerEnabled() && readBooleanFlag(FLAG_NAMES.brevo).enabled;
}

function isMarketingCampaignsEnabled() {
  return isNotificationPollerEnabled() && readBooleanFlag(FLAG_NAMES.campaigns).enabled;
}

function isWhatsAppEnabled() {
  return (
    WHATSAPP_NOTIFICATIONS_RELEASED &&
    isNotificationPollerEnabled() &&
    readBooleanFlag(FLAG_NAMES.whatsapp).enabled
  );
}

module.exports = {
  FLAG_NAMES,
  WHATSAPP_NOTIFICATIONS_RELEASED,
  assertProductionNotificationConfig,
  getNotificationConfigReadiness,
  isEventPollerEnabled,
  isMarketingCampaignsEnabled,
  isNotificationPollerEnabled,
  isShippingLabelsEnabled,
  isWelcomeEmailEnabled,
  isWhatsAppEnabled,
  readBooleanFlag,
};
