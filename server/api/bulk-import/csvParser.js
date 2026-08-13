'use strict';

const { parse } = require('csv-parse/sync');

// Spanish column names accepted from the Archivo Vintach templates. Keys are
// trimmed header strings; values are canonical English column names. Two header
// dialects are supported:
//  1. The Google Sheets export ("Título", "Imagen 1: Frontal*", …).
//  2. The operator-facing CSV template PLANTILLA_CARGA_MASIVA.csv
//     ("Nombre de Producto*", "Nombre imagen 1*", …) — note the "*" required-field
//     markers are part of the literal header and must be matched verbatim.
const COLUMN_ALIASES = {
  // --- Google Sheets export dialect ---
  Título: 'title',
  Descripción: 'description',
  'Precio Venta (mxn)': 'price',
  'Precio Original (opcional)': 'pd_originalPrice',
  'Imagen 1: Frontal*': 'image_front',
  'Imagen 2: Posterior*': 'image_back',
  // GS labels slot 3 "Detalle" but the system calls it "horizontal" (landscape orientation)
  'Imagen 3: Detalle*': 'image_horizontal',
  'Imagen 4: opcional': 'image_details',
  Categoría: 'pd_categoryLevel1',
  'Subcategoría 1': 'pd_categoryLevel2',
  'Subcategoría 2': 'pd_categoryLevel3',
  Color: 'pd_color',
  Talla: 'pd_all_sizes',
  Marca: 'pd_brand',
  Genero: 'pd_genero',
  Estado: 'pd_estado',
  Estilo: 'pd_estilo',
  // Author override column. `user_id` is the canonical admin-facing name; the
  // older `author_id` / "ID Vendedor" headers remain accepted as aliases.
  user_id: 'author_id',
  'ID Vendedor': 'author_id',

  // --- Operator CSV template (PLANTILLA_CARGA_MASIVA.csv) dialect ---
  'Nombre de Producto*': 'title',
  'Descripción*': 'description',
  'Precio Venta (MXN)*': 'price',
  'Marca*': 'pd_brand',
  'Género*': 'pd_genero',
  Subcategoría: 'pd_categoryLevel2',
  Temporada: 'pd_temporada',
  'Nombre imagen 1*': 'image_front',
  'Nombre imagen 2': 'image_back',
  'Nombre imagen 3': 'image_horizontal',
  'Nombre imagen 4': 'image_details',

  // --- Current seller template (PLANTILLA_CARGA_MASIVA.csv) dialect ---
  // Headers are the public-data field names with a `pub_` prefix (handled by the
  // prefix logic below, no alias needed) plus numbered image columns.
  imagen_1: 'image_front',
  imagen_2: 'image_back',
  imagen_3: 'image_horizontal',
  imagen_4: 'image_details',
};

const REQUIRED_COLUMNS = ['title', 'price', 'description'];
const IMAGE_COLUMNS = ['image_front', 'image_back', 'image_horizontal', 'image_details'];
const REQUIRED_IMAGE_COLUMNS = ['image_front', 'image_back', 'image_horizontal'];
const MAX_ROWS = 100;
const RESERVED_PD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Public-data columns are recognised by either prefix: `pub_` (the search-param
// convention used by the current seller template) or the legacy `pd_`. The prefix
// is stripped to get the publicData key (e.g. pub_color / pd_color -> color).
const PUBLIC_DATA_PREFIXES = ['pub_', 'pd_'];
// Fields defined as multi-enum in the Console — single values are wrapped in arrays
// so the Sharetribe API always receives an array for these fields.
const MULTI_ENUM_PD_FIELDS = new Set(['color', 'all_sizes', 'estilo']);

/**
 * Remap Spanish column headers exported by the Google Sheets template to their
 * canonical English equivalents. Rows with English headers pass through unchanged.
 */
function normalizeColumns(rows) {
  if (rows.length === 0) return rows;
  const hasAlias = Object.keys(rows[0]).some(k => k.trim() in COLUMN_ALIASES);
  if (!hasAlias) return rows;
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const canonical = COLUMN_ALIASES[k.trim()];
      out[canonical !== undefined ? canonical : k.trim()] = v;
    }
    return out;
  });
}

/**
 * Parse a human-entered price into a number. Strips any currency token (e.g.
 * "$", "MXN") and thousands separators (commas), then treats the remainder as a
 * decimal number. Examples: "$4,500.00" -> 4500, "$1,000" -> 1000, "$99.50" ->
 * 99.5. Returns NaN when no numeric value remains.
 */
function parsePrice(raw) {
  if (raw == null) return NaN;
  // Keep only digits, dot and minus — removes "$", currency words, commas, spaces.
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  if (!/\d/.test(cleaned)) return NaN;
  return parseFloat(cleaned);
}

