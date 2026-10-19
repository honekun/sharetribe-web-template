'use strict';

jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const {
  BREVO_BLOCKED_CONTACTS_URL,
  BREVO_CONTACTS_URL,
  removeMarketingContact,
  unblockTransactionalContact,
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

  test('re-consent removes the normalized address from the transactional blocklist', async () => {
    await unblockTransactionalContact(' Person+Shop@Example.com ');

    expect(fetch).toHaveBeenCalledWith(
      `${BREVO_BLOCKED_CONTACTS_URL}/person%2Bshop%40example.com`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  test('treats an address that is not blocked as the desired state', async () => {
    fetch.mockResolvedValue({
      status: 404,
      json: jest.fn().mockResolvedValue({ code: 'document_not_found' }),
    });

    await expect(unblockTransactionalContact('free@example.com')).resolves.toBeUndefined();
  });

  test('throws when Brevo refuses the unblock', async () => {
    fetch.mockResolvedValue({
      status: 500,
      json: jest.fn().mockResolvedValue({ code: 'internal_error' }),
    });

    await expect(unblockTransactionalContact('person@example.com')).rejects.toMatchObject({
      status: 500,
    });
  });
});
