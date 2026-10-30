'use strict';

const {
  normalize,
  buildFieldOptions,
  buildCategoryTree,
  resolveOption,
  resolveCategoryPath,
  describeValues,
} = require('./listingFieldOptions');
const { avListingFields } = require('../../../src/config/configListingAV');

const hostedFields = [
  {
    key: 'temporada',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'otono', label: 'Otoño' },
      { option: 'todo-el-ano', label: 'Todo el Año' },
    ],
  },
  {
    key: 'estilo',
    schemaType: 'multi-enum', // no scope = public
    enumOptions: [
      { option: 'vintage', label: 'Vintage' },
      { option: 'urbano_streetwear', label: 'Urbano / Streetwear' },
    ],
  },
  { key: 'decada', scope: 'public', schemaType: 'text' },
  {
    key: 'tags',
    scope: 'metadata',
    schemaType: 'multi-enum',
    enumOptions: [{ option: 'hot-list', label: 'HotList' }],
  },
  {
    key: 'brand',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [
      { option: 'zara', label: 'ZARA (Console)' },
      { option: 'yiknal-console', label: 'Yiknal' },
    ],
  },
  {
    key: 'color',
    scope: 'public',
    schemaType: 'enum',
    enumOptions: [{ option: 'console-only', label: 'Console only' }],
  },
];

describe('normalize', () => {
  it('ignores case, accents and extra whitespace', () => {
    expect(normalize('  Todo  el AÑO ')).toBe('todo el ano');
    expect(normalize('Café')).toBe('cafe');
  });
});

describe('buildFieldOptions', () => {
  const fieldOptions = buildFieldOptions(hostedFields);

  it('indexes public enum and multi-enum Console fields', () => {
    expect(fieldOptions.get('temporada').schemaType).toBe('enum');
    expect(fieldOptions.get('estilo').schemaType).toBe('multi-enum');
    expect(fieldOptions.get('estilo').values).toEqual(['vintage', 'urbano_streetwear']);
  });

  it('skips non-enum and non-public fields', () => {
    expect(fieldOptions.has('decada')).toBe(false);
    expect(fieldOptions.has('tags')).toBe(false);
  });

  it('lets a code-defined field replace the Console field with the same key', () => {
    const color = fieldOptions.get('color');
    expect(color.schemaType).toBe('multi-enum');
    expect(color.values).toContain('negro');
    expect(color.values).not.toContain('console-only');
  });

  it('adds the Console brand options to the code list, Console winning per option', () => {
    const brand = fieldOptions.get('brand');
    expect(brand.values).toContain('prada'); // code
    expect(brand.values).toContain('yiknal-console'); // Console
    expect(resolveOption(brand, 'ZARA (Console)')).toEqual({ value: 'zara' });
  });

  it('includes the code-defined fields when Console has none', () => {
    const codeOnly = buildFieldOptions(undefined);
    expect([...codeOnly.keys()].sort()).toEqual(['all_sizes', 'brand', 'color']);
  });

  it('drops a blank option instead of indexing it', () => {
    const options = buildFieldOptions(
      [
        {
          key: 'genero',
          schemaType: 'enum',
          enumOptions: [{ option: ' ', label: 'Blank' }, { option: 'mujer', label: 'Mujer' }],
        },
      ],
      []
    );
    expect(options.get('genero').values).toEqual(['mujer']);
  });
});

describe('resolveOption', () => {
  const fieldOptions = buildFieldOptions(hostedFields);
  const temporada = fieldOptions.get('temporada');

  it('accepts the key or the label, ignoring case and accents', () => {
    expect(resolveOption(temporada, 'todo-el-ano')).toEqual({ value: 'todo-el-ano' });
    expect(resolveOption(temporada, 'Todo el año')).toEqual({ value: 'todo-el-ano' });
    expect(resolveOption(temporada, 'OTOÑO')).toEqual({ value: 'otono' });
    expect(resolveOption(fieldOptions.get('color'), 'Negro')).toEqual({ value: 'negro' });
  });

  it('matches a label that itself contains a slash as a whole', () => {
    expect(resolveOption(fieldOptions.get('estilo'), 'Urbano / Streetwear')).toEqual({
      value: 'urbano_streetwear',
    });
  });

  it('retries a "Grupo / Opción" value with its last segment', () => {
    expect(resolveOption(fieldOptions.get('all_sizes'), 'Ropa / M')).toEqual({ value: 'm' });
  });

  it('resolves legacy Ropa MX labels to clothing keys instead of ambiguous shoe labels', () => {
    expect(resolveOption(fieldOptions.get('all_sizes'), 'Ropa MX / 28')).toEqual({
      value: 'mx_28',
    });
    expect(resolveOption(fieldOptions.get('all_sizes'), 'Ropa MX / 30')).toEqual({
      value: 'mx_30',
    });
  });

  it('reports an unknown value', () => {
    expect(resolveOption(fieldOptions.get('brand'), 'Marca Inventada')).toEqual({ unknown: true });
    // A brand added in Console resolves by its label.
    expect(resolveOption(fieldOptions.get('brand'), 'YIKNAL')).toEqual({ value: 'yiknal-console' });
    expect(resolveOption(temporada, 'Ropa / Otra')).toEqual({ unknown: true });
  });

  it('reports a label shared by several options as ambiguous', () => {
    const genero = buildFieldOptions(
      [
        {
          key: 'genero',
          schemaType: 'enum',
          enumOptions: [{ option: 'a', label: 'Mismo' }, { option: 'b', label: 'mismo' }],
        },
      ],
      []
    ).get('genero');
    expect(resolveOption(genero, 'Mismo')).toEqual({ ambiguous: ['a', 'b'] });
    expect(resolveOption(genero, 'a')).toEqual({ value: 'a' });
  });
});

