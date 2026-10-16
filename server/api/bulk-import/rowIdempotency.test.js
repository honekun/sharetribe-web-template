'use strict';

const {
  IDEMPOTENCY_WINDOW_MS,
  assignRowKeys,
  findImportedListings,
  trackInFlight,
  isInFlight,
  getInFlight,
  _test,
} = require('./rowIdempotency');

const baseRow = (overrides = {}) => ({
  rowNum: 1,
  title: 'Vestido',
  description: 'Bonito',
  price: 450,
  currency: 'MXN',
  authorId: 'author-1',
  publish: true,
  stock: 1,
  shippingEnabled: true,
  pickupEnabled: false,
  locationAddress: '',
  lat: null,
  lng: null,
  imageSlots: {},
  usePlaceholderImage: true,
  publicData: { color: ['azul'], brand: 'zara' },
  ...overrides,
});

describe('assignRowKeys', () => {
  it('gives the same row the same key on every upload', () => {
    const [a] = assignRowKeys([baseRow()], new Map());
    const [b] = assignRowKeys([baseRow({ rowNum: 9 })], new Map());
    // The row's position in the file is not part of its identity.
    expect(a.importKey).toBe(b.importKey);
    expect(a.importKey).toMatch(/^[0-9a-f]{40}-0$/);
  });

  it('numbers identical rows in one file by occurrence', () => {
    const keys = assignRowKeys([baseRow(), baseRow(), baseRow({ title: 'Otro' })], new Map()).map(
      r => r.importKey
    );
    expect(keys[0].endsWith('-0')).toBe(true);
    expect(keys[1]).toBe(keys[0].replace(/-0$/, '-1'));
    expect(keys[2].endsWith('-0')).toBe(true);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('ignores publicData key order', () => {
    const [a] = assignRowKeys(
      [baseRow({ publicData: { color: ['azul'], brand: 'zara' } })],
      new Map()
    );
    const [b] = assignRowKeys(
      [baseRow({ publicData: { brand: 'zara', color: ['azul'] } })],
      new Map()
    );
    expect(a.importKey).toBe(b.importKey);
  });

  it.each([
    ['author', { authorId: 'author-2' }],
    ['price', { price: 451 }],
    ['stock', { stock: 2 }],
    ['publish flag', { publish: false }],
    ['publicData', { publicData: { color: ['negro'], brand: 'zara' } }],
  ])('changes the key when the %s changes', (_, overrides) => {
    const [a] = assignRowKeys([baseRow()], new Map());
    const [b] = assignRowKeys([baseRow(overrides)], new Map());
    expect(a.importKey).not.toBe(b.importKey);
  });

  it('hashes image bytes, not filenames', () => {
    const row = baseRow({ imageSlots: { front: 'a.jpg' }, usePlaceholderImage: false });
    const [a] = assignRowKeys([row], new Map([['a.jpg', Buffer.from('one')]]));
    const [b] = assignRowKeys([row], new Map([['a.jpg', Buffer.from('two')]]));
    const [c] = assignRowKeys([row], new Map([['a.jpg', Buffer.from('one')]]));
    expect(a.importKey).not.toBe(b.importKey);
    expect(a.importKey).toBe(c.importKey);
  });

  it('handles null-prototype publicData from the parser', () => {
    const publicData = Object.assign(Object.create(null), { brand: 'zara', color: ['azul'] });
    const [a] = assignRowKeys([baseRow({ publicData })], new Map());
    const [b] = assignRowKeys([baseRow()], new Map());
    expect(a.importKey).toBe(b.importKey);
  });
});

describe('findImportedListings', () => {
  const listing = (id, marker, stockRef) => ({
    id: { uuid: id },
    type: 'listing',
    attributes: { state: 'published', metadata: marker ? { avBulkImport: marker } : {} },
    relationships: { currentStock: { data: stockRef || null } },
  });

  it('queries the author within the window and maps listings by import key', async () => {
    const now = Date.UTC(2026, 9, 15);
    const stockRef = { id: { uuid: 's1' }, type: 'stock' };
    const sdk = {
      listings: {
        query: jest.fn().mockResolvedValue({
          data: {
            data: [
              listing('l1', { key: 'k1', complete: true }, stockRef),
              listing('l2', { key: 'k2' }),
              listing('l3', null), // created by hand, not by an import
            ],
            included: [{ ...stockRef, attributes: { quantity: 3 } }],
            meta: { totalPages: 1 },
          },
        }),
      },
    };

    const found = await findImportedListings(sdk, 'author-1', { now });

    const params = sdk.listings.query.mock.calls[0][0];
    expect(params.authorId.uuid).toBe('author-1');
    expect(params.createdAtStart).toEqual(new Date(now - IDEMPOTENCY_WINDOW_MS));
    expect(params.include).toEqual(['currentStock']);
    expect([...found.keys()]).toEqual(['k1', 'k2']);
    expect(found.get('k1')).toEqual({ id: 'l1', state: 'published', stock: 3, complete: true });
    expect(found.get('k2')).toEqual({ id: 'l2', state: 'published', stock: null, complete: false });
  });

  it('reads every page', async () => {
    const page = (n, totalPages) => ({
      data: { data: [listing(`l${n}`, { key: `k${n}` })], included: [], meta: { totalPages } },
    });
    const sdk = {
      listings: {
        query: jest
          .fn()
          .mockResolvedValueOnce(page(1, 2))
          .mockResolvedValueOnce(page(2, 2)),
      },
    };
    const found = await findImportedListings(sdk, 'author-1');
    expect(sdk.listings.query).toHaveBeenCalledTimes(2);
    expect(sdk.listings.query.mock.calls[1][0].page).toBe(2);
    expect(found.size).toBe(2);
  });

  it('refuses to guess when the author has more listings than it reads', async () => {
    const sdk = {
      listings: {
        query: jest
          .fn()
          .mockResolvedValue({ data: { data: [], included: [], meta: { totalPages: 999 } } }),
      },
    };
    await expect(findImportedListings(sdk, 'author-1')).rejects.toMatchObject({
      avCode: 'idempotency-check-failed',
    });
    expect(sdk.listings.query).toHaveBeenCalledTimes(_test.MAX_PAGES);
  });
});

describe('in-flight registry', () => {
  beforeEach(() => _test.reset());

  it('tracks a row until its attempt resolves', async () => {
    let resolve;
    const attempt = new Promise(r => {
      resolve = r;
    });
    trackInFlight('k1', attempt);
    expect(isInFlight('k1')).toBe(true);
    expect(getInFlight('k1')).toBe(attempt);
    resolve('done');
    await attempt;
    await Promise.resolve();
    expect(isInFlight('k1')).toBe(false);
  });

  it('clears a row whose attempt rejects, without an unhandled rejection', async () => {
    const attempt = Promise.reject(new Error('boom'));
    trackInFlight('k2', attempt);
    await expect(attempt).rejects.toThrow('boom');
    await Promise.resolve();
    expect(isInFlight('k2')).toBe(false);
  });
});
