import React from 'react';
import '@testing-library/jest-dom';

import { convertCategoriesToSelectTreeOptions } from '../../util/search';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import AVSelectSingleFilter from './AVSelectSingleFilter';
import { categories, ids, searchParams } from './avCategorySearch.testData.json';

const { screen, userEvent } = testingLibrary;
const categoryProps = {
  id: 'categories',
  name: 'categoryLevel',
  label: 'Categories',
  queryParamNames: Object.keys(searchParams),
  options: convertCategoriesToSelectTreeOptions(categories),
  initialValues: searchParams,
  isNestedEnum: true,
  getAriaLabel: label => label,
};

describe('AVSelectSingleFilter', () => {
  it('preserves ordinary enum rendering and submission', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <AVSelectSingleFilter
        id="brand"
        name="brand"
        label="Brand"
        queryParamNames={['pub_brand']}
        options={[{ option: 'prada', label: 'Prada' }]}
        initialValues={{}}
        getAriaLabel={label => label}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Brand' }));
    await user.click(screen.getByText('Prada'));
    expect(onSubmit).toHaveBeenLastCalledWith({ pub_brand: 'prada' });
  });

  it('preserves an ordinary nested category path', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <AVSelectSingleFilter
        {...categoryProps}
        initialValues={{ pub_categoryLevel1: 'ropa', pub_categoryLevel2: 'ropa-faldas' }}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Categories' }));
    await user.click(screen.getByText('Leather'));
    expect(onSubmit).toHaveBeenLastCalledWith({
      pub_categoryLevel1: 'ropa',
      pub_categoryLevel2: 'ropa-faldas',
      pub_categoryLevel3: ids[0],
    });
  });

  it('updates an open pristine popup after navigating to a different category group', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const { rerender } = render(
      <AVSelectSingleFilter {...categoryProps} showAsPopup onSubmit={onSubmit} />
    );
    await user.click(screen.getByRole('button', { name: 'Categories' }));

    const nextSearchParams = {
      pub_categoryLevel1: 'ropa,bolsas',
    };
    rerender(
      <AVSelectSingleFilter
        {...categoryProps}
        showAsPopup
        initialValues={nextSearchParams}
        onSubmit={onSubmit}
      />
    );
    await user.click(screen.getByRole('button', { name: 'FilterForm.submit' }));
    expect(onSubmit).toHaveBeenLastCalledWith(nextSearchParams);
  });
});
