import React from 'react';
import { useIntl } from '../../util/reactIntl';
import { useHistory, useLocation } from 'react-router-dom';
import { parse, stringify } from '../../util/urlHelpers';
import { pathByRouteName } from '../../util/routes';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';

import css from './TransactionFilters.module.css';

const TransactionFilters = props => {
  const { pageName } = props;
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  const routeConfiguration = useRouteConfiguration();

  const currentParams = parse(location.search);
  const { status = '', dateFrom = '', dateTo = '' } = currentParams;

  const hasFilters = status || dateFrom || dateTo;

  const updateFilter = updates => {
    const newParams = { ...currentParams, ...updates, page: 1 };
    // Remove empty values
    Object.keys(newParams).forEach(key => {
      if (!newParams[key]) delete newParams[key];
    });
    const path = pathByRouteName(pageName, routeConfiguration);
    const search = stringify(newParams);
    history.push(`${path}?${search}`);
  };

  const clearFilters = e => {
    e.preventDefault();
    const path = pathByRouteName(pageName, routeConfiguration);
    history.push(path);
  };

  return (
    <div className={css.root}>
      <div className={css.filters}>
        <div className={css.filterGroup}>
          <label className={css.label} htmlFor="status-filter">
            {intl.formatMessage({ id: 'TransactionFilters.status' })}
          </label>
          <select
            id="status-filter"
            className={css.select}
            value={status}
            onChange={e => updateFilter({ status: e.target.value })}
          >
            <option value="">{intl.formatMessage({ id: 'TransactionFilters.all' })}</option>
            <option value="completed">
              {intl.formatMessage({ id: 'TransactionFilters.completed' })}
            </option>
            <option value="pending">
              {intl.formatMessage({ id: 'TransactionFilters.pending' })}
            </option>
            <option value="cancelled">
              {intl.formatMessage({ id: 'TransactionFilters.cancelled' })}
            </option>
          </select>
        </div>

        <div className={css.filterGroup}>
          <label className={css.label} htmlFor="date-from">
            {intl.formatMessage({ id: 'TransactionFilters.dateFrom' })}
          </label>
          <input
            id="date-from"
            type="date"
            className={css.dateInput}
            value={dateFrom}
            onChange={e => updateFilter({ dateFrom: e.target.value })}
          />
        </div>

        <div className={css.filterGroup}>
          <label className={css.label} htmlFor="date-to">
            {intl.formatMessage({ id: 'TransactionFilters.dateTo' })}
          </label>
          <input
            id="date-to"
            type="date"
            className={css.dateInput}
            value={dateTo}
            onChange={e => updateFilter({ dateTo: e.target.value })}
          />
        </div>
      </div>

      {hasFilters ? (
        <button className={css.clearButton} onClick={clearFilters} type="button">
          {intl.formatMessage({ id: 'TransactionFilters.clearAll' })}
        </button>
      ) : null}
    </div>
  );
};

export default TransactionFilters;
