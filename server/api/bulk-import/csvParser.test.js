'use strict';

const { parseCsv, validateRows, normalizeColumns, COLUMN_ALIASES } = require('./csvParser');

// Helper to build a CSV buffer from header + row arrays
function buildCsv(headers, ...rows) {
  const lines = [headers.join(','), ...rows.map(r => r.join(','))];
  return Buffer.from(lines.join('\n'));
}

describe('parseCsv', () => {
  it('parses a valid CSV buffer into row objects', () => {
    const buf = buildCsv(['title', 'price', 'description'], ['"A Dress"', '100', '"Nice dress"']);
    const { rows } = parseCsv(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ title: 'A Dress', price: '100', description: 'Nice dress' });
  });

  it('trims whitespace from values', () => {
    const buf = Buffer.from('title,price,description\n  Hat  , 50 , A hat \n');
    const { rows } = parseCsv(buf);
    expect(rows[0].title).toBe('Hat');
    expect(rows[0].price).toBe('50');
  });

  it('skips empty lines', () => {
    const buf = Buffer.from('title,price,description\nA,10,B\n\nC,20,D\n');
    const { rows } = parseCsv(buf);
    expect(rows).toHaveLength(2);
  });

  it('throws on malformed CSV', () => {
    const buf = Buffer.from('"unclosed quote');
    expect(() => parseCsv(buf)).toThrow();
  });

  it('returns a headerMap of canonical name -> original operator header', () => {
    const buf = buildCsv(
      ['Nombre de Producto*', 'Precio Venta (MXN)*', 'Descripción*', 'Nombre imagen 1*'],
      ['A', '100', 'B', 'img.jpg']
    );
    const { rows, headerMap } = parseCsv(buf);
    // rows are normalized to canonical keys…
    expect(rows[0].title).toBe('A');
    // …while headerMap remembers what the operator actually typed.
    expect(headerMap.title).toBe('Nombre de Producto*');
    expect(headerMap.price).toBe('Precio Venta (MXN)*');
    expect(headerMap.image_front).toBe('Nombre imagen 1*');
  });
});

