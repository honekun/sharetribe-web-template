import {
  findBrandOption,
  normalizeBrandToken,
  resolveKeywordsInitialValue,
  resolveKeywordsSearchParams,
} from './avBrandSearch';
import { mergeHostedBrandOptions } from '../../config/configAV';

const listingFields = [
  { key: 'category', scope: 'public', schemaType: 'enum', enumOptions: [{ option: 'ropa' }] },
  {
    key: 'brand',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'other', label: 'Otra...' },
      { option: 'prada', label: 'Prada' },
      { option: 'a-p-c', label: 'A.P.C.' },
      { option: 'ala-a', label: 'Alaïa' },
      { option: 'h-m', label: 'H&M' },
      { option: 'alice-olivia', label: 'Alice + Olivia' },
    ],
  },
];

describe('normalizeBrandToken', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeBrandToken('A.P.C.')).toEqual('apc');
    expect(normalizeBrandToken('Alice + Olivia')).toEqual('aliceolivia');
    expect(normalizeBrandToken('H&M')).toEqual('hm');
  });

  it('strips accents', () => {
    expect(normalizeBrandToken('Alaïa')).toEqual('alaia');
  });

  it('returns an empty string for non-strings', () => {
    expect(normalizeBrandToken(undefined)).toEqual('');
    expect(normalizeBrandToken(null)).toEqual('');
    expect(normalizeBrandToken(42)).toEqual('');
  });
});

describe('findBrandOption', () => {
  it('matches a brand label case-insensitively', () => {
    expect(findBrandOption('prada', listingFields)).toEqual('prada');
    expect(findBrandOption('PRADA', listingFields)).toEqual('prada');
    expect(findBrandOption('  Prada  ', listingFields)).toEqual('prada');
  });

  it('matches a brand whose label differs from its slug', () => {
    expect(findBrandOption('A.P.C.', listingFields)).toEqual('a-p-c');
    expect(findBrandOption('apc', listingFields)).toEqual('a-p-c');
    expect(findBrandOption('Alice + Olivia', listingFields)).toEqual('alice-olivia');
  });

  it('matches an accented label typed without accents', () => {
    expect(findBrandOption('alaia', listingFields)).toEqual('ala-a');
    expect(findBrandOption('Alaïa', listingFields)).toEqual('ala-a');
  });

  it('matches on the slug as well as the label', () => {
    expect(findBrandOption('alice-olivia', listingFields)).toEqual('alice-olivia');
  });

  it('returns null for a product search', () => {
    expect(findBrandOption('vestido negro', listingFields)).toBeNull();
    expect(findBrandOption('abrigo', listingFields)).toBeNull();
  });

  it('never matches the catch-all "other" option', () => {
    expect(findBrandOption('Otra...', listingFields)).toBeNull();
    expect(findBrandOption('other', listingFields)).toBeNull();
  });

  it('ignores queries shorter than the minimum token length', () => {
    expect(findBrandOption('a', listingFields)).toBeNull();
    expect(findBrandOption('', listingFields)).toBeNull();
    expect(findBrandOption('  ', listingFields)).toBeNull();
  });

  it('returns null when the brand field or config is absent', () => {
    expect(findBrandOption('prada', [])).toBeNull();
    expect(findBrandOption('prada', undefined)).toBeNull();
    expect(findBrandOption('prada', [{ key: 'category', enumOptions: [] }])).toBeNull();
  });

  it('tolerates a brand field with no enumOptions', () => {
    expect(findBrandOption('prada', [{ key: 'brand', scope: 'public' }])).toBeNull();
  });

  it('resolves a brand that only Console defines, once merged', () => {
    const merged = mergeHostedBrandOptions(
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'other', label: 'Otra...' }],
        },
      ],
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'av-test-brand', label: 'AV Test Brand' }],
        },
      ]
    );

    expect(findBrandOption('av test brand', merged)).toEqual('av-test-brand');
  });

  it('resolves a Console-relabelled brand by its Console label', () => {
    const merged = mergeHostedBrandOptions(
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'zara', label: 'Zara' }],
        },
      ],
      [
        {
          key: 'brand',
          schemaType: 'enum',
          enumOptions: [{ option: 'zara', label: 'ZARA Espana' }],
        },
      ]
    );

    expect(findBrandOption('zara espana', merged)).toEqual('zara');
  });
});

