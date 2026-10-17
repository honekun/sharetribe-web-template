'use strict';

// The option sets a bulk-import CSV value is checked against.
//
// The listing wizard only ever saves an enum field's option key (`negro`, `m`,
// `todo-el-ano`) and a category id path (`ropa` → `ropa-vestidos` → …). Search
// filters, category pages and the listing page all match on those keys, so a
// row that stores the label instead (`Negro`, `Todo el año`) imports fine and
// then never matches anything. validateRows uses this module to accept either
// the key or the label, store the key, and reject everything else.
//
// The options come from the same two sources the client merges in
// src/util/configHelpers.js:
//  - code-defined fields (src/config/configListingAV.js: color, all_sizes,
//    brand), which win over a Console field with the same key, except that
//    Console `brand` options are added to the code list
//    (configAV.mergeHostedBrandOptions; Console wins per option);
//  - every other enum/multi-enum public field from Console's listing-fields
//    asset.
// Categories come from Console's listing-categories asset.

const { avListingFields } = require('../../../src/config/configListingAV');

// Mirrors configAV.brandFieldKey (ESM, so not importable here).
const BRAND_FIELD_KEY = 'brand';
const ENUM_SCHEMA_TYPES = new Set(['enum', 'multi-enum']);
const CATEGORY_KEYS = ['categoryLevel1', 'categoryLevel2', 'categoryLevel3'];

// Case-, accent- and whitespace-insensitive form used for matching only; the
// stored value is always the option key exactly as configured.
const normalize = value =>
  String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const isUsableOption = option =>
  typeof option?.option === 'string' &&
  option.option.trim() !== '' &&
  typeof option?.label === 'string' &&
  option.label.trim() !== '';

// Index a list of { value, label } entries for lookup by key or by label. A
// label shared by several entries is kept as a list, so it is reported as
// ambiguous instead of silently resolving to one of them.
const buildIndex = entries => {
  const byKey = new Map();
  const byLabel = new Map();
  entries.forEach(entry => {
    byKey.set(normalize(entry.value), entry.value);
    const label = normalize(entry.label);
    byLabel.set(label, [...(byLabel.get(label) || []), entry.value]);
  });
  return { values: entries.map(e => e.value), byKey, byLabel };
};

const lookup = (index, raw) => {
  const n = normalize(raw);
  if (index.byKey.has(n)) return { value: index.byKey.get(n) };
  const byLabel = index.byLabel.get(n);
  if (byLabel?.length === 1) return { value: byLabel[0] };
  if (byLabel?.length > 1) return { ambiguous: byLabel };
  return null;
};

/**
 * Resolve one CSV value against an index: the option key or its label, ignoring
 * case and accents. A value written as "Grupo / Opción" (the Google Sheets
 * template's size dropdown writes "Ropa / M") is retried with its last segment
 * when the whole value matches nothing.
 *
 * @returns {{ value: string } | { ambiguous: string[] } | { unknown: true }}
 */
const resolveOption = (index, raw) => {
  const direct = lookup(index, raw);
  if (direct) return direct;
  const segments = String(raw).split('/');
  if (segments.length > 1) {
    const last = lookup(index, segments[segments.length - 1]);
    if (last) return last;
  }
  return { unknown: true };
};

const toIndex = (schemaType, options) => ({
  schemaType,
  ...buildIndex(options.filter(isUsableOption).map(o => ({ value: o.option, label: o.label }))),
});

/**
 * Build the enum option sets bulk import validates against.
 *
 * @param {Array} hostedFields listingFields from Console's listing-fields asset
 * @param {Array} codeFields code-defined listing fields (configListingAV.js)
 * @returns {Map<string, { schemaType, values, byKey, byLabel }>}
 */