/**
 * Build a reverse lookup from canonical column name -> the original header the
 * operator actually typed. This lets validation errors name the real CSV column
 * (e.g. "Nombre imagen 1*" or "imagen_1") instead of the internal canonical key
 * ("image_front"). It is built from the raw parsed records *before*
 * normalizeColumns() rewrites the keys. The first header mapping to a given
 * canonical name wins.
 */
function buildHeaderMap(records) {
  const map = {};
  if (records.length === 0) return map;
  for (const header of Object.keys(records[0])) {
    const trimmed = header.trim();
    const canonical = COLUMN_ALIASES[trimmed] || trimmed;
    if (!(canonical in map)) map[canonical] = trimmed;
  }
  return map;
}

/**
 * Parse a CSV buffer and return structured rows plus a header map.
 * Throws on parse errors.
 *
 * Returns { rows, headerMap }:
 *  - rows: records with canonical column keys (see normalizeColumns).
 *  - headerMap: canonical name -> the original header the operator typed, used
 *    by validateRows to surface real column names in error messages.
 */
function parseCsv(buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
  return { rows: normalizeColumns(records), headerMap: buildHeaderMap(records) };
}

/**
 * Validate parsed CSV rows against required columns and image references.
 *
 * authorOptions resolves each row's listing author and labels error columns:
 *  - currentUserId: the signed-in user; listings default to this author.
 *  - allowAuthorOverride: when true (admin uploads), a row's `user_id`/`author_id`
 *    column overrides the author. When false, any override value is rejected.
 *  - headerMap: canonical name -> original CSV header (from parseCsv), so errors
 *    name the column the operator actually typed (e.g. "imagen_1", not
 *    "image_front"). Optional; falls back to the canonical name when absent.
 *
 * Returns { valid: boolean, rows: Array, errors: Array<string> }
 */
