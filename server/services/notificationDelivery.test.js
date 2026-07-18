'use strict';

jest.mock('./welcomeEmailService', () => ({
  sendWelcomeEmail: jest.fn(),
}));
jest.mock('./whatsappService', () => ({
  sendUserWhatsApp: jest.fn(),
}));
jest.mock('./notificationMetrics', () => ({
  recordDelivery: jest.fn(),
}));

const { sendWelcomeEmail } = require('./welcomeEmailService');
const { sendUserWhatsApp } = require('./whatsappService');
const { recordDelivery } = require('./notificationMetrics');
const {
  deliverNotification,
  normalizeRecipient,
  notificationKey,
  retryNotification,
} = require('./notificationDelivery');
const { rejectedProviderRequest, unknownProviderOutcome } = require('./notificationProviderError');

const emailDelivery = {
  eventId: 'event-1',
  channel: 'brevo',
  templateName: 'av_welcome_email',
  recipient: 'person@example.com',
  payload: {
    email: 'person@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  },
};

function claimedDelivery(delivery = emailDelivery) {
  return {
    notification_key: notificationKey(delivery),
    claim_token: '4de368e3-6ff8-46fe-bb82-a5b1ca39244b',
    status: 'processing',
  };
}

describe('notification delivery idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('a replay does not call the provider twice', async () => {
    const store = {
      claim: jest
        .fn()
        .mockResolvedValueOnce(claimedDelivery())
        .mockResolvedValueOnce(null),
      finish: jest.fn().mockResolvedValue(),
    };
    sendWelcomeEmail.mockResolvedValue({ providerMessageId: 'brevo-1' });

    await deliverNotification(emailDelivery, 'worker-1', store);
    const replay = await deliverNotification(emailDelivery, 'worker-2', store);

    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(store.finish).toHaveBeenCalledWith(notificationKey(emailDelivery), expect.any(String), {
      status: 'sent',
      providerMessageId: 'brevo-1',
    });
    expect(replay).toEqual({ status: 'deduplicated' });
    expect(recordDelivery).toHaveBeenCalledWith('brevo', 'deduplicated');
  });

  test('normalizes equivalent recipients before deriving the key', () => {
    expect(normalizeRecipient(' PERSON@Example.com ')).toBe('person@example.com');
    expect(normalizeRecipient('+52 (55) 0000-0002')).toBe('+525500000002');
    expect(
      notificationKey({
        ...emailDelivery,
        recipient: ' PERSON@Example.com ',
      })
    ).toBe(notificationKey(emailDelivery));
  });

  test('does not automatically retry an unknown provider outcome', async () => {
    const store = {
      claim: jest.fn().mockResolvedValue(claimedDelivery()),
      finish: jest.fn().mockResolvedValue(),
    };
    const error = unknownProviderOutcome('connection ended after request');
    sendWelcomeEmail.mockRejectedValue(error);

    await expect(deliverNotification(emailDelivery, 'worker-1', store)).rejects.toBe(error);

    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(error.notificationOutcomeRecorded).toBe(true);
    expect(store.finish).toHaveBeenCalledWith(
      notificationKey(emailDelivery),
      expect.any(String),
      expect.objectContaining({ status: 'unknown' })
    );
  });

  test('does not retry a definite non-retryable provider rejection', async () => {
    const store = {
      claim: jest.fn().mockResolvedValue(claimedDelivery()),
      finish: jest.fn().mockResolvedValue(),
    };
    sendWelcomeEmail.mockRejectedValue(rejectedProviderRequest('bad request', 400));

    await expect(deliverNotification(emailDelivery, 'worker-1', store)).rejects.toThrow(
      'bad request'
    );

    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(store.finish).toHaveBeenCalledWith(
      notificationKey(emailDelivery),
      expect.any(String),
      expect.objectContaining({ status: 'failed' })
    );
  });

  test('an operator can retry a stored failed WhatsApp notification', async () => {
    const whatsappDelivery = {
      eventId: 'event-2',
      channel: 'whatsapp',
      templateName: 'av_new_message',
      recipient: '+525500000002',
      payload: {
        phone: '+525500000002',
        templateName: 'av_new_message',
      },
    };
    const store = {
      prepareRetry: jest.fn().mockResolvedValue({
        notification_key: notificationKey(whatsappDelivery),
        event_id: whatsappDelivery.eventId,
        channel: whatsappDelivery.channel,
        template_name: whatsappDelivery.templateName,
        recipient_hint: '***0002',
        delivery_payload: whatsappDelivery.payload,
        status: 'pending',
      }),
      claim: jest.fn().mockResolvedValue(claimedDelivery(whatsappDelivery)),
      finish: jest.fn().mockResolvedValue(),
    };
    sendUserWhatsApp.mockResolvedValue({ providerMessageId: 'meta-1' });

    const result = await retryNotification(
      notificationKey(whatsappDelivery),
      { claimedBy: 'operator:test' },
      store
    );

    expect(store.prepareRetry).toHaveBeenCalledWith(notificationKey(whatsappDelivery), {
      confirmUnknown: false,
    });
    expect(sendUserWhatsApp).toHaveBeenCalledWith(whatsappDelivery.payload);
    expect(result).toEqual({ status: 'sent' });
  });
});
