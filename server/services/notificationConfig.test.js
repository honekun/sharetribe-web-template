'use strict';

const {
  assertProductionNotificationConfig,
  getNotificationConfigReadiness,
} = require('./notificationConfig');

const ORIGINAL_ENV = process.env;

describe('notification configuration readiness', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    [
      'AV_NOTIFICATIONS_ENABLED',
      'AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED',
      'AV_WHATSAPP_NOTIFICATIONS_ENABLED',
      'SHARETRIBE_INTEGRATION_CLIENT_ID',
      'SHARETRIBE_INTEGRATION_CLIENT_SECRET',
      'DATABASE_URL',
      'BREVO_API_KEY',
      'BREVO_SENDER_EMAIL',
      'BREVO_SENDER_NAME',
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

    const readiness = getNotificationConfigReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.poller).toEqual(
      expect.objectContaining({ configured: true, enabled: false, ready: true })
    );
  });

  test('identifies each incomplete enabled channel independently', () => {
    process.env.AV_NOTIFICATIONS_ENABLED = 'true';
    process.env.AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED = 'true';
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
      AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED: 'true',
      AV_WHATSAPP_NOTIFICATIONS_ENABLED: 'false',
      SHARETRIBE_INTEGRATION_CLIENT_ID: 'integration-id',
      SHARETRIBE_INTEGRATION_CLIENT_SECRET: 'integration-secret',
      DATABASE_URL: 'postgresql://localhost/database',
      BREVO_API_KEY: 'brevo-key',
      BREVO_SENDER_EMAIL: 'sender@example.com',
      BREVO_SENDER_NAME: 'Sender',
    });

    expect(getNotificationConfigReadiness()).toEqual(
      expect.objectContaining({
        ready: true,
        brevo: expect.objectContaining({ enabled: true, ready: true }),
        whatsapp: expect.objectContaining({ enabled: false, ready: true }),
      })
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
    process.env.AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED = 'false';
    process.env.AV_WHATSAPP_NOTIFICATIONS_ENABLED = 'false';
    process.env.SHARETRIBE_INTEGRATION_CLIENT_ID = 'integration-id';
    process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET = '   ';
    process.env.DATABASE_URL = 'postgresql://localhost/database';

    expect(getNotificationConfigReadiness().poller.missing).toContain(
      'SHARETRIBE_INTEGRATION_CLIENT_SECRET'
    );
  });
});
