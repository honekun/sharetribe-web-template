'use strict';

const crypto = require('crypto');
const express = require('express');
const { isEshipTrackingEmailsEnabled } = require('../services/notificationConfig');
const { createEshipTrackingStore } = require('../services/eshipTrackingStore');
const { EVENT_TYPE_PICKED_UP } = require('../services/eshipTrackingService');

const router = express.Router();
const SHIPMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function secretMatches(provided, configured) {
  const supplied = Buffer.from(String(provided || ''));
  const expected = Buffer.from(String(configured || ''));
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function parseEventTimestamp(timestamp, timezone) {
  if (!timestamp) return null;
  const normalized = String(timestamp)
    .trim()
    .replace(' ', 'T');
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const zone = String(timezone || '').trim();
  if (!hasTimezone && !/^[+-]\d{2}:?\d{2}$/.test(zone)) return null;
  const date = new Date(hasTimezone ? normalized : `${normalized}${zone}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isPickedUpEvent(body) {
  return (
    String(body?.status || '')
      .trim()
      .toUpperCase() === 'TRANSIT' &&
    String(body?.substatus || '')
      .trim()
      .toLowerCase() === 'picked_up'
  );
}

async function eshipWebhook(req, res) {
  if (!isEshipTrackingEmailsEnabled()) {
    return res.status(404).json({ ok: false, error: 'eship_tracking_emails_disabled' });
  }

  const configuredSecret = process.env.ESHIP_WEBHOOK_SECRET;
  if (!configuredSecret || Buffer.byteLength(configuredSecret, 'utf8') < 32) {
    return res.status(503).json({ ok: false, error: 'eship_webhook_not_configured' });
  }
  if (!secretMatches(req.query?.secret, configuredSecret)) {
    return res.status(401).json({ ok: false, error: 'invalid_webhook_secret' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, error: 'invalid_webhook_body' });
  }
  if (!isPickedUpEvent(req.body)) {
    return res.status(202).json({ ok: true, ignored: true });
  }

  const shipmentId = String(req.body.object_id || '').trim();
  if (!SHIPMENT_ID_PATTERN.test(shipmentId)) {
    return res.status(400).json({ ok: false, error: 'invalid_shipment_id' });
  }

  try {
    const store = createEshipTrackingStore();
    const notification = await store.enqueue({
      shipmentId,
      eventType: EVENT_TYPE_PICKED_UP,
      eventAt: parseEventTimestamp(req.body.timestamp, req.body.timezone),
      trackingNumber: String(req.body.tracking_number || '').trim() || null,
    });
    return res.status(notification?.duplicate ? 200 : 202).json({
      ok: true,
      queued: !notification?.duplicate,
      duplicate: Boolean(notification?.duplicate),
    });
  } catch (error) {
    console.error('[eshipWebhook] Could not enqueue tracking event:', error?.message || error);
    return res.status(503).json({ ok: false, error: 'tracking_event_enqueue_failed' });
  }
}

router.post('/eship-webhook', express.json({ limit: '32kb' }), eshipWebhook);

module.exports = router;
module.exports.eshipWebhook = eshipWebhook;
module.exports.isPickedUpEvent = isPickedUpEvent;
module.exports.parseEventTimestamp = parseEventTimestamp;
module.exports.secretMatches = secretMatches;
