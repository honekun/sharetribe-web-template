'use strict';

const express = require('express');

const { getNotificationReadiness } = require('../services/notificationReadiness');

const router = express.Router();

router.get('/readiness', async (_req, res) => {
  const readiness = await getNotificationReadiness();
  return res.status(readiness.ready ? 200 : 503).json(readiness);
});

module.exports = router;
