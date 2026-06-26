'use strict';

const fetch = require('node-fetch');
const { eshipBaseUrl } = require('../../src/config/configAVShipping');

const DEFAULT_TIMEOUT_MS = 8000;

class EshipApiError extends Error {
  constructor(status, body) {
    super(`eShip API error ${status}`);
    this.name = 'EshipApiError';
    this.status = status;
    this.body = body;
  }
}

class EshipTimeoutError extends Error {
  constructor() {
    super('eShip request timed out');
    this.name = 'EshipTimeoutError';
  }
}

// POST {base}/quotation. Returns the parsed quotation object ({ quot_id, rates }).
async function quote({ addressFrom, addressTo, parcels }) {
  const apiKey = process.env.ESHIP_API_KEY;
  if (!apiKey) throw new EshipApiError(401, { error: 'ESHIP_API_KEY missing' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${eshipBaseUrl}/quotation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ address_from: addressFrom, address_to: addressTo, parcels }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new EshipApiError(response.status, body);
    }
    return response.json();
  } catch (e) {
    if (e && e.name === 'AbortError') throw new EshipTimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { quote, EshipApiError, EshipTimeoutError };
