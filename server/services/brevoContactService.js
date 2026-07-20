'use strict';

const { fetchWithTimeout } = require('../api-util/fetchWithTimeout');
const { normalizeEmail } = require('./emailAddress');

const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';

function brevoHeaders() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');
  return {
    'Content-Type': 'application/json',
    'api-key': apiKey,
    accept: 'application/json',
  };
}

function configuredListId() {
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!Number.isInteger(listId) || listId <= 0) {
    throw new Error('BREVO_LIST_ID must be configured as a positive integer');
  }
  return listId;
}

async function responseError(response, operation) {
  const body = await response.json().catch(() => ({}));
  const error = new Error(`Brevo ${operation} failed: ${response.status}`);
  error.status = response.status;
  error.providerBody = body;
  return error;
}

async function upsertMarketingContact({ email, attributes = {} }) {
  const response = await fetchWithTimeout(BREVO_CONTACTS_URL, {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({
      email: normalizeEmail(email),
      updateEnabled: true,
      listIds: [configuredListId()],
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    }),
  });
  if (response.status >= 400) throw await responseError(response, 'contact upsert');
}

async function removeMarketingContact(email) {
  const encodedEmail = encodeURIComponent(normalizeEmail(email));
  const response = await fetchWithTimeout(`${BREVO_CONTACTS_URL}/${encodedEmail}`, {
    method: 'PUT',
    headers: brevoHeaders(),
    body: JSON.stringify({ unlinkListIds: [configuredListId()] }),
  });
  // A missing contact/list membership is already the desired state.
  if (response.status >= 400 && response.status !== 404) {
    throw await responseError(response, 'list removal');
  }
}

module.exports = {
  BREVO_CONTACTS_URL,
  configuredListId,
  removeMarketingContact,
  upsertMarketingContact,
};
