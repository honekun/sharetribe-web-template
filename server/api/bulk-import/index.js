'use strict';

const express = require('express');
const multer = require('multer');
const { parseCsv, validateRows } = require('./csvParser');
const { processImportJob, serializeSdkError } = require('./importWorker');
const {
  createJob,
  getJob,
  updateJob,
  hasActiveJobForUser,
  countActiveJobs,
} = require('./jobStore');
const { extractZip } = require('./zipExtractor');
const { authorizeAction, requireActionToken, requireUserSession } = require('./auth');
const { getLimits } = require('./limits');
const { checkAndRecord } = require('./rateLimiter');

const router = express.Router();

// Hard multer ceiling = the largest tier (admin). Per-tier ZIP byte caps are
// enforced after auth in /start, since multer can't see the user's tier.
const MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB compressed ZIP

// Caps total imports running concurrently across all users (memory protection).
const MAX_GLOBAL_CONCURRENT_JOBS = 3;

const isZipUpload = file => {
  const originalName = file?.originalname || '';
  const mimeType = file?.mimetype || '';
  return (
    originalName.toLowerCase().endsWith('.zip') &&
    ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(
      mimeType
    )
  );
};

// Multer config: memory storage, single ZIP file with a compressed-size cap.
// zipExtractor enforces per-entry and total uncompressed-size caps before use.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ZIP_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!isZipUpload(file)) {
      return cb(new Error('Upload must be a .zip file with ZIP content type.'));
    }
    return cb(null, true);
  },
});

const uploadSingle = upload.single('zipFile');

const uploadZip = (req, res, next) => {
  uploadSingle(req, res, err => {
    if (!err) {
      return next();
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(400)
        .json({ error: 'ZIP file is too large. Maximum upload size is 50 MB.' });
    }
    return res.status(400).json({ error: err.message });
  });
};

// POST /api/bulk-import/authorize
router.post('/authorize', requireUserSession, authorizeAction);

// POST /api/bulk-import/start
router.post('/start', requireUserSession, requireActionToken, uploadZip, (req, res) => {
  try {
    // Validate ZIP file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No ZIP file uploaded. Use field name "zipFile".' });
    }

    // Per-tier limits: admins get the larger caps, everyone else the standard tier.
    const limits = getLimits(req.bulkImportUser.isAdmin);

    // Per-tier compressed-ZIP size cap (multer only enforces the admin ceiling).
    if (req.file.size > limits.maxZipBytes) {
      const mb = Math.round(limits.maxZipBytes / 1024 / 1024);
      return res.status(400).json({ error: `ZIP exceeds your ${mb} MB limit.` });
    }

    // Extract and validate ZIP contents
    let csvBuffer, imageMap;
    try {
      ({ csvBuffer, imageMap } = extractZip(req.file.buffer));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Per-tier image-count cap.
    if (imageMap.size > limits.maxImages) {
      return res.status(400).json({
        error: `Too many images (${imageMap.size}). Your limit is ${limits.maxImages}.`,
      });
    }

    // Parse CSV
    let rows;
    try {
      rows = parseCsv(csvBuffer);
    } catch (err) {
      return res.status(400).json({ error: `CSV parse error: ${err.message}` });
    }

    // Per-tier row-count cap.
    if (rows.length > limits.maxRows) {
      return res.status(400).json({
        error: `CSV has ${rows.length} rows. Your limit is ${limits.maxRows}.`,
      });
    }

    // Validate rows against imageMap. Listings author to the signed-in user;
    // admins (req.bulkImportUser.isAdmin) may override per row via `user_id`.
    const validation = validateRows(rows, imageMap, {
      currentUserId: req.bulkImportUser.userId,
      allowAuthorOverride: req.bulkImportUser.isAdmin,
    });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'CSV validation failed.',
        details: validation.errors,
      });
    }

    // Prevent a user from running two imports at once.
    if (hasActiveJobForUser(req.bulkImportUser.userId)) {
      return res.status(409).json({
        error:
          'You already have an import in progress. Wait for it to complete before starting a new one.',
      });
    }

    // Cap total concurrent imports across all users.
    if (countActiveJobs() >= MAX_GLOBAL_CONCURRENT_JOBS) {
      return res.status(503).json({
        error: 'Import capacity is full right now. Please try again in a few minutes.',
      });
    }

    // Per-user hourly rate limit — recorded only once an import actually starts,
    // so failed validations above do not consume the user's budget.
    if (!checkAndRecord(req.bulkImportUser.userId, limits.maxImportsPerHour)) {
      return res.status(429).json({
        error: `Too many imports. You can start ${limits.maxImportsPerHour} per hour. Try again later.`,
      });
    }

    // Create job (owned by the signed-in user) and start processing.
    const job = createJob(validation.rows.length, req.bulkImportUser.userId);

    // Start async processing (do not await)
    processImportJob(job.id, validation.rows, imageMap).catch(err => {
      const serialized = serializeSdkError(err);
      console.error(`[bulk-import] Job ${job.id} crashed:`, serialized);
      updateJob(job.id, { status: 'failed', error: serialized });
    });

    res.status(202).json({
      jobId: job.id,
      total: validation.rows.length,
      message: 'Import started. Poll /api/bulk-import/status/:jobId for progress.',
    });
  } catch (err) {
    console.error('[bulk-import] Start error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/bulk-import/status/:jobId
router.get('/status/:jobId', requireUserSession, requireActionToken, (req, res) => {
  const job = getJob(req.params.jobId);
  // Owner-scoped: a job belonging to another user reads as "not found" (404,
  // not 403) so we never confirm the existence of someone else's job.
  if (!job || job.ownerId !== req.bulkImportUser.userId) {
    return res.status(404).json({ error: 'Job not found. It may have expired (1hr TTL).' });
  }

  res.json({
    id: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    succeeded: job.succeeded,
    failed: job.failed,
    errors: job.errors,
    results: job.results,
    error: job.error || null,
  });
});

// GET /api/bulk-import/template — no auth required, publicly downloadable
router.get('/template', (req, res) => {
  const headers = [
    'title',
    'description',
    'price',
    'currency',
    'user_id',
    'publish',
    'stock',
    'shipping_enabled',
    'pickup_enabled',
    'location_address',
    'location_lat',
    'location_lng',
    'image_front',
    'image_back',
    'image_horizontal',
    'image_details',
    'pd_categoryLevel1',
    'pd_categoryLevel2',
    'pd_categoryLevel3',
    'pd_color',
    'pd_all_sizes',
    'pd_brand',
    'pd_genero',
    'pd_estado',
    'pd_estilo',
    'pd_originalPrice',
  ];

  const exampleRow = [
    'Vestido Vintage Años 80',
    'Hermoso vestido vintage en excelente estado',
    '450.00',
    'MXN',
    '',
    'yes',
    '1',
    'true',
    'false',
    'Ciudad de México, México',
    '19.4326',
    '-99.1332',
    'vestido01_front.jpg',
    'vestido01_back.jpg',
    'vestido01_horizontal.jpg',
    'vestido01_details.jpg',
    'ropa',
    'ropa-vestidos',
    '',
    'rosa',
    's|m',
    'vintage',
    'mujer',
    'como-nuevo',
    'vintage',
    '600.00',
  ];

  const csv = headers.join(',') + '\n' + exampleRow.map(v => JSON.stringify(v)).join(',') + '\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bulk-import-template.csv"');
  res.send(csv);
});

module.exports = router;
module.exports._test = { isZipUpload, MAX_ZIP_UPLOAD_BYTES };
