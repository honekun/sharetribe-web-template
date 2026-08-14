'use strict';

const fetch = require('node-fetch');
const { eshipBaseUrl } = require('../../src/config/configAVShipping');

const DEFAULT_TIMEOUT_MS = 8000;

// Pull the most human-readable text out of an eShip error body (shapes vary:
// { message }, { error }, { errors: [...] }) or fall back to the raw text.
function extractEshipMessage(body, text) {
  if (body && typeof body === 'object') {
    if (body.message) return String(body.message);
    if (body.error) return typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
    if (Array.isArray(body.errors) && body.errors.length) {
      return body.errors.map(er => er.message || er.detail || JSON.stringify(er)).join('; ');
    }
    return JSON.stringify(body);
  }
  return (text || '').trim();
}

class EshipApiError extends Error {
  constructor(status, body, text) {
    const detail = extractEshipMessage(body, text);
    super(`eShip API error ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'EshipApiError';
    this.status = status;
    this.body = body;
    this.text = text;
    this.detail = detail;
  }
}

// Build the most explicit one-line description we can for any error raised while
// quoting (carrier business errors, timeouts, network failures).
function describeEshipError(e) {
  if (!e) return 'unknown error';
  const base = e.detail || e.message || String(e);
  const status = e.status != null ? ` [${e.status}]` : '';
  return `${e.name || 'Error'}${status}: ${base}`;
}

class EshipTimeoutError extends Error {
  constructor() {
    super('eShip request timed out');
    this.name = 'EshipTimeoutError';
  }
}

// Request {base}/{path} with Bearer auth. Shared by quote(), createShipment(),
// and webhook verification so every call has the same timeout/error behavior.
async function eshipRequest(path, { method, payload = null }) {
  const apiKey = process.env.ESHIP_API_KEY;
  if (!apiKey) throw new EshipApiError(401, { error: 'ESHIP_API_KEY missing' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${eshipBaseUrl}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      ...(payload == null ? {} : { body: JSON.stringify(payload) }),
      signal: controller.signal,
    });
    if (!response.ok) {
      // Read as text first so non-JSON carrier/gateway errors aren't swallowed.
      const text = await response.text().catch(() => '');
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (_) {
        body = null;
      }
      throw new EshipApiError(response.status, body, text);
    }
    return response.json();
  } catch (e) {
    if (e && e.name === 'AbortError') throw new EshipTimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function eshipPost(path, payload) {
  return eshipRequest(path, { method: 'POST', payload });
}

async function eshipGet(path) {
  return eshipRequest(path, { method: 'GET' });
}

// POST {base}/quotation. Returns the parsed quotation object ({ quot_id, rates }).
async function quote({ addressFrom, addressTo, parcels }) {
  return eshipPost('quotation', { address_from: addressFrom, address_to: addressTo, parcels });
}

// POST {base}/shipment. eShip documents rate_id as the shipment purchase input;
// quot_id is quotation trace data and is intentionally not sent.
async function createShipment({ rateId }) {
  return eshipPost('shipment', { rate_id: rateId });
}

// Re-fetch the shipment before trusting an unsigned webhook. eventList lets us
// confirm picked_up even if the carrier has already advanced to a later state.
async function getShipment({ shipmentId, eventList = true }) {
  const params = new URLSearchParams({
    shipment_id: shipmentId,
    ...(eventList ? { eventList: 'true' } : {}),
  });
  return eshipGet(`shipment?${params.toString()}`);
}

module.exports = {
  quote,
  createShipment,
  getShipment,
  EshipApiError,
  EshipTimeoutError,
  describeEshipError,
};
