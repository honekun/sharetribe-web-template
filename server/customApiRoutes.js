'use strict';

// AV custom Express routers. Kept in a single mount function so server/index.js
// only carries a one-line addition — easier to resolve on upstream merges.
//
// Mount order matters: these routes must be registered BEFORE the upstream
// `app.use('/api', apiRouter)` in server/index.js, otherwise the upstream
// catch-all SDK proxy can intercept paths like /api/brevo or /api/bulk-import.
//
// Body parsing is per-router, never app-wide, so a JSON parser is never applied
// to a request that does not want one:
//   - brevo      needs JSON (POST /subscribe, /engagement, /webhook, PUT /preference)
//   - shipping-* declare their own `express.json()` on the one POST each has
//   - bulk-import uses per-route `multer` for multipart; JSON would be a no-op
//   - instagram / my-balance / notifications / topbar are GET-only
// Upstream's own `/api/*` routes are unaffected: they are Transit-encoded and
// parsed by the `bodyParser.text({ type: 'application/transit+json' })` in
// server/apiRouter.js.

const express = require('express');

const brevoRouter = require('./api/brevo');
const instagramRouter = require('./api/instagram');
const myBalanceRouter = require('./api/my-balance');
const bulkImportRouter = require('./api/bulk-import');
const shippingQuoteRouter = require('./api/shipping-quote');
const shippingLabelRouter = require('./api/shipping-label');
const notificationsRouter = require('./api/notifications');
const topbarLocalDesignUsers = require('./api/topbar-local-design-users');

// No auth required: returns display names + UUIDs of local-design sellers.
// Data is effectively public (these sellers appear in the public nav).
const topbarRouter = express.Router();
topbarRouter.get('/local-design-users', topbarLocalDesignUsers);

const mountCustomApiRoutes = app => {
  app.use('/api/brevo', express.json(), brevoRouter);
  app.use('/api/instagram', instagramRouter);
  app.use('/api/my-balance', myBalanceRouter);
  app.use('/api/bulk-import', bulkImportRouter);
  app.use('/api/shipping', shippingQuoteRouter);
  app.use('/api/shipping', shippingLabelRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/topbar', topbarRouter);
};

module.exports = { mountCustomApiRoutes };
