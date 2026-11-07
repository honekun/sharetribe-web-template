import React from 'react';

import SelectSingleFilter from '../../containers/SearchPage/SelectSingleFilter/SelectSingleFilter';

import { getCategoryFilterProps } from './avCategorySearch';

// Reuse upstream's renderer and interaction handling. Only nested category
// selections need the AV group adapter; ordinary enum filters pass through.
const AVSelectSingleFilter = props => {
  const categoryProps = props.isNestedEnum ? getCategoryFilterProps(props) : {};
  return <SelectSingleFilter {...props} {...categoryProps} />;
};

export default AVSelectSingleFilter;
