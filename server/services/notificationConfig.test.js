'use strict';

const {
  assertProductionNotificationConfig,
  getNotificationConfigReadiness,
  isWhatsAppEnabled,
} = require('./notificationConfig');

const ORIGINAL_ENV = process.env;

describe('notification configuration readiness', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    [
      'AV_NOTIFICATIONS_ENABLED',
      'AV_SHIPPING_LABELS_ENABLED',
      'AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED',
      'AV_BREVO_CAMPAIGNS_ENABLED',
      'AV_WHATSAPP_NOTIFICATIONS_ENABLED',
      'SHARETRIBE_INTEGRATION_CLIENT_ID',
      'SHARETRIBE_INTEGRATION_CLIENT_SECRET',
      'DATABASE_URL',
      'BREVO_API_KEY',
      'BREVO_SENDER_EMAIL',
      'BREVO_SENDER_NAME',
      'BREVO_LIST_ID',
      'BREVO_WEBHOOK_SECRET',
      'BREVO_TEMPLATE_SELLER_WELCOME',
      'BREVO_TEMPLATE_VIEWED_LISTING_A',
      'BREVO_TEMPLATE_VIEWED_LISTING_B',
      'BREVO_TEMPLATE_ABANDONED_CHECKOUT',
      'BREVO_TEMPLATE_MATCHING_LISTINGS_A',
      'BREVO_TEMPLATE_MATCHING_LISTINGS_B',
      'BREVO_TEMPLATE_SIGNUP_NO_LISTING',
      'BREVO_TEMPLATE_LISTING_NO_ACTIVITY',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ADMIN_PHONE',
    ].forEach(name => delete process.env[name]);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('accepts explicit global disablement without provider secrets', () => {
    process.env.AV_NOTIFICATIONS_ENABLED = 'false';
    process.env.AV_SHIPPING_LABELS_ENABLED = 'false';

    const readiness = getNotificationConfigReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.poller).toEqual(
      expect.objectContaining({ configured: true, enabled: false, ready: true })
    );
  });

  test('identifies each incomplete enabled channel independently', () => {
    process.env.AV_NOTIFICATIONS_ENABLED = 'true';
    process.env.AV_SHIPPING_LABELS_ENABLED = 'false';
    process.env.AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED = 'true';
    process.env.AV_BREVO_CAMPAIGNS_ENABLED = 'true';
    process.env.AV_WHATSAPP_NOTIFICATIONS_ENABLED = 'true';

    const readiness = getNotificationConfigReadiness();

    expect(readiness.ready).toBe(false);
    expect(readiness.poller.missing).toEqual(
      expect.arrayContaining([
        'SHARETRIBE_INTEGRATION_CLIENT_ID',
        'SHARETRIBE_INTEGRATION_CLIENT_SECRET',
        'DATABASE_URL',
      ])
    );
    expect(readiness.brevo.missing).toContain('BREVO_API_KEY');
    expect(readiness.whatsapp.missing).toContain('WHATSAPP_ACCESS_TOKEN');
  });

  test('is ready when enabled services have complete configuration', () => {
    Object.assign(process.env, {
      AV_NOTIFICATIONS_ENABLED: 'true',
      AV_SHIPPING_LABELS_ENABLED: 'false',
      AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'true',
      AV_BREVO_CAMPAIGNS_ENABLED: 'false',
      AV_WHATSAPP_NOTIFICATIONS_ENABLED: 'false',
      SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
      DATABASE_URL: 'postgresql://localhost/database',
      BREVO_API_KEY: 'brevo-key',
      BREVO_SENDER_EMAIL: 'sender@example.com',
      BREVO_SENDER_NAME: 'Sender',
      BREVO_TEMPLATE_SELLER_WELCOME: '101',
    });

    expect(getNotificationConfigReadiness()).toEqual(
      expect.objectContaining({
        ready: true,
        brevo: expect.objectContaining({ enabled: true, ready: true }),
        whatsapp: expect.objectContaining({ enabled: false, ready: true }),
      })
    );
  });

  test('keeps WhatsApp release-locked even when its environment flag is true', () => {
    Object.assign(process.env, {
      AV_NOTIFICATIONS_ENABLED: 'true',
      AV_SHIPPING_LABELS_ENABLED: 'false',
      AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'false',
      AV_BREVO_CAMPAIGNS_ENABLED: 'false',
      AV_WHATSAPP_NOTIFICATIONS_ENABLED: 'true',
      SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
      DATABASE_URL: 'postgresql://localhost/database',
      WHATSAPP_ACCESS_TOKEN: 'meta-token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
      WHATSAPP_ADMIN_PHONE: '+525500000001',
    });

    const readiness = getNotificationConfigReadiness();

    expect(readiness.whatsapp).toEqual(
      expect.objectContaining({ enabled: false, releaseLocked: true, ready: true })
    );
    expect(isWhatsAppEnabled()).toBe(false);
  });

  test('requires all campaign templates, list, and webhook configuration when campaigns are on', () => {
    Object.assign(process.env, {
      AV_NOTIFICATIONS_ENABLED: 'true',
      AV_SHIPPING_LABELS_ENABLED: 'false',
      AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'false',
      AV_BREVO_CAMPAIGNS_ENABLED: 'true',
      AV_WHATSAPP_NOTIFICATIONS_ENABLED: 'false',
      SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
      DATABASE_URL: 'postgresql://localhost/database',
      BREVO_API_KEY: 'brevo-key',
      BREVO_LIST_ID: '42',
      BREVO_SENDER_EMAIL: 'sender@example.com',
      BREVO_SENDER_NAME: 'Sender',
      BREVO_WEBHOOK_SECRET: 'webhook-secret',
      BREVO_TEMPLATE_VIEWED_LISTING_A: '201',
      BREVO_TEMPLATE_VIEWED_LISTING_B: '202',
      BREVO_TEMPLATE_ABANDONED_CHECKOUT: '203',
      BREVO_TEMPLATE_MATCHING_LISTINGS_A: '204',
      BREVO_TEMPLATE_MATCHING_LISTINGS_B: '205',
      BREVO_TEMPLATE_SIGNUP_NO_LISTING: '206',
      BREVO_TEMPLATE_LISTING_NO_ACTIVITY: '207',
    });

    expect(getNotificationConfigReadiness()).toEqual(
      expect.objectContaining({
        ready: true,
        campaigns: expect.objectContaining({ enabled: true, ready: true, missing: [] }),
      })
    );

    delete process.env.BREVO_TEMPLATE_MATCHING_LISTINGS_B;
    expect(getNotificationConfigReadiness().campaigns.missing).toContain(
      'BREVO_TEMPLATE_MATCHING_LISTINGS_B'
    );
  });

  test('production startup rejects implicit or incomplete configuration', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertProductionNotificationConfig()).toThrow(
      'Notification configuration is incomplete'
    );
  });

  test('treats whitespace-only secrets as missing', () => {
    process.env.AV_NOTIFICATIONS_ENABLED = 'true';
    process.env.AV_SHIPPING_LABELS_ENABLED = 'false';
    process.env.AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED = 'false';
    process.env.AV_BREVO_CAMPAIGNS_ENABLED = 'false';
    process.env.AV_WHATSAPP_NOTIFICATIONS_ENABLED = 'false';
    process.env.SHARETRIBE_INTEGRATION_CLIENT_ID = 'integration-id';
    process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET = '   ';
    process.env.DATABASE_URL = 'postgresql://localhost/database';

    expect(getNotificationConfigReadiness().poller.missing).toContain(
      'SHARETRIBE_INTEGRATION_CLIENT_SECRET'
    );
  });

  test('can enable automatic shipping labels without enabling notifications', () => {
    Object.assign(process.env, {
      AV_NOTIFICATIONS_ENABLED: 'false',
      AV_SHIPPING_LABELS_ENABLED: 'true',
      SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
      DATABASE_URL: 'postgresql://localhost/database',
      ESHIP_API_KEY: 'eship-key',
      ESHIP_BASE_URL: 'https://api.myeship.co/rest',
    });

    const readiness = getNotificationConfigReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.poller).toEqual(expect.objectContaining({ enabled: true, ready: true }));
    expect(readiness.shippingLabels).toEqual(
      expect.objectContaining({ enabled: true, ready: true })
    );
    expect(readiness.brevo.enabled).toBe(false);
  });

  test('requires eShip settings only when automatic labels are enabled', () => {
    Object.assign(process.env, {
      AV_NOTIFICATIONS_ENABLED: 'false',
      AV_SHIPPING_LABELS_ENABLED: 'true',
      SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
      DATABASE_URL: 'postgresql://localhost/database',
    });

    expect(getNotificationConfigReadiness().shippingLabels.missing).toEqual(
      expect.arrayContaining(['ESHIP_API_KEY', 'ESHIP_BASE_URL'])
    );
  });
});