describe('resolveKeywordsSearchParams', () => {
  it('searches by pub_brand and clears keywords on a brand hit', () => {
    expect(resolveKeywordsSearchParams({ keywords: 'prada', listingFields })).toEqual({
      keywords: undefined,
      pub_brand: 'prada',
    });
  });

  it('searches by keywords and clears pub_brand otherwise', () => {
    expect(resolveKeywordsSearchParams({ keywords: 'vestido negro', listingFields })).toEqual({
      keywords: 'vestido negro',
      pub_brand: undefined,
    });
  });

  it('always defines both keys so stale params are cleared', () => {
    const brandHit = resolveKeywordsSearchParams({ keywords: 'prada', listingFields });
    const keywordHit = resolveKeywordsSearchParams({ keywords: 'abrigo', listingFields });

    expect(Object.keys(brandHit).sort()).toEqual(['keywords', 'pub_brand']);
    expect(Object.keys(keywordHit).sort()).toEqual(['keywords', 'pub_brand']);
  });

  it('passes an empty query through as keywords', () => {
    expect(resolveKeywordsSearchParams({ keywords: '', listingFields })).toEqual({
      keywords: '',
      pub_brand: undefined,
    });
  });

  it('does not throw when called with no arguments', () => {
    expect(resolveKeywordsSearchParams()).toEqual({ keywords: undefined, pub_brand: undefined });
  });
});

describe('resolveKeywordsInitialValue', () => {
  it('shows the brand label when the URL carries pub_brand', () => {
    expect(
      resolveKeywordsInitialValue({ keywords: undefined, pubBrand: 'a-p-c', listingFields })
    ).toEqual('A.P.C.');
  });

  it('passes keywords through untouched for a normal search', () => {
    expect(
      resolveKeywordsInitialValue({ keywords: 'vestido', pubBrand: undefined, listingFields })
    ).toEqual('vestido');
  });

  it('prefers keywords when both params are present', () => {
    expect(
      resolveKeywordsInitialValue({ keywords: 'vestido', pubBrand: 'prada', listingFields })
    ).toEqual('vestido');
  });

  it('falls back to keywords when pub_brand matches no known brand', () => {
    expect(
      resolveKeywordsInitialValue({ keywords: undefined, pubBrand: 'not-a-brand', listingFields })
    ).toBeUndefined();
  });

  it('does not throw when called with no arguments', () => {
    expect(resolveKeywordsInitialValue()).toBeUndefined();
  });
});

// Guard against the real brand field drifting away from what this module expects
// (key renamed, schemaType changed, enumOptions restructured).
describe('against the real AV listing-field config', () => {
  const { avListingFields } = require('../../config/configListingAV');

  it('resolves brands that exist in the shipped config', () => {
    expect(findBrandOption('prada', avListingFields)).toEqual('prada');
    expect(findBrandOption('Acne Studios', avListingFields)).toEqual('acne-studios');
    expect(findBrandOption('acnestudios', avListingFields)).toEqual('acne-studios');
  });

  it('routes a real brand query to pub_brand', () => {
    expect(
      resolveKeywordsSearchParams({ keywords: 'Prada', listingFields: avListingFields })
    ).toEqual({ keywords: undefined, pub_brand: 'prada' });
  });

  it('leaves an ordinary product query on keywords', () => {
    expect(
      resolveKeywordsSearchParams({ keywords: 'vestido negro', listingFields: avListingFields })
    ).toEqual({ keywords: 'vestido negro', pub_brand: undefined });
  });

  it('round-trips a brand back into the search box', () => {
    expect(
      resolveKeywordsInitialValue({ pubBrand: 'prada', listingFields: avListingFields })
    ).toEqual('Prada');
  });
});
