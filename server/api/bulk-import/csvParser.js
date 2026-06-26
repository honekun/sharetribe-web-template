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
 * Parse a CSV buffer and return structured rows.
 * Throws on parse errors.
 */
function parseCsv(buffer) {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
  return normalizeColumns(records);
}

/**
 * Validate parsed CSV rows against required columns and image references.
 *
 * authorOptions resolves each row's listing author:
 *  - currentUserId: the signed-in user; listings default to this author.
 *  - allowAuthorOverride: when true (admin uploads), a row's `user_id`/`author_id`
 *    column overrides the author. When false, any override value is rejected.
 *
 * Returns { valid: boolean, rows: Array, errors: Array<string> }
 */
function validateRows(rows, imageMap, authorOptions = {}) {
  const { currentUserId = null, allowAuthorOverride = false } = authorOptions;
  const errors = [];

  if (rows.length === 0) {
    errors.push('CSV file is empty.');
    return { valid: false, rows: [], errors };
  }

  if (rows.length > MAX_ROWS) {
    errors.push(`CSV has ${rows.length} rows. Maximum is ${MAX_ROWS}.`);
    return { valid: false, rows: [], errors };
  }

  // Check required columns exist in first row keys
  const columns = Object.keys(rows[0]);
  for (const col of REQUIRED_COLUMNS) {
    if (!columns.includes(col)) {
      errors.push(`Missing required column: "${col}".`);
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
      rowErrors.push(`Row ${rowNum}: "title" is empty.`);
    }
    if (!row.description || row.description.trim() === '') {
      rowErrors.push(`Row ${rowNum}: "description" is empty.`);
    }

    // Price validation
    const price = parsePrice(row.price);
    if (isNaN(price) || price <= 0) {
      rowErrors.push(`Row ${rowNum}: "price" must be a positive number, got "${row.price}".`);
    }

    // Required image columns
    for (const col of REQUIRED_IMAGE_COLUMNS) {
      const filename = row[col];
      if (!filename || filename.trim() === '') {
        rowErrors.push(`Row ${rowNum}: "${col}" is required.`);
      }
    }

    // Image filename validation
    const imageSlots = {};
    for (const col of IMAGE_COLUMNS) {
      const filename = row[col];
      if (filename && filename.trim() !== '') {
        const trimmed = filename.trim();
        if (!imageMap.has(trimmed)) {
          rowErrors.push(`Row ${rowNum}: Image "${trimmed}" (${col}) not found in uploaded files.`);
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
            `Row ${rowNum}: publicData column "${key}" uses a reserved key and was skipped.`
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

    // Geolocation
    const lat = row.location_lat ? parseFloat(row.location_lat) : null;
    const lng = row.location_lng ? parseFloat(row.location_lng) : null;
    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      rowErrors.push(`Row ${rowNum}: Invalid geolocation values.`);
    }

    // Stock — explicit validation: empty defaults to 1, otherwise must be a non-negative integer.
    const rawStock = row.stock == null ? '' : String(row.stock).trim();
    let stock = 1;
    if (rawStock !== '') {
      const parsedStock = Number(rawStock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        rowErrors.push(
          `Row ${rowNum}: "stock" must be a non-negative integer, got "${row.stock}".`
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
        `Row ${rowNum}: "user_id" override is not permitted for your account. Remove the column.`
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

module.exports = { parseCsv, validateRows, normalizeColumns, COLUMN_ALIASES };
