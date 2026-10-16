'use strict';

// Mock the Integration SDK before requiring the module
jest.mock('../../services/integrationSdk', () => ({
  getIntegrationSdk: jest.fn(),
}));

jest.mock('./placeholderImage', () => {
  const actual = jest.requireActual('./placeholderImage');
  return { ...actual, getPlaceholderImage: jest.fn(actual.getPlaceholderImage) };
});

const { getIntegrationSdk } = require('../../services/integrationSdk');
const { getPlaceholderImage } = require('./placeholderImage');
const { createJob, getJob } = require('./jobStore');
const { processImportJob, _test: workerTest } = require('./importWorker');
const { assignRowKeys, _test: idempotencyTest } = require('./rowIdempotency');

// Suppress console.error/log during tests
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
  console.log.mockRestore();
});

function createMockSdk() {
  return {
    images: {
      upload: jest.fn().mockResolvedValue({
        data: { data: { id: { uuid: 'img-uuid-123' } } },
      }),
    },
    listings: {
      create: jest.fn().mockResolvedValue({
        data: {
          data: { id: { uuid: 'listing-uuid-456' }, attributes: { state: 'pendingApproval' } },
        },
      }),
      approve: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      // No earlier imports by default.
      query: jest
        .fn()
        .mockResolvedValue({ data: { data: [], included: [], meta: { totalPages: 1 } } }),
    },
    stock: {
      compareAndSet: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeRow(overrides = {}) {
  return {
    rowNum: 2,
    title: 'Test Dress',
    description: 'A nice dress',
    price: 250,
    currency: 'MXN',
    authorId: 'author-uuid-789',
    publish: true,
    stock: 1,
    shippingEnabled: true,
    pickupEnabled: false,
    locationAddress: '',
    lat: null,
    lng: null,
    imageSlots: {},
    publicData: {
      categoryLevel1: 'ropa',
      categoryLevel2: 'ropa-vestidos',
      color: 'blue',
    },
    ...overrides,
  };
}

describe('processImportJob', () => {
  beforeEach(() => {
    idempotencyTest.reset();
    process.env.BULK_IMPORT_LISTING_TYPE = 'product-selling';
    process.env.BULK_IMPORT_TRANSACTION_ALIAS = 'default-purchase/release-1';
    process.env.BULK_IMPORT_UNIT_TYPE = 'item';
  });

  afterEach(() => {
    delete process.env.BULK_IMPORT_LISTING_TYPE;
    delete process.env.BULK_IMPORT_TRANSACTION_ALIAS;
    delete process.env.BULK_IMPORT_UNIT_TYPE;
  });

  it('processes a single row successfully', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    const rows = [makeRow()];
    const imageMap = new Map();

    await processImportJob(job.id, rows, imageMap);

    const finalJob = getJob(job.id);
    expect(finalJob.status).toBe('completed');
    expect(finalJob.processed).toBe(1);
    expect(finalJob.succeeded).toBe(1);
    expect(finalJob.failed).toBe(0);
    expect(finalJob.results).toHaveLength(1);
    expect(finalJob.results[0].listingId).toBe('listing-uuid-456');
    expect(finalJob.results[0].status).toBe('published');
  });

  it('creates listing with correct params', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    const rows = [makeRow({ price: 100, currency: 'USD' })];

    await processImportJob(job.id, rows, new Map());

    const createCall = mockSdk.listings.create.mock.calls[0];
    const params = createCall[0];

    expect(params.title).toBe('Test Dress');
    expect(params.description).toBe('A nice dress');
    // Price 100 * 100 = 10000 subunits
    expect(params.price.amount).toBe(10000);
    expect(params.price.currency).toBe('USD');
    expect(params.authorId.uuid).toBe('author-uuid-789');
    expect(params.publicData.listingType).toBe('product-selling');
    expect(params.publicData.transactionProcessAlias).toBe('default-purchase/release-1');
    expect(params.publicData.unitType).toBe('item');
    expect(params.publicData.color).toBe('blue');
    expect(params.publicData.avPackageSize).toBe('M');
  });

  it.each([
    ['S', 'ropa', 'ropa-lenceria'],
    ['M', 'ropa', 'ropa-vestidos'],
    ['L', 'zapatos', 'zapatos-tenis_deportivos'],
  ])(
    'persists package size %s from the imported category path',
    async (expectedSize, categoryLevel1, categoryLevel2) => {
      const mockSdk = createMockSdk();
      getIntegrationSdk.mockReturnValue(mockSdk);

      const job = createJob(1);
      const row = makeRow({
        publicData: { categoryLevel1, categoryLevel2 },
      });

      await processImportJob(job.id, [row], new Map());

      const params = mockSdk.listings.create.mock.calls[0][0];
      expect(params.publicData.avPackageSize).toBe(expectedSize);
    }
  );

  it('does not allow a CSV publicData value to override the category-derived package size', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    const row = makeRow({
      publicData: {
        categoryLevel1: 'ropa',
        categoryLevel2: 'ropa-lenceria',
        avPackageSize: 'L',
      },
    });

    await processImportJob(job.id, [row], new Map());

    const params = mockSdk.listings.create.mock.calls[0][0];
    expect(params.publicData.avPackageSize).toBe('S');
  });

  it('writes system-owned publicData after the CSV values, so a row cannot override them', async () => {
    // validateRows rejects these columns; this covers a row that bypassed it.
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    const row = makeRow({
      shippingEnabled: true,
      pickupEnabled: false,
      publicData: {
        categoryLevel1: 'ropa',
        color: ['azul'],
        listingType: 'free-listing',
        transactionProcessAlias: 'default-inquiry/release-1',
        unitType: 'hour',
        shippingEnabled: false,
        pickupEnabled: true,
        location: { address: 'spoofed' },
        imageSlots: { front: 'spoofed' },
        avPlaceholderImage: true,
        avPlaceholderImageId: 'spoofed',
        tags: ['hot-list'],
      },
    });

    await processImportJob(job.id, [row], new Map());

    const { publicData } = mockSdk.listings.create.mock.calls[0][0];
    expect(publicData.listingType).toBe('product-selling');
    expect(publicData.transactionProcessAlias).toBe('default-purchase/release-1');
    expect(publicData.unitType).toBe('item');
    expect(publicData.shippingEnabled).toBe(true);
    expect(publicData.pickupEnabled).toBe(false);
    expect(publicData.color).toEqual(['azul']);
    // Set by the worker only when it has a real value; never from the CSV.
    expect(publicData.location).toBeUndefined();
    expect(publicData.imageSlots).toBeUndefined();
    expect(publicData.avPlaceholderImage).toBeUndefined();
    expect(publicData.avPlaceholderImageId).toBeUndefined();
    expect(publicData.tags).toBeUndefined();
  });

  it('uploads images and maps to imageSlots', async () => {
    const mockSdk = createMockSdk();
    let imageCallCount = 0;
    mockSdk.images.upload.mockImplementation(() => {
      imageCallCount += 1;
      return Promise.resolve({
        data: { data: { id: { uuid: `img-uuid-${imageCallCount}` } } },
      });
    });
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    const rows = [makeRow({ imageSlots: { front: 'a.jpg', back: 'b.jpg' } })];
    const imageMap = new Map();
    imageMap.set('a.jpg', Buffer.from('img-a'));
    imageMap.set('b.jpg', Buffer.from('img-b'));

    await processImportJob(job.id, rows, imageMap);

    expect(mockSdk.images.upload).toHaveBeenCalledTimes(2);
    const createParams = mockSdk.listings.create.mock.calls[0][0];
    expect(createParams.publicData.imageSlots).toEqual({
      front: 'img-uuid-1',
      back: 'img-uuid-2',
    });
    expect(createParams.images).toHaveLength(2);
  });

  it('sets stock via compareAndSet', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    const rows = [makeRow({ stock: 5 })];

    await processImportJob(job.id, rows, new Map());

    expect(mockSdk.stock.compareAndSet).toHaveBeenCalledTimes(1);
    const stockCall = mockSdk.stock.compareAndSet.mock.calls[0][0];
    expect(stockCall.newTotal).toBe(5);
    expect(stockCall.oldTotal).toBeNull();
  });

  it('does not call listings.close when publish is true', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ publish: true })], new Map());

    expect(mockSdk.listings.close).not.toHaveBeenCalled();
  });

  it('calls listings.close when publish is false', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ publish: false })], new Map());

    expect(mockSdk.listings.close).toHaveBeenCalledTimes(1);

    const finalJob = getJob(job.id);
    expect(finalJob.results[0].status).toBe('closed');
  });

  it('includes geolocation when lat/lng provided', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ lat: 19.43, lng: -99.13 })], new Map());

    const params = mockSdk.listings.create.mock.calls[0][0];
    expect(params.geolocation.lat).toBe(19.43);
    expect(params.geolocation.lng).toBe(-99.13);
  });

  it('omits geolocation when lat/lng are null', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow()], new Map());

    const params = mockSdk.listings.create.mock.calls[0][0];
    expect(params.geolocation).toBeUndefined();
  });

  it('uses the row authorId resolved upstream', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ authorId: 'custom-author' })], new Map());

    const params = mockSdk.listings.create.mock.calls[0][0];
    expect(params.authorId.uuid).toBe('custom-author');
  });

  it('handles row failure without aborting batch', async () => {
    const mockSdk = createMockSdk();
    let callCount = 0;
    mockSdk.listings.create.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new Error('API error'));
      }
      return Promise.resolve({
        data: { data: { id: { uuid: 'listing-2' } } },
      });
    });
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(2);
    const rows = [makeRow({ rowNum: 2 }), makeRow({ rowNum: 3, title: 'Second' })];

    await processImportJob(job.id, rows, new Map());

    const finalJob = getJob(job.id);
    expect(finalJob.status).toBe('completed');
    expect(finalJob.succeeded).toBe(1);
    expect(finalJob.failed).toBe(1);
    expect(finalJob.errors).toHaveLength(1);
    expect(finalJob.errors[0].row).toBe(2);
    expect(finalJob.errors[0].error).toBe('API error');
    expect(finalJob.results).toHaveLength(1);
    expect(finalJob.results[0].row).toBe(3);
  });

  it('fails row when no author is resolved', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ authorId: '' })], new Map());

    const finalJob = getJob(job.id);
    expect(finalJob.failed).toBe(1);
    expect(finalJob.errors[0].error).toMatch(/No se resolvió ningún autor/);
  });

  it('includes location in publicData when address provided', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ locationAddress: 'CDMX, México' })], new Map());

    const params = mockSdk.listings.create.mock.calls[0][0];
    expect(params.publicData.location).toEqual({ address: 'CDMX, México' });
  });

  // --- Placeholder image for rows that reference no photo ---

  describe('placeholder image', () => {
    it('uploads the bundled placeholder as the only image of a flagged row', async () => {
      const mockSdk = createMockSdk();
      getIntegrationSdk.mockReturnValue(mockSdk);

      const job = createJob(1);
      const row = makeRow({ imageSlots: {}, usePlaceholderImage: true });

      await processImportJob(job.id, [row], new Map());

      expect(getJob(job.id).succeeded).toBe(1);
      expect(mockSdk.images.upload).toHaveBeenCalledTimes(1);
      // The temp file the SDK uploads keeps the placeholder's extension so the
      // request carries the right MIME type.
      expect(mockSdk.images.upload.mock.calls[0][0].image).toMatch(/\.jpe?g$|\.png$|\.webp$/);

      const params = mockSdk.listings.create.mock.calls[0][0];
      expect(params.images).toHaveLength(1);
      // No slot captions: the placeholder is not a "front"/"back" photo.
      expect(params.publicData.imageSlots).toBeUndefined();
      expect(params.publicData.avPlaceholderImage).toBe(true);
      // The uploaded placeholder's own id, so a later listing edit can tell whether
      // the placeholder is still attached (src/util/avPlaceholderListing.js).
      expect(params.publicData.avPlaceholderImageId).toBe('img-uuid-123');
    });

    it('does not flag or upload a placeholder for a row that has its own images', async () => {
      const mockSdk = createMockSdk();
      getIntegrationSdk.mockReturnValue(mockSdk);

      const job = createJob(1);
      const row = makeRow({ imageSlots: { front: 'a.jpg' }, usePlaceholderImage: false });
      const imageMap = new Map([['a.jpg', Buffer.from('img-a')]]);

      await processImportJob(job.id, [row], imageMap);

      expect(mockSdk.images.upload).toHaveBeenCalledTimes(1);
      const params = mockSdk.listings.create.mock.calls[0][0];
      expect(params.publicData.imageSlots).toEqual({ front: 'img-uuid-123' });
      expect(params.publicData.avPlaceholderImage).toBeUndefined();
      expect(params.publicData.avPlaceholderImageId).toBeUndefined();
    });

    it('fails only the flagged row when the placeholder asset cannot be loaded', async () => {
      const mockSdk = createMockSdk();
      getIntegrationSdk.mockReturnValue(mockSdk);
      getPlaceholderImage.mockImplementationOnce(() => {
        const err = new Error('No se encontró la imagen de reemplazo');
        err.avCode = 'placeholder-missing';
        throw err;
      });

      const job = createJob(2);
      const rows = [
        makeRow({ rowNum: 2, usePlaceholderImage: true }),
        makeRow({ rowNum: 3, imageSlots: { front: 'a.jpg' } }),
      ];
      const imageMap = new Map([['a.jpg', Buffer.from('img-a')]]);

      await processImportJob(job.id, rows, imageMap);

      const finalJob = getJob(job.id);
      expect(finalJob.failed).toBe(1);
      expect(finalJob.succeeded).toBe(1);
      expect(finalJob.errors[0].row).toBe(2);
      expect(finalJob.errors[0].code).toBe('placeholder-missing');
      expect(mockSdk.listings.create).toHaveBeenCalledTimes(1);
    });
  });

  it('bounds a hanging row so the job fails it instead of wedging in processing', async () => {
    const mockSdk = createMockSdk();
    // The row's first SDK call never resolves. Shrink the per-row timeout so the
    // test stays fast while exercising the real timeout wiring in processImportJob.
    mockSdk.images.upload.mockReturnValue(new Promise(() => {}));
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1, 'owner-hang');
    const row = makeRow({ imageSlots: { front: 'front.jpg' } });
    const imageMap = new Map([['front.jpg', Buffer.from('x')]]);

    // Shrink the per-row timeout so the test stays fast while exercising the real
    // timeout wiring in processImportJob.
    await processImportJob(job.id, [row], imageMap, { rowTimeoutMs: 30, reconcileGraceMs: 10 });

    const finalJob = getJob(job.id);
    expect(finalJob.status).toBe('completed');
    expect(finalJob.failed).toBe(1);
    expect(finalJob.errors[0].error).toMatch(/timed out/);
    // Carries the synthetic code the client maps to a translated message.
    expect(finalJob.errors[0].code).toBe('row-timeout');
  });
});