function validateRows(rows, imageMap, authorOptions = {}) {
  const { currentUserId = null, allowAuthorOverride = false, headerMap = {} } = authorOptions;
  // Show the operator the actual CSV column header they typed rather than the
  // internal canonical key.
  const label = col => headerMap[col] || col;
  const errors = [];

  if (rows.length === 0) {
    errors.push('El archivo CSV está vacío.');
    return { valid: false, rows: [], errors };
  }

  if (rows.length > MAX_ROWS) {
    errors.push(`El CSV tiene ${rows.length} filas. El máximo es ${MAX_ROWS}.`);
    return { valid: false, rows: [], errors };
  }

  // Check required columns exist in first row keys
  const columns = Object.keys(rows[0]);
  for (const col of REQUIRED_COLUMNS) {
    if (!columns.includes(col)) {
      errors.push(`Falta la columna obligatoria: "${col}".`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, rows: [], errors };
  }

  // Validate each row
  const processedRows = rows.map((row, i) => {
    const rowNum = i + 1; // 1-indexed data rows
    const rowErrors = [];

    // Required fields
    if (!row.title || row.title.trim() === '') {
      rowErrors.push(`Fila ${rowNum}: "${label('title')}" está vacío.`);
    }
    if (!row.description || row.description.trim() === '') {
      rowErrors.push(`Fila ${rowNum}: "${label('description')}" está vacío.`);
    }

    // Price validation
    const price = parsePrice(row.price);
    if (isNaN(price) || price <= 0) {
      rowErrors.push(
        `Fila ${rowNum}: "${label('price')}" debe ser un número positivo, se recibió "${
          row.price
        }".`
      );
    }

    // Original price validation. The column is optional, but a value that does
    // not exceed the sale price is never displayed (OrderPanel and the listing
    // cards only render a "was" price above the price), so importing one would
    // silently store a value the marketplace ignores.
    // Either prefix reaches publicData, so accept both spellings here.
    const originalPriceKey = ['pd_originalPrice', 'pub_originalPrice'].find(
      key => row[key] != null && String(row[key]).trim() !== ''
    );
    let originalPrice = NaN;
    if (originalPriceKey) {
      const rawOriginalPrice = row[originalPriceKey];
      originalPrice = parsePrice(rawOriginalPrice);
      if (isNaN(originalPrice) || originalPrice <= 0) {
        rowErrors.push(
          `Fila ${rowNum}: "${label(
            originalPriceKey
          )}" debe ser un número positivo, se recibió "${rawOriginalPrice}".`
        );
      } else if (!isNaN(price) && originalPrice <= price) {
        rowErrors.push(
          `Fila ${rowNum}: "${label(
            originalPriceKey
          )}" (${originalPrice}) debe ser mayor que "${label('price')}" (${price}).`
        );
      }
    }

    // Required image columns
    for (const col of REQUIRED_IMAGE_COLUMNS) {
      const filename = row[col];
      if (!filename || filename.trim() === '') {
        rowErrors.push(`Fila ${rowNum}: "${label(col)}" es obligatorio.`);
      }
    }

    // Image filename validation
    const imageSlots = {};
    for (const col of IMAGE_COLUMNS) {
      const filename = row[col];
      if (filename && filename.trim() !== '') {
        const trimmed = filename.trim();
        if (!imageMap.has(trimmed)) {
          rowErrors.push(
            `Fila ${rowNum}: La imagen "${trimmed}" (${label(
              col
            )}) no se encontró en los archivos subidos.`
          );
        }
        const slotKey = col.replace('image_', ''); // image_front -> front
        imageSlots[slotKey] = trimmed;
      }
    }

    // Extract publicData from pub_*/pd_* columns. Use a null-prototype object and
    // reject reserved keys to prevent prototype pollution from CSV headers.
    const publicData = Object.create(null);
    for (const [key, value] of Object.entries(row)) {
      const prefix = PUBLIC_DATA_PREFIXES.find(p => key.startsWith(p));
      if (prefix && value && value.trim() !== '') {
        const pdKey = key.slice(prefix.length); // pub_color / pd_color -> color
        if (RESERVED_PD_KEYS.has(pdKey)) {
          rowErrors.push(
            `Fila ${rowNum}: La columna publicData "${key}" usa una clave reservada y se omitió.`
          );
          continue;
        }
        const trimmed = value.trim();
        if (trimmed.includes('|')) {
          // Pipe-separated → always an array
          publicData[pdKey] = trimmed.split('|').map(v => v.trim());
        } else if (MULTI_ENUM_PD_FIELDS.has(pdKey)) {
          // Multi-enum fields: single value must also be an array
          publicData[pdKey] = [trimmed];
        } else {
          publicData[pdKey] = trimmed;
        }
      }
    }

    // Store the original price as the parsed number. Operators type it the same
    // way as the sale price ("$1,000.00"), which the import worker would
    // otherwise re-parse with parseFloat — dropping that value and turning
    // "1,000" into 1.
    if (originalPriceKey && publicData.originalPrice != null && !isNaN(originalPrice)) {
      publicData.originalPrice = originalPrice;
    }

    // Geolocation
    const lat = row.location_lat ? parseFloat(row.location_lat) : null;
    const lng = row.location_lng ? parseFloat(row.location_lng) : null;
    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      rowErrors.push(`Fila ${rowNum}: Valores de geolocalización inválidos.`);
    }

    // Stock — explicit validation: empty defaults to 1, otherwise must be a non-negative integer.
    const rawStock = row.stock == null ? '' : String(row.stock).trim();
    let stock = 1;
    if (rawStock !== '') {
      const parsedStock = Number(rawStock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        rowErrors.push(
          `Fila ${rowNum}: "${label('stock')}" debe ser un número entero no negativo, se recibió "${
            row.stock
          }".`
        );
      } else {
        stock = parsedStock;
      }
    }

    // Author resolution: default to the signed-in user. A `user_id`/`author_id`
    // override is honoured only for admin uploads; otherwise it is rejected so a
    // regular user can never create listings under someone else's account.
    const rawAuthorId = (row.author_id || '').trim();
    if (rawAuthorId && !allowAuthorOverride && rawAuthorId !== currentUserId) {
      rowErrors.push(
        `Fila ${rowNum}: La sustitución de "user_id" no está permitida para tu cuenta. Elimina la columna.`
      );
    }
    const authorId = allowAuthorOverride && rawAuthorId ? rawAuthorId : currentUserId || '';

    errors.push(...rowErrors);

    return {
      rowNum,
      title: (row.title || '').trim(),
      description: (row.description || '').trim(),
      price: isNaN(price) ? 0 : price,
      currency: (row.currency || 'MXN').trim().toUpperCase(),
      authorId,
      publish: (row.publish || 'yes').trim().toLowerCase() !== 'no',
      stock,
      shippingEnabled: (row.shipping_enabled || 'true').trim().toLowerCase() !== 'false',
      pickupEnabled: (row.pickup_enabled || 'false').trim().toLowerCase() === 'true',
      locationAddress: (row.location_address || '').trim(),
      lat,
      lng,
      imageSlots,
      publicData,
    };
  });

  return {
    valid: errors.length === 0,
    rows: processedRows,
    errors,
  };
}

module.exports = { parseCsv, validateRows, normalizeColumns, buildHeaderMap, COLUMN_ALIASES };
