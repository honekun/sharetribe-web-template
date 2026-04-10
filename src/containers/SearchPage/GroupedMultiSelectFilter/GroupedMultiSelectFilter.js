import React from 'react';

import { useIntl } from '../../../util/reactIntl';
import { parseSelectFilterOptions } from '../../../util/search';
import { FieldGroupedMultiSelect } from '../../../components';

import FilterPlain from '../FilterPlain/FilterPlain';
import FilterPopup from '../FilterPopup/FilterPopup';

import css from './GroupedMultiSelectFilter.module.css';

const getQueryParamName = queryParamNames =>
  Array.isArray(queryParamNames) ? queryParamNames[0] : queryParamNames;

const format = (selectedOptions, queryParamName, searchMode) => {
  const hasOptions = selectedOptions && selectedOptions.length > 0;
  const mode = searchMode ? `${searchMode}:` : '';
  const value = hasOptions ? `${mode}${selectedOptions.join(',')}` : null;
  return { [queryParamName]: value };
};

/**
 * Search filter that renders a grouped multi-select dropdown (FieldGroupedMultiSelect)
 * inside a FilterPlain or FilterPopup wrapper. Mirrors SelectMultipleFilter's
 * query-param bridge pattern.
 */
const GroupedMultiSelectFilter = props => {
  const intl = useIntl();
  const {
    id,
    name,
    label,
    getAriaLabel,
    groups,
    initialValues,
    onSubmit,
    queryParamNames,
    searchMode,
    showAsPopup,
    contentPlacementOffset = 0,
    ...rest
  } = props;

  const queryParamName = getQueryParamName(queryParamNames);
  const hasInitialValues = !!initialValues?.[queryParamName];
  const selectedOptions = hasInitialValues
    ? parseSelectFilterOptions(initialValues[queryParamName])
    : [];

  const labelForPopup = hasInitialValues
    ? intl.formatMessage(
        { id: 'SelectMultipleFilter.labelSelected' },
        { labelText: label, count: selectedOptions.length }
      )
    : label;

  const labelSelectionForPlain = hasInitialValues
    ? intl.formatMessage(
        { id: 'SelectMultipleFilterPlainForm.labelSelected' },
        { count: selectedOptions.length }
      )
    : '';

  const namedInitialValues = { [name]: selectedOptions };

  const handleSubmit = values => {
    const usedValue = values ? values[name] : values;
    onSubmit(format(usedValue, queryParamName, searchMode));
  };

  // FieldGroupedMultiSelect uses useField() internally — it must be rendered
  // inside the FinalForm context provided by FilterPlain / FilterPopup.
  const filterContent = (
    <FieldGroupedMultiSelect
      id={`${id}-grouped`}
      name={name}
      label={null}
      groups={groups}
      className={css.field}
    />
  );

  return showAsPopup ? (
    <FilterPopup
      label={labelForPopup}
      ariaLabel={getAriaLabel(label, selectedOptions.join(', '))}
      isSelected={hasInitialValues}
      id={`${id}.popup`}
      showAsPopup
      contentPlacementOffset={contentPlacementOffset}
      onSubmit={handleSubmit}
      initialValues={namedInitialValues}
      keepDirtyOnReinitialize
      {...rest}
    >
      {filterContent}
    </FilterPopup>
  ) : (
    <FilterPlain
      label={label}
      labelSelection={labelSelectionForPlain}
      ariaLabel={getAriaLabel(label, selectedOptions.join(', '))}
      isSelected={hasInitialValues}
      id={`${id}.plain`}
      liveEdit
      onSubmit={handleSubmit}
      initialValues={namedInitialValues}
      {...rest}
    >
      {filterContent}
    </FilterPlain>
  );
};

export default GroupedMultiSelectFilter;
