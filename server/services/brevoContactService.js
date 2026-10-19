'use strict';

const { fetchWithTimeout } = require('../api-util/fetchWithTimeout');
const { normalizeEmail } = require('./emailAddress');

const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';
const BREVO_BLOCKED_CONTACTS_URL = 'https://api.brevo.com/v3/smtp/blockedContacts';

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

// Clicking unsubscribe in a template email puts the address on Brevo's
// transactional blocklist, which list membership doesn't touch. Brevo then
// refuses every send to it and reports `blocked`, which the webhook treats as
// a suppression, so a later opt-in would undo itself. Only the account owner's
// own re-consent calls this.
async function unblockTransactionalContact(email) {
  const encodedEmail = encodeURIComponent(normalizeEmail(email));
  const response = await fetchWithTimeout(`${BREVO_BLOCKED_CONTACTS_URL}/${encodedEmail}`, {
    method: 'DELETE',
    headers: brevoHeaders(),
  });
  // Not on the blocklist is already the desired state.
  if (response.status >= 400 && response.status !== 404) {
    throw await responseError(response, 'transactional unblock');
  }
}

module.exports = {
  BREVO_BLOCKED_CONTACTS_URL,
  BREVO_CONTACTS_URL,
  configuredListId,
  removeMarketingContact,
  unblockTransactionalContact,
  upsertMarketingContact,
};
