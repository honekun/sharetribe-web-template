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
});
