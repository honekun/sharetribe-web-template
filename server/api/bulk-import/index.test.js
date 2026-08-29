'use strict';

jest.mock('./importWorker', () => ({
  processImportJob: jest.fn(() => Promise.resolve()),
}));

jest.mock('./zipExtractor', () => ({
  ...jest.requireActual('./zipExtractor'),
  extractZip: jest.fn(),
}));

jest.mock('../../api-util/sdk', () => ({
  getSdk: jest.fn(),
}));

const { processImportJob } = require('./importWorker');
const { extractZip } = require('./zipExtractor');
const { parseCsv, validateRows } = require('./csvParser');
const { createJob, getJob, _test: jobStoreTest } = require('./jobStore');
const { getSdk } = require('../../api-util/sdk');
const router = require('./index');
const { _test: authTest } = require('./auth');
const { _test: rateLimiterTest } = require('./rateLimiter');
const { classifyUpload, MAX_ZIP_UPLOAD_BYTES } = router._test;

const ORIGINAL_ENV = process.env;

const validCsvBuffer = Buffer.from(
  [
    'title,description,price,currency,image_front,image_back,image_horizontal,image_details',
    '"Vintage Dress","A great dress","450.00","MXN","front.jpg","back.jpg","horizontal.jpg","details.jpg"',
  ].join('\n')
);

const defaultImageMap = new Map([
  ['front.jpg', Buffer.from('front')],
  ['back.jpg', Buffer.from('back')],
  ['horizontal.jpg', Buffer.from('horizontal')],
  ['details.jpg', Buffer.from('details')],
]);

