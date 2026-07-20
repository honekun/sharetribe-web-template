'use strict';

const { sendBrevoEmail } = require('./brevoEmailService');
const { buildSellerWelcomeEmail } = require('./marketingCampaigns');

/**
 * Send the seller onboarding email using the approved Spanish Brevo template
 * and the static seller guide committed under public/static/files.
 */
function sendWelcomeEmail({ email, firstName, lastName }) {
  return sendBrevoEmail(buildSellerWelcomeEmail({ email, firstName, lastName }));
}

module.exports = { sendWelcomeEmail };
