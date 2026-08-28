import defaultConfig from '../config/configDefault';
import { mergeConfig } from './configHelpers';

// mergeConfig walks the whole hosted-config tree. Two upstream branches throw on a
// sparse fixture, so `search` must carry mainSearch + dateRangeFilter + priceFilter
// even though this suite only cares about listingFields. See the plan for detail.
const hostedConfig = hostedListingFields => ({
  listingTypes: {
    listingTypes: [
      {
        id: 'venta',
        transactionProcess: { name: 'default-purchase', alias: 'default-purchase/release-1' },
        unitType: 'item',
      },
    ],
  },
  search: {
    mainSearch: { searchType: 'keywords' },
    dateRangeFilter: { schemaType: 'dates', enabled: false },
    priceFilter: { schemaType: 'price', enabled: false },
  },
  listingFields: { listingFields: hostedListingFields },
});

const brandOptions = configAsset => {
  const merged = mergeConfig(configAsset, defaultConfig);
  const brand = merged.listing.listingFields.find(field => field.key === 'brand');
  return brand?.enumOptions || [];
};

describe('mergeConfig listingFields — brand', () => {
  it('adds a brand that only Console defines', () => {
    const options = brandOptions(
      hostedConfig([
        {
          key: 'brand',
          scope: 'public',
          schemaType: 'enum',
          enumOptions: [{ option: 'av-test-brand', label: 'AV Test Brand' }],
        },
      ])
    );

    expect(options).toContainEqual({ option: 'av-test-brand', label: 'AV Test Brand' });
  });

  it('prefers the Console label for a brand both sources define', () => {
    const options = brandOptions(
      hostedConfig([
        {
          key: 'brand',
          scope: 'public',
          schemaType: 'enum',
          enumOptions: [{ option: 'zara', label: 'ZARA (console)' }],
        },
      ])
    );

    expect(options).toContainEqual({ option: 'zara', label: 'ZARA (console)' });
  });

  it('keeps the code-defined brands and the code-owned field config', () => {
    const merged = mergeConfig(
      hostedConfig([
        {
          key: 'brand',
          scope: 'public',
          schemaType: 'enum',
          enumOptions: [{ option: 'av-test-brand', label: 'AV Test Brand' }],
        },
      ]),
      defaultConfig
    );
    const brand = merged.listing.listingFields.find(field => field.key === 'brand');

    expect(brand.enumOptions.length).toBeGreaterThan(600);
    expect(brand.enumOptions).toContainEqual({ option: 'prada', label: 'Prada' });
    expect(brand.saveConfig.label).toEqual('Marca');
    expect(brand.filterConfig.filterType).toEqual('SelectMultipleFilter');
  });

  it('leaves the brand list untouched when Console defines no brand field', () => {
    const withConsoleBrand = brandOptions(
      hostedConfig([{ key: 'brand', scope: 'public', schemaType: 'enum', enumOptions: [] }])
    );
    const withoutConsoleBrand = brandOptions(hostedConfig([]));

    expect(withoutConsoleBrand).toEqual(withConsoleBrand);
    expect(withoutConsoleBrand[0]).toEqual({ option: 'other', label: 'Otra...' });
  });
});

describe('mergeConfig listingFields — the brand-only boundary', () => {
  const hostedColorField = {
    key: 'color',
    scope: 'public',
    schemaType: 'multi-enum',
    enumOptions: [{ option: 'av-test-color', label: 'AV Test Color' }],
  };

  it('ignores Console options for color', () => {
    const merged = mergeConfig(hostedConfig([hostedColorField]), defaultConfig);
    const color = merged.listing.listingFields.find(field => field.key === 'color');

    expect(color.enumOptions).not.toContainEqual({
      option: 'av-test-color',
      label: 'AV Test Color',
    });
    expect(color.enumOptions).toContainEqual({ option: 'rojo', label: 'Rojo' });
  });

  it('ignores Console options for all_sizes', () => {
    const merged = mergeConfig(
      hostedConfig([
        {
          key: 'all_sizes',
          scope: 'public',
          schemaType: 'multi-enum',
          enumOptions: [{ option: 'av-test-size', label: 'AV Test Size' }],
        },
      ]),
      defaultConfig
    );
    const sizes = merged.listing.listingFields.find(field => field.key === 'all_sizes');

    expect(sizes.enumOptions).not.toContainEqual({
      option: 'av-test-size',
      label: 'AV Test Size',
    });
  });
});