function getRouteStack(path, method) {
  const layer = router.stack.find(
    item => item.route?.path === path && item.route.methods?.[method]
  );
  return layer.route.stack.map(item => item.handle);
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

describe('bulk import router', () => {
  const [authorizeSessionMiddleware, authorizeHandler] = getRouteStack('/authorize', 'post');
  const [, startTokenMiddleware, , startHandler] = getRouteStack('/start', 'post');
  const [, statusTokenMiddleware, statusHandler] = getRouteStack('/status/:jobId', 'get');
  const [templateHandler] = getRouteStack('/template', 'get');

  beforeEach(() => {
    jest.clearAllMocks();
    authTest.tokenStore.clear();
    jobStoreTest.reset();
    rateLimiterTest.store.clear();
    process.env = {
      ...ORIGINAL_ENV,
      BULK_IMPORT_OPERATOR_EMAILS: 'operator@example.com',
    };
    getSdk.mockReturnValue({
      currentUser: {
        show: jest.fn(() =>
          Promise.resolve({
            data: {
              data: {
                id: { uuid: 'operator-user-id' },
                attributes: { email: 'operator@example.com' },
              },
            },
          })
        ),
      },
    });
    // Default: successful extraction
    extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: defaultImageMap });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('starts a valid import job', () => {
    const req = {
      file: { buffer: Buffer.from('fake-zip') },
      bulkImportUser: { userId: 'operator-user-id', isAdmin: true },
    };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.total).toBe(1);
    expect(processImportJob).toHaveBeenCalledTimes(1);
  });

  describe('bare CSV upload', () => {
    const csvFile = (buffer, name = 'listings.csv') => ({
      buffer,
      size: buffer.length,
      originalname: name,
      mimetype: 'text/csv',
    });

    it('starts a job from a CSV alone, with every row on the placeholder', () => {
      const req = {
        file: csvFile(validCsvBuffer),
        bulkImportUser: { userId: 'operator-user-id', isAdmin: true },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(202);
      expect(res.body.total).toBe(1);
      // The ZIP extractor is never reached for a bare CSV.
      expect(extractZip).not.toHaveBeenCalled();

      const [, rows, imageMap] = processImportJob.mock.calls[0];
      expect(imageMap.size).toBe(0);
      // The CSV names four images; none exist, so the row falls back to the
      // placeholder instead of failing validation.
      expect(rows[0].usePlaceholderImage).toBe(true);
      expect(rows[0].imageSlots).toEqual({});
    });

    it('rejects a CSV over the 5 MB cap', () => {
      const req = {
        file: csvFile(Buffer.alloc(5 * 1024 * 1024 + 1, 'a')),
        bulkImportUser: { userId: 'operator-user-id', isAdmin: true },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/5 MB/);
      expect(processImportJob).not.toHaveBeenCalled();
    });

    it('rejects an empty CSV', () => {
      const req = {
        file: csvFile(Buffer.alloc(0)),
        bulkImportUser: { userId: 'operator-user-id', isAdmin: true },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/vacío/);
      expect(processImportJob).not.toHaveBeenCalled();
    });

    it('still enforces the per-tier row cap on a CSV upload', () => {
      const header = 'title,description,price';
      const rows = Array.from({ length: 26 }, (_, i) => `"Item ${i}","Descripción","100.00"`);
      const req = {
        file: csvFile(Buffer.from([header, ...rows].join('\n'))),
        // Standard tier: 25 rows.
        bulkImportUser: { userId: 'seller-user-id', isAdmin: false },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Tu límite es 25/);
    });
  });

  it('issues an action token and flags admins for a session in the operator emails', async () => {
    const req = {};
    const res = createMockRes();
    const next = jest.fn();

    await authorizeSessionMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    authorizeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(authTest.validateActionToken(res.body.token, 'operator-user-id')).toBe(true);
  });

  it('authorizes any signed-in user as a non-admin when not in the operator emails', async () => {
    getSdk.mockReturnValue({
      currentUser: {
        show: jest.fn(() =>
          Promise.resolve({
            data: {
              data: {
                id: { uuid: 'regular-user-id' },
                attributes: { email: 'seller@example.com' },
              },
            },
          })
        ),
      },
    });

    const req = {};
    const res = createMockRes();
    const next = jest.fn();

    await authorizeSessionMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    authorizeHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.isAdmin).toBe(false);
  });

  it('returns 401 when the session is missing', async () => {
    getSdk.mockReturnValue({
      currentUser: {
        show: jest.fn(() => Promise.reject(new Error('no session'))),
      },
    });

    const req = {};
    const res = createMockRes();
    const next = jest.fn();

    await authorizeSessionMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/sesión iniciada/);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when action token is missing', () => {
    const req = {
      get: jest.fn(() => undefined),
      bulkImportUser: { userId: 'operator-user-id' },
    };
    const res = createMockRes();
    const next = jest.fn();

    statusTokenMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Token de acción/);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows start and status with a valid action token for the current operator', async () => {
    const { token } = authTest.issueActionToken('operator-user-id');
    const req = {
      get: jest.fn(name => (name === 'X-Bulk-Import-Token' ? token : undefined)),
      bulkImportUser: { userId: 'operator-user-id' },
    };
    const res = createMockRes();
    const next = jest.fn();

    startTokenMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    statusTokenMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when zip file is missing', () => {
    const req = { file: null };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/No se subió ningún archivo/);
  });

  it('returns 400 when zipExtractor throws (e.g. corrupt archive or no CSV)', () => {
    extractZip.mockImplementation(() => {
      throw new Error('El ZIP no contiene ningún archivo .csv.');
    });

    const req = {
      file: { buffer: Buffer.from('bad-zip') },
      bulkImportUser: { userId: 'operator-user-id', isAdmin: true },
    };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/no contiene ningún archivo .csv/);
  });

  it.each(['image_front', 'image_back', 'image_horizontal'])(
    'returns 400 when CSV references a %s filename not present in imageMap',
    missingSlot => {
      const slotFile = `${missingSlot.replace('image_', '')}.jpg`;
      const partialMap = new Map(defaultImageMap);
      partialMap.delete(slotFile);
      extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: partialMap });

      const req = {
        file: { buffer: Buffer.from('zip') },
        bulkImportUser: { userId: 'operator-user-id', isAdmin: true },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`(${missingSlot}) no se encontró en los archivos subidos`),
        ])
      );
    }
  );

  it('authors listings to the signed-in user when no user_id column is present', () => {
    extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: defaultImageMap });

    const req = {
      file: { buffer: Buffer.from('zip') },
      bulkImportUser: { userId: 'operator-user-id', isAdmin: false },
    };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(202);
    const rows = processImportJob.mock.calls[0][1];
    expect(rows[0].authorId).toBe('operator-user-id');
  });

  describe('tiered limits', () => {
    it('rejects a ZIP larger than the standard-tier byte cap', () => {
      const req = {
        file: { buffer: Buffer.from('zip'), size: 30 * 1024 * 1024 }, // 30 MB > standard 20 MB
        bulkImportUser: { userId: 'seller-id', isAdmin: false },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/El ZIP supera tu límite de 20 MB/);
    });

    it('allows admins a ZIP above the standard cap (up to the admin cap)', () => {
      extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: defaultImageMap });
      const req = {
        file: { buffer: Buffer.from('zip'), size: 30 * 1024 * 1024 }, // under admin 50 MB
        bulkImportUser: { userId: 'admin-id', isAdmin: true },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(202);
    });

    it('rejects more images than the standard-tier cap', () => {
      const bigMap = new Map(defaultImageMap);
      for (let i = 0; i < 100; i++) bigMap.set(`extra-${i}.jpg`, Buffer.from('x'));
      extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: bigMap });

      const req = {
        file: { buffer: Buffer.from('zip') },
        bulkImportUser: { userId: 'seller-id', isAdmin: false },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Demasiadas imágenes/);
    });

    it('rejects more rows than the standard-tier cap', () => {
      const header =
        'title,description,price,currency,image_front,image_back,image_horizontal,image_details';
      const row =
        '"Dress","desc","100","MXN","front.jpg","back.jpg","horizontal.jpg","details.jpg"';
      const manyRows = Buffer.from([header, ...Array.from({ length: 26 }, () => row)].join('\n'));
      extractZip.mockReturnValue({ csvBuffer: manyRows, imageMap: defaultImageMap });

      const req = {
        file: { buffer: Buffer.from('zip') },
        bulkImportUser: { userId: 'seller-id', isAdmin: false },
      };
      const res = createMockRes();

      startHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Tu límite es 25/);
    });
  });

  it('returns 429 when the user is over their hourly import cap', () => {
    extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: defaultImageMap });
    // Pre-seed the standard tier's 3 allowed imports within the hour.
    const now = Date.now();
    rateLimiterTest.store.set('seller-id', [now, now, now]);

    const req = {
      file: { buffer: Buffer.from('zip') },
      bulkImportUser: { userId: 'seller-id', isAdmin: false },
    };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/Demasiadas importaciones/);
    expect(processImportJob).not.toHaveBeenCalled();
  });

  it('returns 409 when the same user already has an active job', () => {
    extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: defaultImageMap });
    createJob(1, 'seller-id'); // pre-existing in-progress job for this user

    const req = {
      file: { buffer: Buffer.from('zip') },
      bulkImportUser: { userId: 'seller-id', isAdmin: false },
    };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/una importación en curso/);
    expect(processImportJob).not.toHaveBeenCalled();
  });

  it('lets a different user start while another user has an active job', () => {
    extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: defaultImageMap });
    createJob(1, 'other-user'); // someone else is importing

    const req = {
      file: { buffer: Buffer.from('zip') },
      bulkImportUser: { userId: 'seller-id', isAdmin: false },
    };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(202);
    // The new job is owned by the user who started it.
    const newJobId = processImportJob.mock.calls[0][0];
    expect(getJob(newJobId).ownerId).toBe('seller-id');
  });

  it('returns 503 when global concurrency is full', () => {
    extractZip.mockReturnValue({ csvBuffer: validCsvBuffer, imageMap: defaultImageMap });
    // Fill the 3 global slots with other users' jobs.
    createJob(1, 'u1');
    createJob(1, 'u2');
    createJob(1, 'u3');

    const req = {
      file: { buffer: Buffer.from('zip') },
      bulkImportUser: { userId: 'seller-id', isAdmin: false },
    };
    const res = createMockRes();

    startHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/capacidad de importación está llena/);
    expect(processImportJob).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown job status', () => {
    const req = { params: { jobId: 'unknown-job' } };
    const res = createMockRes();

    statusHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/Trabajo no encontrado/);
  });

  it('returns job status to the job owner', () => {
    const job = createJob(2, 'owner-id');
    const req = { params: { jobId: job.id }, bulkImportUser: { userId: 'owner-id' } };
    const res = createMockRes();

    statusHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(job.id);
    expect(res.body.total).toBe(2);
    expect(res.body.status).toBe('processing');
  });

  it("returns 404 when polling another user's job (owner-scoped)", () => {
    const job = createJob(2, 'owner-id');
    const req = { params: { jobId: job.id }, bulkImportUser: { userId: 'someone-else' } };
    const res = createMockRes();

    statusHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/Trabajo no encontrado/);
  });

  it('downloads the csv template without authentication', () => {
    const req = {};
    const res = createMockRes();

    templateHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/csv');
    expect(res.headers['Content-Disposition']).toBe(
      'attachment; filename="bulk-import-template.csv"'
    );
    expect(res.body).toContain('imagen_1,imagen_2,imagen_3,imagen_4');
  });

  describe('csv template fields', () => {
    let templateBody;

    beforeEach(() => {
      const req = {};
      const res = createMockRes();
      templateHandler(req, res);
      templateBody = res.body;
    });

    it('uses the pub_ prefix for public-data columns', () => {
      expect(templateBody).toContain('pub_genero');
      expect(templateBody).toContain('pub_estado');
      expect(templateBody).toContain('pub_estilo');
      expect(templateBody).toContain('pub_categoryLevel3');
    });

    it('uses imagen_N image columns', () => {
      expect(templateBody).toContain('imagen_1');
      expect(templateBody).toContain('imagen_4');
    });

    it('parses cleanly back through the importer with valid values', () => {
      // Round-trip: the served template must validate against its own example row.
      const { rows, headerMap } = parseCsv(Buffer.from(templateBody));
      const imageMap = new Map();
      for (const r of rows) {
        for (const k of ['image_front', 'image_back', 'image_horizontal', 'image_details']) {
          if (r[k] && r[k].trim()) imageMap.set(r[k].trim(), Buffer.from('x'));
        }
      }
      const result = validateRows(rows, imageMap, { currentUserId: 'me', headerMap });
      expect(result.valid).toBe(true);
      expect(result.rows[0].price).toBe(450);
      expect(result.rows[0].publicData.brand).toBe('zara');
    });
  });

  describe('upload validation', () => {
    it('accepts .zip files with common ZIP MIME types', () => {
      expect(classifyUpload({ originalname: 'import.zip', mimetype: 'application/zip' })).toBe(
        'zip'
      );
      expect(
        classifyUpload({
          originalname: 'import.ZIP',
          mimetype: 'application/x-zip-compressed',
        })
      ).toBe('zip');
      expect(
        classifyUpload({ originalname: 'import.zip', mimetype: 'application/octet-stream' })
      ).toBe('zip');
    });

    it('accepts a bare .csv with the MIME types spreadsheets actually send', () => {
      // Excel sends application/vnd.ms-excel for a CSV; some browsers send text/plain.
      expect(classifyUpload({ originalname: 'listings.csv', mimetype: 'text/csv' })).toBe('csv');
      expect(
        classifyUpload({ originalname: 'listings.CSV', mimetype: 'application/vnd.ms-excel' })
      ).toBe('csv');
      expect(classifyUpload({ originalname: 'listings.csv', mimetype: 'text/plain' })).toBe('csv');
      expect(
        classifyUpload({ originalname: 'listings.csv', mimetype: 'application/octet-stream' })
      ).toBe('csv');
    });

    it('rejects mismatched extensions and unsupported file types', () => {
      expect(
        classifyUpload({ originalname: 'import.csv', mimetype: 'application/zip' })
      ).toBeNull();
      expect(classifyUpload({ originalname: 'import.zip', mimetype: 'text/csv' })).toBeNull();
      expect(classifyUpload({ originalname: 'notes.txt', mimetype: 'text/plain' })).toBeNull();
    });

    it('caps compressed ZIP uploads at 50 MB', () => {
      expect(MAX_ZIP_UPLOAD_BYTES).toBe(50 * 1024 * 1024);
    });
  });
});
