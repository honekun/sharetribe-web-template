'use strict';

jest.mock('node-fetch');

const fetch = require('node-fetch');
const { positiveTemplateId, sendBrevoEmail } = require('./brevoEmailService');

describe('generic Brevo email service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
    process.env.BREVO_SENDER_NAME = 'Archivo Vintach';
  });

  test('requires a positive hosted template id', () => {
    expect(() => positiveTemplateId('')).toThrow(/positive Brevo template ID/);
    expect(() => positiveTemplateId('abc')).toThrow(/positive Brevo template ID/);
    expect(positiveTemplateId('123')).toBe(123);
  });

  test('sends template params and tags through the Brevo transactional API', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({ messageId: 'message-1' }),
    });

    await expect(
      sendBrevoEmail({
        email: 'person@example.com',
        name: 'Ada',
        templateId: '123',
        params: { NOMBRE: 'Ada' },
        tags: ['archivo-vintach', 'viewed_listing'],
      })
    ).resolves.toEqual({ providerMessageId: 'message-1' });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(
      expect.objectContaining({
        sender: { name: 'Archivo Vintach', email: 'sender@example.com' },
        to: [{ email: 'person@example.com', name: 'Ada' }],
        templateId: 123,
        params: { NOMBRE: 'Ada' },
        tags: ['archivo-vintach', 'viewed_listing'],
      })
    );
  });

  describe('deadlines (audit A06)', () => {
    const never = () => new Promise(() => {});
    const send = () =>
      sendBrevoEmail({ email: 'person@example.com', templateId: '123' }).catch(e => e);
    const flush = async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    };

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('no provider response is an unknown outcome', async () => {
      fetch.mockImplementation(never);
      const pending = send();
      await flush();
      jest.advanceTimersByTime(10000);
      const error = await pending;
      expect(error.notificationOutcome).toBe('unknown');
    });

    test('an accepted send whose body stalls counts as sent', async () => {
      fetch.mockResolvedValue({ ok: true, status: 201, json: never });
      const pending = send();
      await flush();
      jest.advanceTimersByTime(10000);
      await expect(pending).resolves.toEqual({ providerMessageId: null });
    });

    test('a rejection whose body stalls keeps its status classification', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      fetch.mockResolvedValue({ ok: false, status: 503, json: never });
      const pending = send();
      await flush();
      jest.advanceTimersByTime(10000);
      const error = await pending;
      expect(error.notificationOutcome).toBe('failed');
      expect(error.retryable).toBe(true);
      console.error.mockRestore();
    });

    test('a definitive rejection is failed and not retryable', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: 'bad' }) });
      const error = await send();
      expect(error.notificationOutcome).toBe('failed');
      expect(error.retryable).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      console.error.mockRestore();
    });
  });
});
