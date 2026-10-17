'use strict';

const {
  FIELDS_ASSET_PATH,
  CATEGORIES_ASSET_PATH,
  resolveListingImportConfig,
} = require('./listingImportConfig');
const { TEMPLATE_PUBLIC_DATA_KEYS } = require('./publicDataKeys');

const asset = (assetPath, data) => ({ attributes: { assetPath, data } });
const sdkReturning = assets => ({
  assetsByAlias: jest.fn().mockResolvedValue({ data: { data: assets } }),
});

describe('resolveListingImportConfig', () => {
  it('reads both assets in one call', async () => {
    const sdk = sdkReturning([]);
    await resolveListingImportConfig(sdk);
    expect(sdk.assetsByAlias).toHaveBeenCalledWith({
      paths: [FIELDS_ASSET_PATH, CATEGORIES_ASSET_PATH],
      alias: 'latest',
    });
  });

  it('builds keys, options and categories from the assets', async () => {
    const sdk = sdkReturning([
      asset(CATEGORIES_ASSET_PATH, { categories: [{ id: 'ropa', name: 'Ropa' }] }),
      asset(FIELDS_ASSET_PATH, {
        listingFields: [
          {
            key: 'genero',
            scope: 'public',
            schemaType: 'enum',
            enumOptions: [{ option: 'mujer', label: 'Mujer' }],
          },
          { key: 'era', scope: 'public', schemaType: 'text' },
        ],
      }),
    ]);
    const config = await resolveListingImportConfig(sdk);

    expect(config.allowedPublicDataKeys.has('era')).toBe(true);
    expect(config.fieldOptions.get('genero').values).toEqual(['mujer']);
    expect(config.fieldOptions.has('color')).toBe(true); // code-defined
    expect(config.categoryTree).toEqual([{ id: 'ropa', name: 'Ropa', subcategories: [] }]);
  });

  it('treats a missing asset as empty', async () => {
    const config = await resolveListingImportConfig(sdkReturning([]));
    expect([...config.allowedPublicDataKeys].sort()).toEqual([...TEMPLATE_PUBLIC_DATA_KEYS].sort());
    expect([...config.fieldOptions.keys()].sort()).toEqual(['all_sizes', 'brand', 'color']);
    expect(config.categoryTree).toEqual([]);
  });

  it('rejects when the assets cannot be read', async () => {
    const sdk = { assetsByAlias: jest.fn().mockRejectedValue(new Error('network down')) };
    await expect(resolveListingImportConfig(sdk)).rejects.toThrow('network down');
    await expect(resolveListingImportConfig(undefined)).rejects.toThrow();
  });
});