const buildFieldOptions = (hostedFields, codeFields = avListingFields) => {
  const hosted = (Array.isArray(hostedFields) ? hostedFields : []).filter(
    f => typeof f?.key === 'string' && (f.scope || 'public') === 'public'
  );
  const fieldOptions = new Map();

  hosted
    .filter(f => ENUM_SCHEMA_TYPES.has(f.schemaType) && Array.isArray(f.enumOptions))
    .forEach(f => fieldOptions.set(f.key, toIndex(f.schemaType, f.enumOptions)));

  // Code-defined fields replace a Console field with the same key, as in
  // configHelpers; only `brand` keeps the Console options as well.
  codeFields
    .filter(f => ENUM_SCHEMA_TYPES.has(f?.schemaType) && Array.isArray(f.enumOptions))
    .forEach(f => {
      const hostedBrand =
        f.key === BRAND_FIELD_KEY ? hosted.find(h => h.key === BRAND_FIELD_KEY) : null;
      const hostedOptions = Array.isArray(hostedBrand?.enumOptions) ? hostedBrand.enumOptions : [];
      const byOption = new Map(
        [...f.enumOptions, ...hostedOptions].filter(isUsableOption).map(o => [o.option, o])
      );
      fieldOptions.set(f.key, toIndex(f.schemaType, [...byOption.values()]));
    });

  return fieldOptions;
};

// Same tree as the asset ({ id, name, subcategories }), each level indexed.
const buildCategoryTree = categories =>
  (Array.isArray(categories) ? categories : [])
    .filter(c => typeof c?.id === 'string' && c.id.trim() !== '')
    .map(c => ({
      id: c.id,
      name: typeof c.name === 'string' && c.name.trim() !== '' ? c.name : c.id,
      subcategories: buildCategoryTree(c.subcategories),
    }));

const indexCategories = nodes => buildIndex(nodes.map(c => ({ value: c.id, label: c.name })));

// The ids an error message may suggest: the first few, then the count.
const MAX_SUGGESTIONS = 10;
const describeValues = values =>
  values.length > MAX_SUGGESTIONS
    ? `${values.slice(0, MAX_SUGGESTIONS).join(', ')}… (${values.length} en total)`
    : values.join(', ');

/**
 * Resolve the CSV's three category columns to an id path, as the listing
 * wizard requires: a top-level category, and every deeper level until a
 * category without subcategories. Each level accepts the id or the name.
 *
 * @param {Array} tree buildCategoryTree() output; empty means the marketplace
 *   has no categories and nothing is required
 * @param {Array<string|undefined>} rawLevels the three column values
 * @param {Function} columnLabel level index → the operator's column name
 * @returns {{ values: Object, errors: string[] }} values keyed categoryLevelN
 */
const resolveCategoryPath = (tree, rawLevels, columnLabel) => {
  const values = {};
  const errors = [];
  if (tree.length === 0) return { values, errors };

  let nodes = tree;
  let parent = null;
  for (let level = 0; level < CATEGORY_KEYS.length; level++) {
    const raw = rawLevels[level];
    const hasValue = raw != null && String(raw).trim() !== '';
    const column = columnLabel(level);

    if (nodes.length === 0) {
      // The path already ended at a category without subcategories.
      if (hasValue) {
        errors.push(
          `"${column}" debe estar vacío: "${parent.id}" no tiene subcategorías, se recibió "${raw}".`
        );
      }
      continue;
    }
    if (!hasValue) {
      errors.push(
        parent
          ? `Falta "${column}": "${
              parent.id
            }" tiene subcategorías. Valores válidos: ${describeValues(nodes.map(n => n.id))}.`
          : `Falta la categoría ("${column}"). Valores válidos: ${describeValues(
              nodes.map(n => n.id)
            )}.`
      );
      break;
    }

    const index = indexCategories(nodes);
    const resolved = lookup(index, raw);
    if (!resolved || resolved.ambiguous) {
      const where = parent ? `una subcategoría de "${parent.id}"` : 'una categoría';
      errors.push(
        `"${column}": "${raw}" no es ${where}. Valores válidos: ${describeValues(index.values)}.`
      );
      break;
    }
    values[CATEGORY_KEYS[level]] = resolved.value;
    parent = nodes.find(n => n.id === resolved.value);
    nodes = parent.subcategories;
  }
  return { values, errors };
};

module.exports = {
  CATEGORY_KEYS,
  normalize,
  buildFieldOptions,
  buildCategoryTree,
  resolveOption,
  resolveCategoryPath,
  describeValues,
};