describe('validateRows', () => {
  const imageMap = new Map();
  imageMap.set('front.jpg', Buffer.from('img'));
  imageMap.set('back.jpg', Buffer.from('img'));

  function validRow(overrides = {}) {
    return {
      title: 'Test Item',
      description: 'A description',
      price: '250.00',
      ...overrides,
    };
  }

  // --- Required column checks ---

  it('rejects empty row array', () => {
    const result = validateRows([], imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('El archivo CSV está vacío.');
  });

  it('rejects CSV exceeding 100 rows', () => {
    const rows = Array.from({ length: 101 }, () => validRow());
    const result = validateRows(rows, imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/El máximo es 100/);
  });

  it('rejects rows missing required columns', () => {
    const rows = [{ title: 'A', price: '10' }]; // missing description column
    const result = validateRows(rows, imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Falta la columna obligatoria: "description"'),
      ])
    );
  });

  // --- Per-row validation ---

  it('rejects empty title', () => {
    const result = validateRows([validRow({ title: '' })], imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/"title" está vacío/);
  });

  it('rejects empty description', () => {
    const result = validateRows([validRow({ description: '' })], imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/"description" está vacío/);
  });

  it('rejects non-numeric price', () => {
    const result = validateRows([validRow({ price: 'abc' })], imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/"price" debe ser un número positivo/);
  });

  it('rejects zero price', () => {
    const result = validateRows([validRow({ price: '0' })], imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/"price" debe ser un número positivo/);
  });

  it('rejects negative price', () => {
    const result = validateRows([validRow({ price: '-50' })], imageMap);
    expect(result.valid).toBe(false);
  });

  it('rejects image reference not in imageMap', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'missing.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/no se encontró en los archivos subidos/);
  });

  it.each(['image_front', 'image_back', 'image_horizontal'])(
    'rejects missing required image column %s',
    key => {
      const result = validateRows(
        [
          validRow({
            image_front: 'front.jpg',
            image_back: 'back.jpg',
            image_horizontal: 'front.jpg',
            [key]: '',
          }),
        ],
        imageMap
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining(`"${key}" es obligatorio.`)])
      );
    }
  );

  it('rejects invalid geolocation', () => {
    const result = validateRows(
      [
        validRow({
          location_lat: 'abc',
          location_lng: '10',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Valores de geolocalización inválidos/);
  });

  // --- Successful validation ---

  it('returns valid result for correct rows', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
  });

  // --- Field parsing ---

  it('parses price as a float', () => {
    const result = validateRows(
      [
        validRow({
          price: '99.50',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].price).toBe(99.5);
  });

  it('defaults currency to MXN', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].currency).toBe('MXN');
  });

  it('respects currency column', () => {
    const result = validateRows(
      [
        validRow({
          currency: 'usd',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].currency).toBe('USD');
  });

  it('defaults publish to true', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publish).toBe(true);
  });

  it('publish=no sets publish to false', () => {
    const result = validateRows(
      [
        validRow({
          publish: 'no',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publish).toBe(false);
  });

  it('defaults stock to 1', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].stock).toBe(1);
  });

  it('parses stock column', () => {
    const result = validateRows(
      [
        validRow({
          stock: '5',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].stock).toBe(5);
  });

  it('defaults shippingEnabled to true', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].shippingEnabled).toBe(true);
  });

  it('defaults pickupEnabled to false', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].pickupEnabled).toBe(false);
  });

  // --- Image slot mapping ---

  it('maps image columns to imageSlots', () => {
    const result = validateRows(
      [validRow({ image_front: 'front.jpg', image_back: 'back.jpg' })],
      imageMap
    );
    expect(result.rows[0].imageSlots).toEqual({ front: 'front.jpg', back: 'back.jpg' });
  });

  it('ignores empty image columns', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
          image_details: '',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].imageSlots).toEqual({
      front: 'front.jpg',
      back: 'back.jpg',
      horizontal: 'front.jpg',
    });
  });

  it('keeps image_details optional', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
          image_details: '',
        }),
      ],
      imageMap
    );
    expect(result.valid).toBe(true);
    expect(result.rows[0].imageSlots.details).toBeUndefined();
  });

  // --- publicData extraction ---

  it('extracts pd_* columns as publicData', () => {
    const result = validateRows(
      [
        validRow({
          pd_color: 'azul',
          pd_brand: 'Levi',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    // color is multi-enum: single value becomes an array
    expect(result.rows[0].publicData).toEqual({ color: ['azul'], brand: 'Levi' });
  });

  it('pd_color single value is stored as an array', () => {
    const result = validateRows(
      [
        validRow({
          pd_color: 'negro',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData.color).toEqual(['negro']);
  });

  it('pd_color multiple pipe-separated values stored as array', () => {
    const result = validateRows(
      [
        validRow({
          pd_color: 'azul|negro',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData.color).toEqual(['azul', 'negro']);
  });

  it('pd_estilo single value is stored as an array', () => {
    const result = validateRows(
      [
        validRow({
          pd_estilo: 'vintage',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData.estilo).toEqual(['vintage']);
  });

  it('pd_all_sizes single value is stored as an array', () => {
    const result = validateRows(
      [
        validRow({
          pd_all_sizes: 's',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData.all_sizes).toEqual(['s']);
  });

  it('splits pipe-separated pd_* values into arrays', () => {
    const result = validateRows(
      [
        validRow({
          pd_all_sizes: 's|m|l',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData.all_sizes).toEqual(['s', 'm', 'l']);
  });

  it('single pd_* value stays as string', () => {
    const result = validateRows(
      [
        validRow({
          pd_era: '80s',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData.era).toBe('80s');
  });

  it.each(['pd___proto__', 'pd_constructor', 'pd_prototype'])(
    'rejects reserved publicData key from column %s',
    column => {
      const result = validateRows(
        [
          validRow({
            [column]: 'evil',
            image_front: 'front.jpg',
            image_back: 'back.jpg',
            image_horizontal: 'front.jpg',
          }),
        ],
        imageMap
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`La columna publicData "${column}" usa una clave reservada`),
        ])
      );
      const reservedKey = column.slice(3);
      expect(Object.prototype.hasOwnProperty.call(result.rows[0].publicData, reservedKey)).toBe(
        false
      );
      expect({}[reservedKey === 'constructor' ? 'arbitrary_unset' : reservedKey]).not.toBe('evil');
    }
  );

  it('publicData uses a null prototype', () => {
    const result = validateRows(
      [
        validRow({
          pd_color: 'blue',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(Object.getPrototypeOf(result.rows[0].publicData)).toBeNull();
  });

  it('ignores empty pd_* columns', () => {
    const result = validateRows(
      [
        validRow({
          pd_color: '',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData).toEqual({});
  });

  // --- Current seller template: pub_* prefix + imagen_N image columns ---

  it('extracts pub_* columns as publicData (current template prefix)', () => {
    const result = validateRows(
      [
        validRow({
          pub_brand: 'adidas',
          pub_genero: 'unisex',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData).toEqual({ brand: 'adidas', genero: 'unisex' });
  });

  it('wraps multi-enum pub_* fields in arrays just like pd_*', () => {
    const result = validateRows(
      [
        validRow({
          pub_color: 'azul',
          pub_all_sizes: 'm',
          pub_estilo: 'vintage|retro',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].publicData.color).toEqual(['azul']);
    expect(result.rows[0].publicData.all_sizes).toEqual(['m']);
    expect(result.rows[0].publicData.estilo).toEqual(['vintage', 'retro']);
  });

  it('maps imagen_1..4 headers to the four image slots', () => {
    const { rows } = parseCsv(
      buildCsv(
        ['title', 'description', 'price', 'imagen_1', 'imagen_2', 'imagen_3', 'imagen_4'],
        ['Item', 'Desc', '100', 'front.jpg', 'back.jpg', 'front.jpg', 'back.jpg']
      )
    );
    const result = validateRows(rows, imageMap);
    expect(result.valid).toBe(true);
    expect(result.rows[0].imageSlots).toEqual({
      front: 'front.jpg',
      back: 'back.jpg',
      horizontal: 'front.jpg',
      details: 'back.jpg',
    });
  });

  it('processes a full current-template row (pub_* + imagen_N) end-to-end', () => {
    const { rows } = parseCsv(
      buildCsv(
        [
          'title',
          'description',
          'price',
          'pub_brand',
          'pub_categoryLevel1',
          'pub_color',
          'pub_all_sizes',
          'pub_genero',
          'pub_estado',
          'pub_estilo',
          'imagen_1',
          'imagen_2',
          'imagen_3',
        ],
        [
          'Chamarra',
          'Desc',
          '"$1,800.00"',
          'adidas',
          'ropa',
          'azul',
          'm',
          'unisex',
          'buen-estado',
          'vintage',
          'front.jpg',
          'back.jpg',
          'front.jpg',
        ]
      )
    );
    const result = validateRows(rows, imageMap, { currentUserId: 'me' });
    expect(result.valid).toBe(true);
    const row = result.rows[0];
    expect(row.price).toBe(1800);
    expect(row.authorId).toBe('me');
    expect(row.publicData).toEqual({
      brand: 'adidas',
      categoryLevel1: 'ropa',
      color: ['azul'],
      all_sizes: ['m'],
      genero: 'unisex',
      estado: 'buen-estado',
      estilo: ['vintage'],
    });
    expect(row.imageSlots).toEqual({
      front: 'front.jpg',
      back: 'back.jpg',
      horizontal: 'front.jpg',
    });
  });

  // --- Geolocation ---

  it('parses lat/lng as floats', () => {
    const result = validateRows(
      [
        validRow({
          location_lat: '19.43',
          location_lng: '-99.13',
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].lat).toBe(19.43);
    expect(result.rows[0].lng).toBe(-99.13);
  });

  it('sets lat/lng to null when not provided', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].lat).toBeNull();
    expect(result.rows[0].lng).toBeNull();
  });

  // --- Row numbering ---

  it('assigns rowNum starting from 1 (1-indexed data rows)', () => {
    const result = validateRows(
      [
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
        validRow({
          image_front: 'front.jpg',
          image_back: 'back.jpg',
          image_horizontal: 'front.jpg',
        }),
      ],
      imageMap
    );
    expect(result.rows[0].rowNum).toBe(1);
    expect(result.rows[1].rowNum).toBe(2);
  });

  // --- Spanish column alias (Google Sheets format) ---

  it('accepts Spanish column names exported from Google Sheets', () => {
    const imageMap = new Map([
      ['camisa_frontal.jpg', Buffer.from('img')],
      ['camisa_posterior.jpg', Buffer.from('img')],
      ['camisa_detalle.jpg', Buffer.from('img')],
    ]);
    const buf = Buffer.from(
      [
        'Título,Descripción ,Precio Venta (mxn),Imagen 1: Frontal* ,Imagen 2: Posterior*,Imagen 3: Detalle*,Categoría,Subcategoría 1,Color,Talla,Marca,Genero,Estado,Estilo',
        'Camisa NOA,Hermosa camisa vintage,1500,camisa_frontal.jpg,camisa_posterior.jpg,camisa_detalle.jpg,ropa,ropa-camisas,rosa,s|m,vintage,mujer,como-nuevo,vintage',
      ].join('\n')
    );
    const { rows } = parseCsv(buf);
    expect(rows[0].title).toBe('Camisa NOA');
    expect(rows[0].price).toBe('1500');
    expect(rows[0].description).toBe('Hermosa camisa vintage');
    expect(rows[0].image_front).toBe('camisa_frontal.jpg');
    expect(rows[0].image_back).toBe('camisa_posterior.jpg');
    expect(rows[0].image_horizontal).toBe('camisa_detalle.jpg');
    expect(rows[0].pd_categoryLevel1).toBe('ropa');
    expect(rows[0].pd_categoryLevel2).toBe('ropa-camisas');
    expect(rows[0].pd_color).toBe('rosa');
    expect(rows[0].pd_all_sizes).toBe('s|m');
    expect(rows[0].pd_brand).toBe('vintage');
    expect(rows[0].pd_genero).toBe('mujer');
    expect(rows[0].pd_estado).toBe('como-nuevo');
    expect(rows[0].pd_estilo).toBe('vintage');

    const result = validateRows(rows, imageMap);
    expect(result.valid).toBe(true);
    expect(result.rows[0].title).toBe('Camisa NOA');
    expect(result.rows[0].publicData.categoryLevel1).toBe('ropa');
    expect(result.rows[0].publicData.color).toEqual(['rosa']);
  });

  it('passes through English column names unchanged', () => {
    const buf = Buffer.from('title,price,description\nHat,50,A hat\n');
    const { rows } = parseCsv(buf);
    expect(rows[0].title).toBe('Hat');
    expect(rows[0].price).toBe('50');
    expect(rows[0].description).toBe('A hat');
  });

  // --- normalizeColumns ---

  describe('normalizeColumns', () => {
    it('returns empty array unchanged', () => {
      expect(normalizeColumns([])).toEqual([]);
    });

    it('maps each Spanish alias to its canonical key', () => {
      const input = [{ Título: 'Test', 'Precio Venta (mxn)': '100', Descripción: 'Desc' }];
      const result = normalizeColumns(input);
      expect(result[0]).toEqual({ title: 'Test', price: '100', description: 'Desc' });
    });

    it('trims trailing/leading whitespace from Spanish header keys', () => {
      const input = [{ 'Título ': 'Test', ' Descripción': 'Desc', 'Precio Venta (mxn)': '50' }];
      const result = normalizeColumns(input);
      expect(result[0].title).toBe('Test');
      expect(result[0].description).toBe('Desc');
    });

    it('maps Imagen 3 to image_horizontal', () => {
      const input = [{ Título: 'x', 'Imagen 3: Detalle*': 'photo.jpg' }];
      const result = normalizeColumns(input);
      expect(result[0].image_horizontal).toBe('photo.jpg');
    });

    it('passes through unknown keys unchanged', () => {
      const input = [{ Título: 'x', extra_column: 'val' }];
      const result = normalizeColumns(input);
      expect(result[0].extra_column).toBe('val');
    });

    it('exports all expected aliases', () => {
      const expectedTargets = [
        'title',
        'description',
        'price',
        'pd_originalPrice',
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
        'pd_temporada',
        'author_id',
      ];
      const aliasValues = Object.values(COLUMN_ALIASES);
      for (const target of expectedTargets) {
        expect(aliasValues).toContain(target);
      }
    });
  });

  // --- Operator CSV template (PLANTILLA_CARGA_MASIVA.csv) column names ---

  describe('operator template column aliases', () => {
    const tmplImageMap = new Map([
      ['img1.jpg', Buffer.from('img')],
      ['img2.jpg', Buffer.from('img')],
      ['img3.jpg', Buffer.from('img')],
      ['img4.jpg', Buffer.from('img')],
    ]);

    function buildTemplateCsv(priceValue = '3500') {
      // A spreadsheet quotes any field containing a comma on export, so a price
      // like "$4,500.00" arrives wrapped in quotes — mirror that here.
      const price = priceValue.includes(',') ? `"${priceValue}"` : priceValue;
      return Buffer.from(
        [
          'Marca*,Nombre de Producto*,Descripción*,Precio Venta (MXN)*,Categoría,Subcategoría,Color,Talla,Género*,Estado,Estilo,Temporada,Nombre imagen 1*,Nombre imagen 2,Nombre imagen 3,Nombre imagen 4',
          `Prada,Chamarra vintage,chamarra azul,${price},Ropa,Ropa / Chamarras,Azul,M,Mujer,Usado,Vintage,Invierno,img1.jpg,img2.jpg,img3.jpg,img4.jpg`,
        ].join('\n')
      );
    }

    it('maps the operator template headers to canonical keys', () => {
      const { rows } = parseCsv(buildTemplateCsv());
      expect(rows[0].pd_brand).toBe('Prada');
      expect(rows[0].title).toBe('Chamarra vintage');
      expect(rows[0].description).toBe('chamarra azul');
      expect(rows[0].price).toBe('3500');
      expect(rows[0].pd_categoryLevel1).toBe('Ropa');
      expect(rows[0].pd_categoryLevel2).toBe('Ropa / Chamarras');
      expect(rows[0].pd_color).toBe('Azul');
      expect(rows[0].pd_all_sizes).toBe('M');
      expect(rows[0].pd_genero).toBe('Mujer');
      expect(rows[0].pd_estado).toBe('Usado');
      expect(rows[0].pd_estilo).toBe('Vintage');
      expect(rows[0].pd_temporada).toBe('Invierno');
      expect(rows[0].image_front).toBe('img1.jpg');
      expect(rows[0].image_back).toBe('img2.jpg');
      expect(rows[0].image_horizontal).toBe('img3.jpg');
      expect(rows[0].image_details).toBe('img4.jpg');
    });

    it('validates a full operator-template row (with a "$4,500.00" price)', () => {
      const { rows } = parseCsv(buildTemplateCsv('$4,500.00'));
      const result = validateRows(rows, tmplImageMap);
      expect(result.valid).toBe(true);
      expect(result.rows[0].price).toBe(4500);
      expect(result.rows[0].publicData.temporada).toBe('Invierno');
    });

    it('names the operator template column in errors, not the canonical key', () => {
      // A row missing the first image: the error must reference the header the
      // operator actually typed ("Nombre imagen 1*"), never the internal
      // canonical key ("image_front").
      const csv = Buffer.from(
        [
          'Marca*,Nombre de Producto*,Descripción*,Precio Venta (MXN)*,Género*,Nombre imagen 1*,Nombre imagen 2,Nombre imagen 3',
          'Prada,Chamarra,azul,3500,Mujer,,img2.jpg,img3.jpg',
        ].join('\n')
      );
      const { rows, headerMap } = parseCsv(csv);
      const result = validateRows(rows, tmplImageMap, { headerMap });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('"Nombre imagen 1*" es obligatorio.')])
      );
      expect(result.errors.join(' ')).not.toMatch(/image_front/);
    });
  });

  // --- Price normalization (currency tokens + thousands separators) ---

  describe('price normalization', () => {
    function priceRow(price) {
      return validateRows(
        [
          validRow({
            price,
            image_front: 'front.jpg',
            image_back: 'back.jpg',
            image_horizontal: 'front.jpg',
          }),
        ],
        imageMap
      );
    }

    it('strips $ and thousands commas: "$4,500.00" -> 4500', () => {
      expect(priceRow('$4,500.00').rows[0].price).toBe(4500);
    });

    it('strips thousands commas without decimals: "$1,000" -> 1000', () => {
      expect(priceRow('$1,000').rows[0].price).toBe(1000);
    });

    it('strips a currency word token: "MXN 250" -> 250', () => {
      const r = priceRow('MXN 250');
      expect(r.valid).toBe(true);
      expect(r.rows[0].price).toBe(250);
    });

    it('treats the remaining "." as a decimal point: "$99.50" -> 99.5', () => {
      expect(priceRow('$99.50').rows[0].price).toBe(99.5);
    });

    it('still rejects a value with no digits', () => {
      const r = priceRow('$');
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toMatch(/"price" debe ser un número positivo/);
    });
  });

  // --- Multiple errors ---

  it('collects errors from multiple rows', () => {
    const result = validateRows([validRow({ title: '' }), validRow({ price: 'bad' })], imageMap);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('collects multiple validation errors for missing required images', () => {
    const result = validateRows(
      [
        validRow({
          image_front: '',
          image_back: '',
          image_horizontal: '',
        }),
      ],
      imageMap
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"image_front" es obligatorio.'),
        expect.stringContaining('"image_back" es obligatorio.'),
        expect.stringContaining('"image_horizontal" es obligatorio.'),
      ])
    );
  });

  // --- Author resolution (current user vs admin user_id override) ---

  describe('author resolution', () => {
    function authorRow(overrides = {}) {
      return validRow({
        image_front: 'front.jpg',
        image_back: 'back.jpg',
        image_horizontal: 'front.jpg',
        ...overrides,
      });
    }

    it('defaults authorId to the current user when no override column', () => {
      const result = validateRows([authorRow()], imageMap, { currentUserId: 'me-uuid' });
      expect(result.valid).toBe(true);
      expect(result.rows[0].authorId).toBe('me-uuid');
    });

    it('rejects an author override for non-admin uploads', () => {
      const result = validateRows([authorRow({ author_id: 'other-uuid' })], imageMap, {
        currentUserId: 'me-uuid',
        allowAuthorOverride: false,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/La sustitución de "user_id" no está permitida/);
    });

    it('accepts an author override for admin uploads', () => {
      const result = validateRows([authorRow({ author_id: 'other-uuid' })], imageMap, {
        currentUserId: 'me-uuid',
        allowAuthorOverride: true,
      });
      expect(result.valid).toBe(true);
      expect(result.rows[0].authorId).toBe('other-uuid');
    });

    it('falls back to current user when an admin leaves the override empty', () => {
      const result = validateRows([authorRow({ author_id: '' })], imageMap, {
        currentUserId: 'me-uuid',
        allowAuthorOverride: true,
      });
      expect(result.valid).toBe(true);
      expect(result.rows[0].authorId).toBe('me-uuid');
    });

    it('normalizes the user_id header to an author override end-to-end', () => {
      const { rows } = parseCsv(
        buildCsv(
          [
            'title',
            'description',
            'price',
            'user_id',
            'image_front',
            'image_back',
            'image_horizontal',
          ],
          ['Item', 'Desc', '100', 'other-uuid', 'front.jpg', 'back.jpg', 'front.jpg']
        )
      );
      // user_id is aliased to author_id during parsing.
      expect(rows[0].author_id).toBe('other-uuid');

      const result = validateRows(rows, imageMap, {
        currentUserId: 'me-uuid',
        allowAuthorOverride: true,
      });
      expect(result.valid).toBe(true);
      expect(result.rows[0].authorId).toBe('other-uuid');
    });
  });
});
