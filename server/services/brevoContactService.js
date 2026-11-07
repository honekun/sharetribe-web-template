'use strict';

const { isFetchTimeout, requestWithTimeout } = require('../api-util/fetchWithTimeout');
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

const statusError = (status, operation, providerBody = {}) => {
  const error = new Error(`Brevo ${operation} failed: ${status}`);
  error.status = status;
  error.providerBody = providerBody;
  return error;
};

// One deadline for the request and any error body read (audit A06). Statuses in
// `acceptedStatuses` (e.g. 404 = already in the desired state) are success.
async function brevoContactRequest(url, options, operation, acceptedStatuses = []) {
  const isFailure = status => status >= 400 && !acceptedStatuses.includes(status);
  try {
    await requestWithTimeout(url, options, {
      read: async response => {
        if (isFailure(response.status)) {
          const body = await response.json().catch(() => ({}));
          throw statusError(response.status, operation, body);
        }
      },
    });
  } catch (err) {
    // The status arrived before the body stalled: keep reporting it.
    if (isFetchTimeout(err) && err.response) {
      if (!isFailure(err.response.status)) return;
      throw statusError(err.response.status, operation);
    }
    throw err;
  }
}

async function upsertMarketingContact({ email, attributes = {} }) {
  await brevoContactRequest(
    BREVO_CONTACTS_URL,
    {
      method: 'POST',
      headers: brevoHeaders(),
      body: JSON.stringify({
        email: normalizeEmail(email),
        updateEnabled: true,
        listIds: [configuredListId()],
        ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
      }),
    },
    'contact upsert'
  );
}

async function removeMarketingContact(email) {
  const encodedEmail = encodeURIComponent(normalizeEmail(email));
  // A missing contact/list membership is already the desired state.
  await brevoContactRequest(
    `${BREVO_CONTACTS_URL}/${encodedEmail}`,
    {
      method: 'PUT',
      headers: brevoHeaders(),
      body: JSON.stringify({ unlinkListIds: [configuredListId()] }),
    },
    'list removal',
    [404]
  );
}

// Clicking unsubscribe in a template email puts the address on Brevo's
// transactional blocklist, which list membership doesn't touch. Brevo then
// refuses every send to it and reports `blocked`, which the webhook treats as
// a suppression, so a later opt-in would undo itself. Only the account owner's
// own re-consent calls this.
async function unblockTransactionalContact(email) {
  const encodedEmail = encodeURIComponent(normalizeEmail(email));
  // Not on the blocklist is already the desired state.
  await brevoContactRequest(
    `${BREVO_BLOCKED_CONTACTS_URL}/${encodedEmail}`,
    { method: 'DELETE', headers: brevoHeaders() },
    'transactional unblock',
    [404]
  );
}

module.exports = {
  BREVO_BLOCKED_CONTACTS_URL,
  BREVO_CONTACTS_URL,
  configuredListId,
  removeMarketingContact,
  unblockTransactionalContact,
  upsertMarketingContact,
};
