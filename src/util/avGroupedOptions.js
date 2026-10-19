/**
 * Resolve the option groups of a `groupedMultiSelect` display override
 * (`configListingDisplay.js`) into what FieldGroupedMultiSelect renders.
 *
 * The config stores each group as `{ key, labelTranslationKey, options: ['s', …] }`.
 * The field needs a readable group `label` and `{ option, label }` options, with
 * each option label taken from the listing field's `enumOptions`. Both the
 * listing form and the search filter render these groups, so both go through
 * here; a group or option that is already resolved is kept as is.
 *
 * @param {Array} groups `saveConfig.groups` from the display override
 * @param {Array} enumOptions the listing field's `{ option, label }` options
 * @param {Object} intl react-intl instance
 * @returns {Array} groups with a `label` and `{ option, label }` options
 */
export const resolveOptionGroups = (groups, enumOptions, intl) => {
  const enumLabels = (enumOptions || []).reduce((labels, option) => {
    labels[option.option] = option.label;
    return labels;
  }, {});

  return (groups || []).map(group => ({
    ...group,
    label: group.labelTranslationKey
      ? intl.formatMessage({ id: group.labelTranslationKey })
      : group.label,
    options: (group.options || []).map(option =>
      typeof option === 'string' ? { option, label: enumLabels[option] || option } : option
    ),
  }));
};
