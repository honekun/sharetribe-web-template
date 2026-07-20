'use strict';

const { TEMPLATE_ENV } = require('./marketingCampaigns');

const FLAG_NAMES = {
  poller: 'AV_NOTIFICATIONS_ENABLED',
  brevo: 'AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED',
  campaigns: 'AV_BREVO_CAMPAIGNS_ENABLED',
  whatsapp: 'AV_WHATSAPP_NOTIFICATIONS_ENABLED',
};

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
  const brevoFlag = readBooleanFlag(FLAG_NAMES.brevo);
  const campaignsFlag = readBooleanFlag(FLAG_NAMES.campaigns);
  const whatsappFlag = readBooleanFlag(FLAG_NAMES.whatsapp);

  const pollerMissing = pollerFlag.enabled
    ? missingVariables([
        'SHARETRIBE_INTEGRATION_CLIENT_ID',
        'SHARETRIBE_INTEGRATION_CLIENT_SECRET',
        'DATABASE_URL',
      ])
    : [];
  const pollerReady = pollerFlag.configured && (!pollerFlag.enabled || pollerMissing.length === 0);
  const channelFlagRequired = pollerFlag.enabled;

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
    ready: pollerReady && brevoReady && campaignsReady && whatsappReady,
    poller: {
      configured: pollerFlag.configured,
      enabled: pollerFlag.enabled,
      ready: pollerReady,
      missing: pollerFlag.configured ? pollerMissing : [FLAG_NAMES.poller],
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
      enabled: pollerFlag.enabled && whatsappFlag.enabled,
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

function isWelcomeEmailEnabled() {
  return isNotificationPollerEnabled() && readBooleanFlag(FLAG_NAMES.brevo).enabled;
}

function isMarketingCampaignsEnabled() {
  return isNotificationPollerEnabled() && readBooleanFlag(FLAG_NAMES.campaigns).enabled;
}

function isWhatsAppEnabled() {
  return isNotificationPollerEnabled() && readBooleanFlag(FLAG_NAMES.whatsapp).enabled;
}

module.exports = {
  FLAG_NAMES,
  assertProductionNotificationConfig,
  getNotificationConfigReadiness,
  isMarketingCampaignsEnabled,
  isNotificationPollerEnabled,
  isWelcomeEmailEnabled,
  isWhatsAppEnabled,
  readBooleanFlag,
};