// A listings.query response holding one earlier import of `row`.
function priorImportResponse(row, { state = 'pendingApproval', stock = null, complete = false }) {
  const [{ importKey }] = assignRowKeys([row], new Map());
  const stockRef = { id: { uuid: 'stock-1' }, type: 'stock' };
  return {
    data: {
      data: [
        {
          id: { uuid: 'prior-listing' },
          type: 'listing',
          attributes: { state, metadata: { avBulkImport: { key: importKey, complete } } },
          relationships: { currentStock: { data: stock == null ? null : stockRef } },
        },
      ],
      included: stock == null ? [] : [{ ...stockRef, attributes: { quantity: stock } }],
      meta: { totalPages: 1 },
    },
  };
}

describe('processImportJob idempotency and compensation', () => {
  beforeEach(() => {
    idempotencyTest.reset();
  });

  it('creates the listing hidden, sets stock before approving, then marks it complete', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ stock: 3 })], new Map());

    const params = mockSdk.listings.create.mock.calls[0][0];
    expect(params.state).toBe('pendingApproval');
    const { key } = params.metadata.avBulkImport;
    expect(key).toMatch(/^[0-9a-f]{40}-0$/);
    expect(params.metadata.avBulkImport.complete).toBe(false);

    const order = fn => fn.mock.invocationCallOrder[0];
    expect(order(mockSdk.stock.compareAndSet)).toBeLessThan(order(mockSdk.listings.approve));
    expect(order(mockSdk.listings.approve)).toBeLessThan(order(mockSdk.listings.update));
    expect(mockSdk.listings.update.mock.calls[0][0].metadata).toEqual({
      avBulkImport: { key, complete: true },
    });

    const finalJob = getJob(job.id);
    expect(finalJob.succeeded).toBe(1);
    expect(finalJob.results[0]).toMatchObject({ status: 'published', outcome: 'created' });
  });

  it('looks up earlier imports once per author, within the idempotency window', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(3);
    const rows = [
      makeRow({ rowNum: 2, title: 'A' }),
      makeRow({ rowNum: 3, title: 'B' }),
      makeRow({ rowNum: 4, title: 'C', authorId: 'other-author' }),
    ];
    await processImportJob(job.id, rows, new Map());

    expect(mockSdk.listings.query).toHaveBeenCalledTimes(2);
    const params = mockSdk.listings.query.mock.calls[0][0];
    expect(params.authorId.uuid).toBe('author-uuid-789');
    expect(params.states).toEqual(['published', 'closed', 'pendingApproval']);
    expect(params.createdAtStart).toBeInstanceOf(Date);
  });

  it('leaves the listing hidden and reports it when setting stock fails', async () => {
    const mockSdk = createMockSdk();
    mockSdk.stock.compareAndSet.mockRejectedValue(new Error('stock down'));
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ stock: 2 })], new Map());

    expect(mockSdk.listings.approve).not.toHaveBeenCalled();
    const finalJob = getJob(job.id);
    expect(finalJob.failed).toBe(1);
    expect(finalJob.errors[0]).toMatchObject({
      code: 'row-incomplete',
      listingId: 'listing-uuid-456',
      listingState: 'pendingApproval',
    });
  });

  it('closes a publish:no listing again when its close step fails', async () => {
    const mockSdk = createMockSdk();
    mockSdk.listings.close
      .mockRejectedValueOnce(new Error('close failed'))
      .mockResolvedValueOnce({});
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow({ publish: false })], new Map());

    expect(mockSdk.listings.close).toHaveBeenCalledTimes(2);
    const finalJob = getJob(job.id);
    expect(finalJob.errors[0]).toMatchObject({ code: 'row-incomplete', listingState: 'closed' });
  });

  it('does not fail a finished row when only the completion marker fails', async () => {
    const mockSdk = createMockSdk();
    mockSdk.listings.update.mockRejectedValue(new Error('update failed'));
    getIntegrationSdk.mockReturnValue(mockSdk);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const job = createJob(1);
    await processImportJob(job.id, [makeRow()], new Map());

    expect(getJob(job.id).succeeded).toBe(1);
    expect(getJob(job.id).failed).toBe(0);
    console.warn.mockRestore();
  });

  it('skips a row an earlier upload already imported completely', async () => {
    const mockSdk = createMockSdk();
    const row = makeRow({ imageSlots: { front: 'a.jpg' } });
    const imageMap = new Map([['a.jpg', Buffer.from('img-a')]]);
    mockSdk.listings.query.mockResolvedValue(
      // Keys hash image bytes, so the response must be built with the same map.
      (() => {
        const [{ importKey }] = assignRowKeys([row], imageMap);
        const res = priorImportResponse(row, { state: 'published', stock: 1, complete: true });
        res.data.data[0].attributes.metadata.avBulkImport.key = importKey;
        return res;
      })()
    );
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [row], imageMap);

    expect(mockSdk.images.upload).not.toHaveBeenCalled();
    expect(mockSdk.listings.create).not.toHaveBeenCalled();
    const finalJob = getJob(job.id);
    expect(finalJob.existing).toBe(1);
    expect(finalJob.succeeded).toBe(0);
    expect(finalJob.results[0]).toMatchObject({ listingId: 'prior-listing', outcome: 'existing' });
  });

  it('resumes a listing an earlier attempt left hidden, without creating another', async () => {
    const mockSdk = createMockSdk();
    const row = makeRow({ stock: 4 });
    mockSdk.listings.query.mockResolvedValue(priorImportResponse(row, {}));
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [row], new Map());

    expect(mockSdk.listings.create).not.toHaveBeenCalled();
    expect(mockSdk.stock.compareAndSet.mock.calls[0][0]).toMatchObject({
      oldTotal: null,
      newTotal: 4,
    });
    expect(mockSdk.listings.approve.mock.calls[0][0].id.uuid).toBe('prior-listing');
    expect(getJob(job.id).results[0]).toMatchObject({ outcome: 'resumed', status: 'published' });
  });

  it('does not reset stock or re-approve when resuming a listing that has both', async () => {
    const mockSdk = createMockSdk();
    const row = makeRow({ stock: 4 });
    mockSdk.listings.query.mockResolvedValue(
      priorImportResponse(row, { state: 'published', stock: 4 })
    );
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [row], new Map());

    expect(mockSdk.stock.compareAndSet).not.toHaveBeenCalled();
    expect(mockSdk.listings.approve).not.toHaveBeenCalled();
    expect(mockSdk.listings.update).toHaveBeenCalledTimes(1);
  });

  it('never reopens an incomplete listing a seller closed', async () => {
    const mockSdk = createMockSdk();
    const row = makeRow({ publish: true });
    mockSdk.listings.query.mockResolvedValue(
      priorImportResponse(row, { state: 'closed', stock: 1 })
    );
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [row], new Map());

    expect(mockSdk.listings.approve).not.toHaveBeenCalled();
    expect(getJob(job.id).results[0].status).toBe('closed');
  });

  it('still creates two listings for two identical rows in one file', async () => {
    const mockSdk = createMockSdk();
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(2);
    await processImportJob(job.id, [makeRow({ rowNum: 2 }), makeRow({ rowNum: 3 })], new Map());

    expect(mockSdk.listings.create).toHaveBeenCalledTimes(2);
    const keys = mockSdk.listings.create.mock.calls.map(c => c[0].metadata.avBulkImport.key);
    expect(keys[0]).not.toBe(keys[1]);
    expect(getJob(job.id).succeeded).toBe(2);
  });

  it("fails an author's rows instead of risking duplicates when the lookup keeps failing", async () => {
    const mockSdk = createMockSdk();
    mockSdk.listings.query.mockRejectedValue(new Error('query down'));
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow()], new Map());

    // Retried once before giving up.
    expect(mockSdk.listings.query).toHaveBeenCalledTimes(2);
    expect(mockSdk.listings.create).not.toHaveBeenCalled();
    expect(getJob(job.id).errors[0].code).toBe('idempotency-check-failed');
  });

  it('reconciles a row whose create finished after the timeout', async () => {
    const mockSdk = createMockSdk();
    let createdKey = null;
    mockSdk.listings.create.mockImplementation(
      params =>
        new Promise(resolve =>
          setTimeout(() => {
            createdKey = params.metadata.avBulkImport.key;
            resolve({
              data: {
                data: { id: { uuid: 'late-listing' }, attributes: { state: 'pendingApproval' } },
              },
            });
          }, 60)
        )
    );
    // First lookup (before the row): nothing yet. Reconciliation lookup: the
    // listing the abandoned create made.
    mockSdk.listings.query.mockImplementation(() =>
      Promise.resolve({
        data: {
          data: createdKey
            ? [
                {
                  id: { uuid: 'late-listing' },
                  attributes: {
                    state: 'pendingApproval',
                    metadata: { avBulkImport: { key: createdKey, complete: false } },
                  },
                  relationships: {},
                },
              ]
            : [],
          included: [],
          meta: { totalPages: 1 },
        },
      })
    );
    getIntegrationSdk.mockReturnValue(mockSdk);

    const job = createJob(1);
    await processImportJob(job.id, [makeRow()], new Map(), {
      rowTimeoutMs: 30,
      reconcileGraceMs: 500,
    });

    expect(mockSdk.listings.create).toHaveBeenCalledTimes(1);
    // The abandoned attempt stopped after create; only reconciliation set stock.
    expect(mockSdk.stock.compareAndSet).toHaveBeenCalledTimes(1);
    expect(mockSdk.listings.approve.mock.calls[0][0].id.uuid).toBe('late-listing');

    const finalJob = getJob(job.id);
    expect(finalJob.status).toBe('completed');
    expect(finalJob.failed).toBe(0);
    expect(finalJob.succeeded).toBe(1);
    expect(finalJob.errors).toEqual([]);
    expect(finalJob.results[0]).toMatchObject({ listingId: 'late-listing', outcome: 'reconciled' });
  });

  it('refuses a row whose earlier attempt is still running in another job', async () => {
    const mockSdk = createMockSdk();
    mockSdk.images.upload.mockReturnValue(new Promise(() => {}));
    getIntegrationSdk.mockReturnValue(mockSdk);
    const row = makeRow({ imageSlots: { front: 'a.jpg' } });
    const imageMap = new Map([['a.jpg', Buffer.from('img-a')]]);

    const first = createJob(1);
    await processImportJob(first.id, [row], imageMap, { rowTimeoutMs: 20, reconcileGraceMs: 10 });
    expect(getJob(first.id).errors[0].code).toBe('row-timeout');

    const second = createJob(1);
    await processImportJob(second.id, [row], imageMap, { rowTimeoutMs: 20, reconcileGraceMs: 10 });
    expect(getJob(second.id).errors[0].code).toBe('row-in-flight');
    expect(mockSdk.images.upload).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  it('rejects when the promise does not settle in time', async () => {
    await expect(workerTest.withTimeout(new Promise(() => {}), 20, 'Fila 1')).rejects.toThrow(
      /timed out/
    );
  });

  it('resolves with the value when the promise settles in time', async () => {
    await expect(workerTest.withTimeout(Promise.resolve('ok'), 1000, 'Fila 1')).resolves.toBe('ok');
  });
});
