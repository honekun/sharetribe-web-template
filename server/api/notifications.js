'use strict';

const { timingSafeEqual } = require('crypto');
const express = require('express');

const { getNotificationReadiness } = require('../services/notificationReadiness');

const router = express.Router();

router.get('/readiness', async (_req, res) => {
  const readiness = await getNotificationReadiness();
  return res.status(readiness.ready ? 200 : 503).json({ ready: readiness.ready });
});

const validReadinessToken = req => {
  const configured = process.env.AV_NOTIFICATION_READINESS_TOKEN || '';
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  const provided = match?.[1] || '';
  const configuredBuffer = Buffer.from(configured);
  const providedBuffer = Buffer.from(provided);

  return (
    configuredBuffer.length > 0 &&
    configuredBuffer.length === providedBuffer.length &&
    timingSafeEqual(configuredBuffer, providedBuffer)
  );
};

router.get(
  '/readiness/details',
  (req, res, next) => {
    if (!validReadinessToken(req)) {
      return res.status(401).json({ ready: false, error: 'unauthorized' });
    }
    return next();
  },
  async (_req, res) => {
    const readiness = await getNotificationReadiness();
    res.set('Cache-Control', 'no-store');
    return res.status(readiness.ready ? 200 : 503).json(readiness);
  }
);

module.exports = router;
