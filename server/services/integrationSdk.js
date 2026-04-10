'use strict';

const integrationSdkLib = require('sharetribe-flex-integration-sdk');

let integrationSdk = null;

/**
 * Returns a singleton Integration SDK instance.
 * Requires SHARETRIBE_INTEGRATION_CLIENT_ID and SHARETRIBE_INTEGRATION_CLIENT_SECRET env vars.
 */
function getIntegrationSdk() {
  if (!integrationSdk) {
    integrationSdk = integrationSdkLib.createInstance({
      clientId: process.env.SHARETRIBE_INTEGRATION_CLIENT_ID,
      clientSecret: process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET,
    });
  }
  return integrationSdk;
}

module.exports = { getIntegrationSdk };
