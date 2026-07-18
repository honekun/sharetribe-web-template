'use strict';

const FLAG_NAMES = {
  poller: 'AV_NOTIFICATIONS_ENABLED',
  brevo: 'AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED',
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

function getNotificationConfigReadiness() {
  const pollerFlag = readBooleanFlag(FLAG_NAMES.poller);
  const brevoFlag = readBooleanFlag(FLAG_NAMES.brevo);
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
      ? missingVariables(['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME'])
      : [];
  const brevoReady =
    !channelFlagRequired ||
    (brevoFlag.configured && (!brevoFlag.enabled || brevoMissing.length === 0));

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
    ready: pollerReady && brevoReady && whatsappReady,
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

function isWhatsAppEnabled() {
  return isNotificationPollerEnabled() && readBooleanFlag(FLAG_NAMES.whatsapp).enabled;
}

module.exports = {
  FLAG_NAMES,
  assertProductionNotificationConfig,
  getNotificationConfigReadiness,
  isNotificationPollerEnabled,
  isWelcomeEmailEnabled,
  isWhatsAppEnabled,
  readBooleanFlag,
};
