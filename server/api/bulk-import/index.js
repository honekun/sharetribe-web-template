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
const { extractZip, MAX_CSV_BYTES } = require('./zipExtractor');
const { authorizeAction, requireActionToken, requireUserSession } = require('./auth');
const { getLimits } = require('./limits');
const { checkAndRecord } = require('./rateLimiter');

const router = express.Router();

// Hard multer ceiling = the largest tier (admin). Per-tier ZIP byte caps are
// enforced after auth in /start, since multer can't see the user's tier.
const MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB compressed ZIP

// Caps total imports running concurrently across all users (memory protection).
const MAX_GLOBAL_CONCURRENT_JOBS = 3;

// Two upload shapes are accepted:
//  - a .zip holding one CSV plus the listing images, and
//  - a bare .csv, imported as if no images were present (every row falls back to
//    the bundled placeholder — see placeholderImage.js).
// Browsers and spreadsheet apps are inconsistent about the MIME type they attach
// to a CSV, so the extension decides and the MIME type is only a sanity check.
const ZIP_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
];
const CSV_MIME_TYPES = [
  'text/csv',
  'application/csv',
  // Excel's own export type, and what some browsers fall back to.
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
];

const classifyUpload = file => {
  const originalName = (file?.originalname || '').toLowerCase();
  const mimeType = file?.mimetype || '';
  if (originalName.endsWith('.zip') && ZIP_MIME_TYPES.includes(mimeType)) return 'zip';
  if (originalName.endsWith('.csv') && CSV_MIME_TYPES.includes(mimeType)) return 'csv';
  return null;
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
    if (!classifyUpload(file)) {
      return cb(new Error('El archivo subido debe ser un .zip o un .csv.'));
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
      return res.status(400).json({
        error: 'El archivo ZIP es demasiado grande. El tamaño máximo de subida es 50 MB.',
      });
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
      return res
        .status(400)
        .json({ error: 'No se subió ningún archivo. Usa el nombre de campo "zipFile".' });
    }

    // Per-tier limits: admins get the larger caps, everyone else the standard tier.
    const limits = getLimits(req.bulkImportUser.isAdmin);

    // A bare CSV carries no images, so it skips extraction and every row falls back
    // to the placeholder. multer's fileFilter has already rejected anything that is
    // neither a .zip nor a .csv; an unnamed upload is treated as a ZIP, as before.
    const isCsvUpload = classifyUpload(req.file) === 'csv';

    let csvBuffer, imageMap;
    if (isCsvUpload) {
      // Same ceiling the ZIP extractor applies to a CSV inside an archive.
      if (req.file.size > MAX_CSV_BYTES) {
        const mb = Math.round(MAX_CSV_BYTES / 1024 / 1024);
        return res.status(400).json({ error: `El archivo CSV supera el máximo de ${mb} MB.` });
      }
      if (!req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({ error: 'El archivo CSV está vacío.' });
      }
      csvBuffer = req.file.buffer;
      imageMap = new Map();
    } else {
      // Per-tier compressed-ZIP size cap (multer only enforces the admin ceiling).
      if (req.file.size > limits.maxZipBytes) {
        const mb = Math.round(limits.maxZipBytes / 1024 / 1024);
        return res.status(400).json({ error: `El ZIP supera tu límite de ${mb} MB.` });
      }

      // Extract and validate ZIP contents
      try {
        ({ csvBuffer, imageMap } = extractZip(req.file.buffer));
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      // Per-tier image-count cap.
      if (imageMap.size > limits.maxImages) {
        return res.status(400).json({
          error: `Demasiadas imágenes (${imageMap.size}). Tu límite es ${limits.maxImages}.`,
        });
      }
    }

    // Parse CSV
    let rows, headerMap;
    try {
      ({ rows, headerMap } = parseCsv(csvBuffer));
    } catch (err) {
      return res.status(400).json({ error: `Error al analizar el CSV: ${err.message}` });
    }

    // Per-tier row-count cap.
    if (rows.length > limits.maxRows) {
      return res.status(400).json({
        error: `El CSV tiene ${rows.length} filas. Tu límite es ${limits.maxRows}.`,
      });
    }

    // Validate rows against imageMap. Listings author to the signed-in user;
    // admins (req.bulkImportUser.isAdmin) may override per row via `user_id`.
    // headerMap lets validation errors name the operator's real CSV columns.
    const validation = validateRows(rows, imageMap, {
      currentUserId: req.bulkImportUser.userId,
      allowAuthorOverride: req.bulkImportUser.isAdmin,
      headerMap,
      // A CSV-only upload has no images to resolve, so any filename it names is
      // dropped rather than reported as missing.
      ignoreImages: isCsvUpload,
    });
    if (!validation.valid) {
      return res.status(400).json({
        error:
          'Falta información para completar en tu archivo CSV. Completa la información en la plantilla y vuelve a exportar.',
        details: validation.errors,
      });
    }

    // Prevent a user from running two imports at once.
    if (hasActiveJobForUser(req.bulkImportUser.userId)) {
      return res.status(409).json({
        error:
          'Ya tienes una importación en curso. Espera a que termine antes de iniciar una nueva.',
      });
    }

    // Cap total concurrent imports across all users.
    if (countActiveJobs() >= MAX_GLOBAL_CONCURRENT_JOBS) {
      return res.status(503).json({
        error:
          'La capacidad de importación está llena en este momento. Inténtalo de nuevo en unos minutos.',
      });
    }

    // Per-user hourly rate limit — recorded only once an import actually starts,
    // so failed validations above do not consume the user's budget.
    if (!checkAndRecord(req.bulkImportUser.userId, limits.maxImportsPerHour)) {
      return res.status(429).json({
        error: `Demasiadas importaciones. Puedes iniciar ${limits.maxImportsPerHour} por hora. Inténtalo más tarde.`,
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
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/bulk-import/status/:jobId
router.get('/status/:jobId', requireUserSession, requireActionToken, (req, res) => {
  const job = getJob(req.params.jobId);
  // Owner-scoped: a job belonging to another user reads as "not found" (404,
  // not 403) so we never confirm the existence of someone else's job.
  if (!job || job.ownerId !== req.bulkImportUser.userId) {
    return res
      .status(404)
      .json({ error: 'Trabajo no encontrado. Es posible que haya expirado (TTL de 1 hora).' });
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

// GET /api/bulk-import/template — no auth required, publicly downloadable.
// Mirrors the current seller template (public/static/files/PLANTILLA_CARGA_MASIVA.csv):
// public-data fields carry a `pub_` prefix and image columns are imagen_1..4.
router.get('/template', (req, res) => {
  const headers = [
    'title',
    'description',
    'price',
    'pub_brand',
    'pub_categoryLevel1',
    'pub_categoryLevel2',
    'pub_categoryLevel3',
    'pub_color',
    'pub_all_sizes',
    'pub_genero',
    'pub_estado',
    'pub_estilo',
    'pub_temporada',
    'imagen_1',
    'imagen_2',
    'imagen_3',
    'imagen_4',
  ];

  const exampleRow = [
    'Vestido Vintage Años 80',
    'Hermoso vestido vintage en excelente estado',
    '450.00',
    'zara',
    'ropa',
    'ropa-vestidos',
    'ropa-vestidos-midi',
    'rosa',
    's',
    'mujer',
    'como-nuevo',
    'vintage',
    'otono',
    'Vestido Vintage Años 80-1.jpg',
    'Vestido Vintage Años 80-2.jpg',
    'Vestido Vintage Años 80-3.jpg',
    '',
  ];

  const csv = headers.join(',') + '\n' + exampleRow.map(v => JSON.stringify(v)).join(',') + '\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bulk-import-template.csv"');
  res.send(csv);
});

module.exports = router;
module.exports._test = { classifyUpload, MAX_ZIP_UPLOAD_BYTES };
