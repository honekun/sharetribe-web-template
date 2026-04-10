import React, { useState } from 'react';

// utils
import { SCHEMA_TYPE_ENUM, SCHEMA_TYPE_MULTI_ENUM, SCHEMA_TYPE_LONG } from '../../util/types';
import { convertCategoriesToSelectTreeOptions, constructQueryParamName } from '../../util/search';

// component imports
import SelectSingleFilter from './SelectSingleFilter/SelectSingleFilter';
import SelectMultipleFilter from './SelectMultipleFilter/SelectMultipleFilter';
import BookingDateRangeFilter from './BookingDateRangeFilter/BookingDateRangeFilter';
import KeywordFilter from './KeywordFilter/KeywordFilter';
import PriceFilter from './PriceFilter/PriceFilter';
import IntegerRangeFilter from './IntegerRangeFilter/IntegerRangeFilter';
import SeatsFilter from './SeatsFilter/SeatsFilter';
import GroupedMultiSelectFilter from './GroupedMultiSelectFilter/GroupedMultiSelectFilter';
import { listingFieldDisplayOverrides } from '../../config/configListingDisplay';

// TODO: move to component.
import classNames from 'classnames';
import FilterPlainCss from './FilterPlain/FilterPlain.module.css';
import IconPlus from './IconPlus/IconPlus';

/**
 * FilterComponent is used to map configured filter types
 * to actual filter components
 */
