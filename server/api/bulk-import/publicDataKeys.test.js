'use strict';

const fs = require('fs');
const path = require('path');

const {
  ASSET_PATH,
  SYSTEM_PUBLIC_DATA_KEYS,
  IGNORED_PUBLIC_DATA_KEYS,
  TEMPLATE_PUBLIC_DATA_KEYS,
  resolveAllowedPublicDataKeys,
  omitSystemPublicDataKeys,
} = require('./publicDataKeys');

const assetResponse = listingFields => ({
  data: { data: [{ attributes: { data: { listingFields } } }] },
});

describe('SYSTEM_PUBLIC_DATA_KEYS', () => {
  it('covers every built-in public data key in configHelpers except the categories', () => {
    // configHelpers.js is ESM and cannot be required here, so read the list from
    // its source. A new upstream built-in key fails this until it is added.
    const source = fs.readFileSync(
      path.join(__dirname, '../../../src/util/configHelpers.js'),
      'utf8'
    );
    const match = source.match(/const builtInPublicDataKeys = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const builtIn = match[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
    expect(builtIn).toContain('listingType');

    const uncovered = builtIn.filter(
      key => !SYSTEM_PUBLIC_DATA_KEYS.has(key) && !/^categoryLevel\d$/.test(key)
    );
    expect(uncovered).toEqual([]);
  });

  it('includes the AV keys the import worker writes', () => {
    ['imageSlots', 'avPackageSize', 'avPlaceholderImage', 'avPlaceholderImageId'].forEach(key =>
      expect(SYSTEM_PUBLIC_DATA_KEYS.has(key)).toBe(true)
    );
  });

  it('shares no key with the template columns', () => {
    const overlap = [...TEMPLATE_PUBLIC_DATA_KEYS].filter(k => SYSTEM_PUBLIC_DATA_KEYS.has(k));
    expect(overlap).toEqual([]);
  });

  it('keeps tags ignored, not allowed', () => {
    expect(IGNORED_PUBLIC_DATA_KEYS.has('tags')).toBe(true);
    expect(TEMPLATE_PUBLIC_DATA_KEYS.has('tags')).toBe(false);
  });
});

describe('resolveAllowedPublicDataKeys', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => console.warn.mockRestore());

  it('reads the listing-fields asset', async () => {
    const sdk = { assetsByAlias: jest.fn().mockResolvedValue(assetResponse([])) };
    await resolveAllowedPublicDataKeys(sdk);
    expect(sdk.assetsByAlias).toHaveBeenCalledWith({ paths: [ASSET_PATH], alias: 'latest' });
  });

  it('adds public Console fields to the template columns', async () => {
    const sdk = {
      assetsByAlias: jest.fn().mockResolvedValue(
        assetResponse([
          { key: 'decada', scope: 'public' },
          { key: 'era' }, // no scope = public
          { key: 'internalNote', scope: 'private' },
          { key: 'adminFlag', scope: 'metadata' },
        ])
      ),
    };
    const allowed = await resolveAllowedPublicDataKeys(sdk);
    expect(allowed.has('decada')).toBe(true);
    expect(allowed.has('era')).toBe(true);
    expect(allowed.has('internalNote')).toBe(false);
    expect(allowed.has('adminFlag')).toBe(false);
    TEMPLATE_PUBLIC_DATA_KEYS.forEach(key => expect(allowed.has(key)).toBe(true));
  });

  it('never allows a system key, even when Console defines one', async () => {
    const sdk = {
      assetsByAlias: jest
        .fn()
        .mockResolvedValue(assetResponse([{ key: 'listingType', scope: 'public' }])),
    };
    const allowed = await resolveAllowedPublicDataKeys(sdk);
    expect(allowed.has('listingType')).toBe(false);
  });

  it('never allows an ignored key, even when Console makes it public', async () => {
    const sdk = {
      assetsByAlias: jest.fn().mockResolvedValue(assetResponse([{ key: 'tags', scope: 'public' }])),
    };
    const allowed = await resolveAllowedPublicDataKeys(sdk);
    expect(allowed.has('tags')).toBe(false);
  });

  it('falls back to the template columns when the fetch fails', async () => {
    const sdk = { assetsByAlias: jest.fn().mockRejectedValue(new Error('network down')) };
    const allowed = await resolveAllowedPublicDataKeys(sdk);
    expect([...allowed].sort()).toEqual([...TEMPLATE_PUBLIC_DATA_KEYS].sort());
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('network down'));
  });

  it('falls back when the SDK is unusable or the asset is missing', async () => {
    const fromBadSdk = await resolveAllowedPublicDataKeys(undefined);
    expect(fromBadSdk.has('brand')).toBe(true);

    const sdk = { assetsByAlias: jest.fn().mockResolvedValue({ data: { data: [] } }) };
    const fromEmpty = await resolveAllowedPublicDataKeys(sdk);
    expect([...fromEmpty].sort()).toEqual([...TEMPLATE_PUBLIC_DATA_KEYS].sort());
  });
});

describe('omitSystemPublicDataKeys', () => {
  it('drops system and ignored keys and keeps the rest', () => {
    const input = Object.assign(Object.create(null), {
      color: ['azul'],
      tags: ['hot-list'],
      listingType: 'free-listing',
      transactionProcessAlias: 'default-inquiry/release-1',
      unitType: 'hour',
      shippingEnabled: false,
      avPackageSize: 'L',
    });
    expect(omitSystemPublicDataKeys(input)).toEqual({ color: ['azul'] });
  });

  it('tolerates a missing object', () => {
    expect(omitSystemPublicDataKeys(undefined)).toEqual({});
  });
});
