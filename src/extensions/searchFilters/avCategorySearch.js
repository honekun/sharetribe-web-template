import { isFieldForCategory as upstreamIsFieldForCategory } from '../../util/fieldHelpers';
import { constructQueryParamName } from '../../util/search';

// Category cards can combine categories at the same depth using Sharetribe's
// comma-separated enum filters. Resolve paths from Console, never from slug text.
const parseCategoryIds = value =>
  typeof value === 'string'
    ? [
        ...new Set(
          value
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
        ),
      ]
    : [];

const findCategoryPath = (categories, id, ancestors = []) => {
  for (const category of categories) {
    const path = [...ancestors, category.id];
    if (category.id === id) {
      return path;
    }
    const found = findCategoryPath(category.subcategories || [], id, path);
    if (found) {
      return found;
    }
  }
  return null;
};

/**
 * Build a category card's query from one ID or comma-separated IDs.
 * A group must contain known categories at the same depth: combining different
 * depths with ANDed level filters would exclude some of the requested listings.
 * Returns null for an invalid group so its card cannot open an unfiltered search.
 */
export const getCategoryCardSearchParams = (value, categories = [], prefix = 'categoryLevel') => {
  const ids = parseCategoryIds(value);
  if (!ids.length) {
    return null;
  }
  const paths = ids.map(id => findCategoryPath(categories, id));

  // Preserve legacy single-category cards when their ID is absent from config.
  if (ids.length === 1 && !paths[0]) {
    return { [`pub_${prefix}1`]: ids[0] };
  }
  if (paths.some(path => !path || path.length !== paths[0].length)) {
    return null;
  }

  return paths[0].reduce((params, id, index) => {
    const values = [...new Set(paths.map(path => path[index]))];
    return { ...params, [`pub_${prefix}${index + 1}`]: values.join(',') };
  }, {});
};

/**
 * Validate each category level against the union of its selected parents.
 * Used by both SearchPage's URL handling and SDK query preparation so grouped
 * categories survive filtering, sorting, pagination, and SSR consistently.
 * The prefix includes the scope, e.g. "pub_categoryLevel".
 */
export const getValidCategorySearchParams = (prefix, categories, level, params) => {
  const levelKey = `${prefix}${level}`;
  const ids = parseCategoryIds(params?.[levelKey]);
  const selected = ids.map(id => categories.find(category => category.id === id)).filter(Boolean);
  if (!selected.length) {
    return {};
  }
  const children = selected.flatMap(category => category.subcategories || []);
  return {
    [levelKey]: selected.map(category => category.id).join(','),
    ...(children.length > 0
      ? getValidCategorySearchParams(prefix, children, level + 1, params)
      : {}),
  };
};

/**
 * Optional SearchPage hook: handle comma-separated category values, or return
 * null so the original upstream single-path validator runs unchanged.
 * URL validation uses an unscoped prefix; SDK preparation already includes it.
 */
export const getGroupedCategoryParams = (prefix, categories, level, params) => {
  const scopedPrefix = /^(pub|meta)_/.test(prefix)
    ? prefix
    : constructQueryParamName(prefix, 'public');
  const hasGroup = Object.entries(params || {}).some(
    ([key, value]) =>
      key.startsWith(scopedPrefix) &&
      /^\d+$/.test(key.slice(scopedPrefix.length)) &&
      typeof value === 'string' &&
      value.includes(',')
  );
  return hasGroup ? getValidCategorySearchParams(scopedPrefix, categories, level, params) : null;
};

// Adapt only SearchPage's category-restricted field checks. Keep the upstream
// utility itself untouched, including its behavior for ordinary selections.
export const isFieldForCategory = (categories, fieldConfig) =>
  upstreamIsFieldForCategory(
    Array.isArray(categories)
      ? categories.flatMap(category =>
          typeof category === 'string' ? category.split(',') : category
        )
      : categories,
    fieldConfig
  );

/**
 * Present a curated group as one selected option in the existing single-path
 * filter. Its real category options remain available to replace the group.
 * Popup Apply without changes must submit the original query, not this UI value.
 */
export const getCategoryFilterProps = ({ queryParamNames, initialValues, options, onSubmit }) => {
  const props = { initialValues, options, onSubmit };
  const selections = (queryParamNames || [])
    .map(key => parseCategoryIds(initialValues?.[key]))
    .filter(ids => ids.length > 0);
  if (!selections.some(ids => ids.length > 1)) {
    return props;
  }

  const selectedIds = selections[selections.length - 1];
  const getSelectedLabels = (opts, ancestors = []) =>
    opts.flatMap(option => {
      const path = [...ancestors, option.label];
      return selectedIds.includes(option.option)
        ? [path.join(' / ')]
        : getSelectedLabels(option.suboptions || [], path);
    });
  const groupValue = JSON.stringify(initialValues);
  const firstParam = queryParamNames[0];

  return {
    initialValues: { [firstParam]: groupValue },
    options: [{ option: groupValue, label: getSelectedLabels(options).join(', ') }, ...options],
    onSubmit: values => onSubmit(values?.[firstParam] === groupValue ? initialValues : values),
  };
};