const FilterComponent = props => {
  const {
    idPrefix,
    config,
    urlQueryParams,
    initialValues,
    getHandleChangedValueFn,
    listingCategories,
    marketplaceCurrency,
    intl,
    ...rest
  } = props;
  // Note: config can be either
  // - listingFields config or
  // - default filter config
  // They both have 'key' and 'schemaType' included.
  const { key, schemaType } = config;
  const { liveEdit, showAsPopup } = rest;

  const useHistoryPush = liveEdit || showAsPopup;
  const prefix = idPrefix || 'SearchPage';
  const componentId = `${prefix}.${key.toLowerCase()}`;
  const name = key.replace(/\s+/g, '-');
  const getAriaLabel = (label, values) => {
    const status = values ? 'active' : 'inactive';
    const mode = liveEdit ? 'live' : 'normal';
    return intl.formatMessage(
      { id: 'SearchPage.screenreader.openFilterButton' },
      { label, status, values, mode }
    );
  };

  // Default filters: price, keywords, dates
  switch (schemaType) {
    case 'category': {
      const { scope, isNestedEnum, nestedParams } = config;
      const queryParamNames = nestedParams?.map(p => constructQueryParamName(p, scope));
      const label = intl.formatMessage({ id: 'FilterComponent.categoryLabel' });

      return (
        <SelectSingleFilter
          id={componentId}
          name={key}
          label={label}
          queryParamNames={queryParamNames}
          initialValues={initialValues(queryParamNames, liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          options={convertCategoriesToSelectTreeOptions(listingCategories)}
          isNestedEnum={isNestedEnum}
          getAriaLabel={getAriaLabel}
          {...rest}
        />
      );
    }
    case 'listingType': {
      const { scope, options } = config;
      const paramNames = [constructQueryParamName(key, scope)];
      const label = intl.formatMessage({ id: 'FilterComponent.listingTypeLabel' });

      return (
        <SelectSingleFilter
          id={componentId}
          name={key}
          label={label}
          queryParamNames={[paramNames]}
          initialValues={initialValues(paramNames, liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          options={options}
          getAriaLabel={getAriaLabel}
          {...rest}
        />
      );
    }
    case 'price': {
      const { min, max, step } = config;
      return (
        <PriceFilter
          id={componentId}
          name={key}
          label={intl.formatMessage({ id: 'FilterComponent.priceLabel' })}
          queryParamNames={[key]}
          initialValues={initialValues([key], liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          min={min}
          max={max}
          step={step}
          marketplaceCurrency={marketplaceCurrency}
          getAriaLabel={getAriaLabel}
          {...rest}
        />
      );
    }
    case 'keywords':
      const label = intl.formatMessage({ id: 'FilterComponent.keywordsLabel' });

      return (
        <KeywordFilter
          id={componentId}
          label={label}
          name={name}
          queryParamNames={[key]}
          initialValues={initialValues([key], liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          getAriaLabel={getAriaLabel}
          {...rest}
        />
      );
    case 'dates': {
      const { dateRangeMode } = config;
      const isNightlyMode = dateRangeMode === 'night';
      return (
        <BookingDateRangeFilter
          id={componentId}
          label={intl.formatMessage({ id: 'FilterComponent.datesLabel' })}
          queryParamNames={[key]}
          initialValues={initialValues([key], liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          minimumNights={isNightlyMode ? 1 : 0}
          getAriaLabel={getAriaLabel}
          {...rest}
        />
      );
    }
    case 'seats': {
      const label = intl.formatMessage({ id: 'FilterComponent.seatsLabel' });
      return (
        <SeatsFilter
          id={componentId}
          name={name}
          label={label}
          queryParamNames={[key]}
          initialValues={initialValues([key], liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          getAriaLabel={getAriaLabel}
          {...rest}
        />
      );
    }
  }

  // Custom extended data filters
  switch (schemaType) {
    case 'grouped_enum': {
      const { childFilters = [], filterConfig = {} } = config;
      if (filterConfig.filterType === 'GroupedSelectMultipleFilter') {
        // TODO: move to component.
        const [isOpen, setOpened] = useState(false);
        const toggleIsOpen = () => {
          setOpened(!isOpen)
        };

        return (<div className={FilterPlainCss.root}>
          <button className={FilterPlainCss.labelButton} onClick={toggleIsOpen}>
            <span className={FilterPlainCss.labelButtonContent}>
              <span className={FilterPlainCss.labelWrapper}>
                <span className={FilterPlainCss.label}>
                  {filterConfig.label}
                </span>
              </span>
              <span className={FilterPlainCss.openSign}>
                <IconPlus isOpen={isOpen} isSelected={true} />
              </span>
            </span>
          </button>

          <div
            id={componentId}
            className={classNames(FilterPlainCss.plain, FilterPlainCss.grouped, { [FilterPlainCss.isOpen]: isOpen })}
          >
            {childFilters.map(elementConfig => {
              const { key, schemaType } = elementConfig;
              const componentId = `${prefix}.${key.toLowerCase()}`;
              const { scope, enumOptions, filterConfig = {} } = elementConfig;
              const { label, filterType } = filterConfig;
              const name = key.replace(/\s+/g, '-');
              const queryParamNames = [constructQueryParamName(key, scope)];

              return (<div key={componentId}>
                  <SelectMultipleFilter
                  id={componentId}
                  label={label}
                  name={name}
                  queryParamNames={queryParamNames}
                  initialValues={initialValues(queryParamNames, liveEdit)}
                  onSubmit={getHandleChangedValueFn(useHistoryPush)}
                  options={enumOptions}
                  schemaType={schemaType}
                  getAriaLabel={getAriaLabel}
                  {...rest}
                />
              </div>);
            })}
          </div>
        </div>);
      }
    }
    case SCHEMA_TYPE_ENUM: {
      const { scope, enumOptions, filterConfig = {} } = config;
      const { label, filterType } = filterConfig;
      const queryParamNames = [constructQueryParamName(key, scope)];
      return filterType === 'SelectSingleFilter' ? (
        <SelectSingleFilter
          id={componentId}
          label={label}
          getAriaLabel={getAriaLabel}
          name={name}
          queryParamNames={queryParamNames}
          initialValues={initialValues(queryParamNames, liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          options={enumOptions}
          isNestedEnum={false}
          {...rest}
        />
      ) : (
        <SelectMultipleFilter
          id={componentId}
          label={label}
          getAriaLabel={getAriaLabel}
          name={name}
          queryParamNames={queryParamNames}
          initialValues={initialValues(queryParamNames, liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          options={enumOptions}
          schemaType={schemaType}
          useSwatches={filterType === 'ColorSwatchFilter' || key === 'color'}
          {...rest}
        />
      );
    }
    case SCHEMA_TYPE_MULTI_ENUM: {
      const { scope, enumOptions, filterConfig = {} } = config;
      const { label, filterType, searchMode } = filterConfig;
      const queryParamNames = [constructQueryParamName(key, scope)];

      // If this field has a groupedMultiSelect display override, render the grouped filter.
      const displayOverride = listingFieldDisplayOverrides[key];
      const groups =
        displayOverride?.saveConfig?.inputType === 'groupedMultiSelect'
          ? displayOverride.saveConfig.groups
          : null;

      if (groups) {
        return (
          <GroupedMultiSelectFilter
            id={componentId}
            label={label}
            getAriaLabel={getAriaLabel}
            name={name}
            queryParamNames={queryParamNames}
            initialValues={initialValues(queryParamNames, liveEdit)}
            onSubmit={getHandleChangedValueFn(useHistoryPush)}
            groups={groups}
            searchMode={searchMode}
            {...rest}
          />
        );
      }

      return (
        <SelectMultipleFilter
          id={componentId}
          label={label}
          getAriaLabel={getAriaLabel}
          name={name}
          queryParamNames={queryParamNames}
          initialValues={initialValues(queryParamNames, liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          options={enumOptions}
          schemaType={schemaType}
          searchMode={searchMode}
          useSwatches={filterType === 'ColorSwatchFilter' || key === 'color'}
          {...rest}
        />
      );
    }
    case SCHEMA_TYPE_LONG: {
      const { minimum, maximum, scope, step, filterConfig = {} } = config;
      const { label } = filterConfig;
      const queryParamNames = [constructQueryParamName(key, scope)];
      return (
        <IntegerRangeFilter
          id={componentId}
          label={label}
          name={name}
          queryParamNames={queryParamNames}
          initialValues={initialValues(queryParamNames, liveEdit)}
          onSubmit={getHandleChangedValueFn(useHistoryPush)}
          min={minimum}
          max={maximum}
          step={step}
          getAriaLabel={getAriaLabel}
          {...rest}
        />
      );
    }
    default:
      return null;
  }
};

export default FilterComponent;
