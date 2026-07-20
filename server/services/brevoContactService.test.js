'use strict';

jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const {
  BREVO_CONTACTS_URL,
  removeMarketingContact,
  upsertMarketingContact,
} = require('./brevoContactService');

describe('brevoContactService', () => {
  beforeEach(() => {
    process.env.BREVO_API_KEY = 'brevo-test-key';
    process.env.BREVO_LIST_ID = '42';
    fetch.mockResolvedValue({
      status: 204,
      json: jest.fn().mockResolvedValue({}),
    });
  });

  test('upserts a normalized contact and adds it to the configured list', async () => {
    await upsertMarketingContact({
      email: ' Person@Example.com ',
      attributes: { CONSENT_SOURCE: 'signup_email' },
    });

    expect(fetch).toHaveBeenCalledWith(
      BREVO_CONTACTS_URL,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'person@example.com',
          updateEnabled: true,
          listIds: [42],
          attributes: { CONSENT_SOURCE: 'signup_email' },
        }),
      })
    );
  });

  test('withdrawal unlinks the contact from the marketing list without deleting it', async () => {
    await removeMarketingContact('Person+Shop@Example.com');

    expect(fetch).toHaveBeenCalledWith(
      `${BREVO_CONTACTS_URL}/person%2Bshop%40example.com`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ unlinkListIds: [42] }),
      })
    );
  });

  test('treats an already-missing contact as the desired state', async () => {
    fetch.mockResolvedValue({
      status: 404,
      json: jest.fn().mockResolvedValue({ code: 'document_not_found' }),
    });

    await expect(removeMarketingContact('missing@example.com')).resolves.toBeUndefined();
  });
});
