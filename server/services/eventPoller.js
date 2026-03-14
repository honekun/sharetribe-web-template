'use strict';

const integrationSdkLib = require('sharetribe-flex-integration-sdk');
const { sendWelcomeEmail } = require('./welcomeEmailService');
const { sendAdminAlert, sendUserWhatsApp, lookupUserPhone } = require('./whatsappService');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cursor; resets on server restart.
// On first boot we look back 10 minutes to avoid missing events during deployments.
let lastSequenceId = null;

let integrationSdk = null;

function getIntegrationSdk() {
  if (!integrationSdk) {
    integrationSdk = integrationSdkLib.createInstance({
      clientId: process.env.SHARETRIBE_INTEGRATION_CLIENT_ID,
      clientSecret: process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET,
    });
  }
  return integrationSdk;
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleNewUser(resource) {
  const attrs = resource?.attributes;
  if (!attrs) return;

  const email = attrs.email;
  const profile = attrs.profile || {};
  const firstName = profile.firstName || 'Usuario';
  const lastName = profile.lastName || '';
  const phone = profile.protectedData?.phoneNumber || null;

  console.log(`[eventPoller] New user: ${email}`);

  // Welcome email with PDF (non-fatal)
  try {
    await sendWelcomeEmail({ email, firstName, lastName });
  } catch (err) {
    console.error('[eventPoller] Welcome email failed:', err.message);
  }

  // WhatsApp: admin alert (non-fatal)
  try {
    await sendAdminAlert({ firstName, lastName, email });
  } catch (err) {
    console.error('[eventPoller] Admin WhatsApp alert failed:', err.message);
  }

  // WhatsApp: user welcome (only if they have a phone)
  if (phone) {
    try {
      await sendUserWhatsApp({
        phone,
        templateName: 'av_welcome_user',
        params: [firstName],
      });
    } catch (err) {
      console.error('[eventPoller] User welcome WhatsApp failed:', err.message);
    }
  }
}

// Maps transition name fragments → { buyerTemplate, sellerTemplate, notifyBoth }
const TRANSITION_MAP = {
  '/purchased': {
    buyerTemplate: 'av_purchase_confirmed',
    sellerTemplate: 'av_sale_received',
    notifyBoth: true,
  },
  '/delivered': {
    buyerTemplate: 'av_delivered',
    notifyBoth: false,
  },
  '/cancelled': {
    buyerTemplate: 'av_cancelled',
    sellerTemplate: 'av_cancelled',
    notifyBoth: true,
  },
  '/accepted': {
    buyerTemplate: 'av_booking_accepted',
    notifyBoth: false,
  },
  '/declined': {
    buyerTemplate: 'av_booking_declined',
    notifyBoth: false,
  },
  '/offer-made': {
    sellerTemplate: 'av_new_message',
    notifyBoth: false,
  },
};

async function handleTransactionEvent(resource) {
  const sdk = getIntegrationSdk();
  const attrs = resource?.attributes || {};
  const transition = attrs.lastTransition || '';
  const relationships = resource?.relationships || {};

  // Find matching rule
  const matchedKey = Object.keys(TRANSITION_MAP).find(k => transition.endsWith(k));
  if (!matchedKey) return;

  const rule = TRANSITION_MAP[matchedKey];

  // Resolve user IDs from relationships
  const customerId = relationships.customer?.data?.id?.uuid;
  const providerId = relationships.provider?.data?.id?.uuid;

  const [customerPhone, providerPhone] = await Promise.all([
    customerId ? lookupUserPhone(sdk, customerId) : Promise.resolve(null),
    providerId ? lookupUserPhone(sdk, providerId) : Promise.resolve(null),
  ]);

  if (rule.buyerTemplate && customerPhone) {
    try {
      await sendUserWhatsApp({ phone: customerPhone, templateName: rule.buyerTemplate });
    } catch (err) {
      console.error('[eventPoller] Buyer WhatsApp failed:', err.message);
    }
  }

  if (rule.sellerTemplate && providerPhone) {
    try {
      await sendUserWhatsApp({ phone: providerPhone, templateName: rule.sellerTemplate });
    } catch (err) {
      console.error('[eventPoller] Seller WhatsApp failed:', err.message);
    }
  }
}

async function handleMessageEvent(resource) {
  const sdk = getIntegrationSdk();
  const relationships = resource?.relationships || {};

  // Determine the recipient: the other party in the transaction
  const transactionId = relationships.transaction?.data?.id?.uuid;
  const senderId = relationships.sender?.data?.id?.uuid;

  if (!transactionId) return;

  try {
    const txRes = await sdk.transactions.show({ id: transactionId });
    const tx = txRes?.data?.data;
    const customerId = tx?.relationships?.customer?.data?.id?.uuid;
    const providerId = tx?.relationships?.provider?.data?.id?.uuid;

    // The recipient is whichever party is NOT the sender
    const recipientId = senderId === customerId ? providerId : customerId;
    if (!recipientId) return;

    const recipientPhone = await lookupUserPhone(sdk, recipientId);
    if (recipientPhone) {
      await sendUserWhatsApp({
        phone: recipientPhone,
        templateName: 'av_new_message',
      });
    }
  } catch (err) {
    console.error('[eventPoller] Message event handler failed:', err.message);
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

async function pollEvents() {
  const sdk = getIntegrationSdk();

  const params = lastSequenceId
    ? { sequenceIdStart: lastSequenceId + 1 }
    : { createdAtStart: new Date(Date.now() - 10 * 60 * 1000).toISOString() };

  let res;
  try {
    res = await sdk.events.query(params);
  } catch (err) {
    console.error('[eventPoller] Integration API query failed:', err.message);
    return;
  }

  const events = res?.data?.data || [];
  if (events.length > 0) {
    console.log(`[eventPoller] Processing ${events.length} event(s)`);
  }

  for (const event of events) {
    const { eventType, resource, sequenceId } = event.attributes;

    try {
      if (eventType === 'user/created') {
        await handleNewUser(resource);
      } else if (eventType === 'transaction/transitioned') {
        await handleTransactionEvent(resource);
      } else if (eventType === 'message/created') {
        await handleMessageEvent(resource);
      }
    } catch (err) {
      console.error(`[eventPoller] Unhandled error for event type "${eventType}":`, err.message);
    }

    lastSequenceId = sequenceId;
  }
}

/**
 * Start the polling loop. Safe to call multiple times (idempotent via interval ID check).
 */
let pollIntervalId = null;

function startPoller() {
  if (pollIntervalId) return;

  console.log('[eventPoller] Starting Integration API event poller (interval: 5 min)');

  // First poll immediately, then on interval
  pollEvents().catch(err => console.error('[eventPoller] Initial poll failed:', err.message));

  pollIntervalId = setInterval(() => {
    pollEvents().catch(err => console.error('[eventPoller] Poll failed:', err.message));
  }, POLL_INTERVAL_MS);

  // Allow process to exit normally even with active interval
  if (pollIntervalId.unref) {
    pollIntervalId.unref();
  }
}

module.exports = { startPoller };