describe('against the real code-defined fields', () => {
  const fieldOptions = buildFieldOptions([], avListingFields);

  it('resolves every option key to itself', () => {
    for (const [, field] of fieldOptions) {
      field.values.forEach(key => expect(resolveOption(field, key)).toEqual({ value: key }));
    }
  });

  it('has no two option keys that differ only in case or accents', () => {
    for (const [, field] of fieldOptions) {
      expect(new Set(field.values.map(normalize)).size).toBe(field.values.length);
    }
  });
});

describe('resolveCategoryPath', () => {
  const tree = buildCategoryTree([
    {
      id: 'ropa',
      name: 'Ropa',
      subcategories: [
        {
          id: 'ropa-vestidos',
          name: 'Vestidos',
          subcategories: [{ id: 'ropa-vestidos-midi', name: 'Midi' }],
        },
        { id: 'ropa-maternidad', name: 'Maternidad', subcategories: [] },
      ],
    },
    { id: 'bolsas', name: 'Bolsas' },
  ]);
  const column = level => `pub_categoryLevel${level + 1}`;
  const resolve = levels => resolveCategoryPath(tree, levels, column);

  it('resolves a full path given as ids or names', () => {
    const expected = {
      categoryLevel1: 'ropa',
      categoryLevel2: 'ropa-vestidos',
      categoryLevel3: 'ropa-vestidos-midi',
    };
    expect(resolve(['ropa', 'ropa-vestidos', 'ropa-vestidos-midi'])).toEqual({
      values: expected,
      errors: [],
    });
    expect(resolve(['ROPA', 'vestidos', 'Midi'])).toEqual({ values: expected, errors: [] });
  });

  it('stops at a category without subcategories', () => {
    expect(resolve(['bolsas'])).toEqual({ values: { categoryLevel1: 'bolsas' }, errors: [] });
    expect(resolve(['ropa', 'Maternidad', ''])).toEqual({
      values: { categoryLevel1: 'ropa', categoryLevel2: 'ropa-maternidad' },
      errors: [],
    });
  });

  it('requires a top-level category', () => {
    expect(resolve([undefined, undefined, undefined]).errors).toEqual([
      'Falta la categoría ("pub_categoryLevel1"). Valores válidos: ropa, bolsas.',
    ]);
  });

  it('requires each level while the category has subcategories', () => {
    expect(resolve(['ropa']).errors).toEqual([
      'Falta "pub_categoryLevel2": "ropa" tiene subcategorías. Valores válidos: ropa-vestidos, ropa-maternidad.',
    ]);
    expect(resolve(['ropa', 'ropa-vestidos']).errors).toEqual([
      'Falta "pub_categoryLevel3": "ropa-vestidos" tiene subcategorías. Valores válidos: ropa-vestidos-midi.',
    ]);
  });

  it('rejects an unknown category and a subcategory of another parent', () => {
    expect(resolve(['Ropa / Chamarras']).errors).toEqual([
      '"pub_categoryLevel1": "Ropa / Chamarras" no es una categoría. Valores válidos: ropa, bolsas.',
    ]);
    expect(resolve(['bolsas', 'ropa-vestidos']).errors).toEqual([
      '"pub_categoryLevel2" debe estar vacío: "bolsas" no tiene subcategorías, se recibió "ropa-vestidos".',
    ]);
    expect(resolve(['ropa', 'bolsas']).errors).toEqual([
      '"pub_categoryLevel2": "bolsas" no es una subcategoría de "ropa". Valores válidos: ropa-vestidos, ropa-maternidad.',
    ]);
  });

  it('requires nothing when the marketplace has no categories', () => {
    expect(resolveCategoryPath([], ['anything'], column)).toEqual({ values: {}, errors: [] });
  });
});

describe('buildCategoryTree', () => {
  it('drops entries without an id and falls back to the id as the name', () => {
    expect(buildCategoryTree([{ id: 'ropa' }, { name: 'No id' }, null])).toEqual([
      { id: 'ropa', name: 'ropa', subcategories: [] },
    ]);
    expect(buildCategoryTree(undefined)).toEqual([]);
  });
});

describe('describeValues', () => {
  it('lists a few values, then the count', () => {
    expect(describeValues(['a', 'b'])).toBe('a, b');
    const many = Array.from({ length: 12 }, (_, i) => `v${i}`);
    expect(describeValues(many)).toBe('v0, v1, v2, v3, v4, v5, v6, v7, v8, v9… (12 en total)');
  });
});
