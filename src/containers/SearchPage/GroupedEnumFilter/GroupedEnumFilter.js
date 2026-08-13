import React, { useState } from 'react';
import classNames from 'classnames';

import SelectMultipleFilter from '../SelectMultipleFilter/SelectMultipleFilter';
import IconPlus from '../IconPlus/IconPlus';
import FilterPlainCss from '../FilterPlain/FilterPlain.module.css';

/**
 * GroupedEnumFilter — AV filter that renders a parent labeled section that
 * expands to show a stack of `SelectMultipleFilter`s, one per child filter
 * config. Used when a `grouped_enum` schema type appears with
 * `filterConfig.filterType === 'GroupedSelectMultipleFilter'`.
 *
 * Props match what FilterComponent already passes plus `childFilters` and the
 * resolved `componentId`, which every id in here is derived from so that the
 * desktop and mobile filter columns cannot emit the same ids.
 */
const GroupedEnumFilter = props => {
  const {
    componentId,
    label,
    childFilters,
    constructQueryParamName,
    initialValues,
    getHandleChangedValueFn,
    getAriaLabel,
    liveEdit,
    useHistoryPush,
    rest = {},
  } = props;

  const [isOpen, setOpened] = useState(false);
  const toggleIsOpen = () => setOpened(!isOpen);

  const panelId = `${componentId}.panel`;

  return (
    <div className={FilterPlainCss.root}>
      <button
        type="button"
        className={FilterPlainCss.labelButton}
        onClick={toggleIsOpen}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className={FilterPlainCss.labelButtonContent}>
          <span className={FilterPlainCss.labelWrapper}>
            <span className={FilterPlainCss.label}>{label}</span>
          </span>
          <span className={FilterPlainCss.openSign}>
            <IconPlus isOpen={isOpen} isSelected={true} />
          </span>
        </span>
      </button>

      <div
        id={panelId}
        className={classNames(FilterPlainCss.plain, FilterPlainCss.grouped, {
          [FilterPlainCss.isOpen]: isOpen,
        })}
      >
        {childFilters.map(elementConfig => {
          const { key, schemaType, scope, enumOptions, filterConfig = {} } = elementConfig;
          const { label: childLabel } = filterConfig;
          // Derived from the parent's id rather than the shared prefix, so the
          // desktop and mobile filter columns do not both render these ids.
          const childComponentId = `${componentId}.${key.toLowerCase()}`;
          const name = key.replace(/\s+/g, '-');
          const queryParamNames = [constructQueryParamName(key, scope)];

          return (
            <div key={childComponentId}>
              {/* rest is spread first: an id arriving through it must not
                  replace the one derived for this child. */}
              <SelectMultipleFilter
                {...rest}
                id={childComponentId}
                label={childLabel}
                name={name}
                queryParamNames={queryParamNames}
                initialValues={initialValues(queryParamNames, liveEdit)}
                onSubmit={getHandleChangedValueFn(useHistoryPush)}
                options={enumOptions}
                schemaType={schemaType}
                getAriaLabel={getAriaLabel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GroupedEnumFilter;
