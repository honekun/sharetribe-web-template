import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import {
  categories,
  searchParams,
} from '../../extensions/searchFilters/avCategorySearch.testData.json';

import FilterComponent from './FilterComponent';

const noop = () => null;
const { userEvent } = testingLibrary;

const enumConfig = {
  key: 'brand',
  scope: 'public',
  schemaType: 'enum',
  enumOptions: [{ option: 'nike', label: 'Nike' }],
  filterConfig: { label: 'Brand' },
};

const renderFilter = (props = {}) =>
  render(
    <FilterComponent
      config={enumConfig}
      intl={fakeIntl}
      urlQueryParams={{}}
      initialValues={() => ({})}
      getHandleChangedValueFn={() => noop}
      listingCategories={[]}
      marketplaceCurrency="MXN"
      showAsPopup={false}
      liveEdit={false}
      {...props}
    />
  );

const idsIn = container => Array.from(container.querySelectorAll('[id]')).map(el => el.id);

describe('FilterComponent category groups', () => {
  const categoryProps = {
    config: {
      key: 'categoryLevel',
      scope: 'public',
      schemaType: 'category',
      isNestedEnum: true,
      nestedParams: ['categoryLevel1', 'categoryLevel2', 'categoryLevel3'],
    },
    listingCategories: categories,
    initialValues: () => searchParams,
  };
  const groupLabel =
    'Ropa / Faldas / Leather, Ropa / Pantalones / Leather, Ropa / Sacos y chamarras / Chamarras de piel';

  it('shows the group and lets shoppers replace it with Ropa or Faldas', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const { getByText, getByRole } = renderFilter({
      ...categoryProps,
      liveEdit: true,
      getHandleChangedValueFn: () => onSubmit,
    });

    await user.click(getByRole('button', { name: 'SearchPage.screenreader.openFilterButton' }));
    const selectedGroup = getByRole('button', {
      name: 'FieldSelectTree.screenreader.optionSelected',
    });
    expect(selectedGroup.textContent.replace(/\u200b/g, '')).toBe(groupLabel);
    await user.click(getByText('Ropa'));
    expect(onSubmit).toHaveBeenLastCalledWith({
      pub_categoryLevel1: 'ropa',
      pub_categoryLevel2: null,
      pub_categoryLevel3: null,
    });
    await user.click(getByText('Faldas'));
    expect(onSubmit).toHaveBeenLastCalledWith({
      pub_categoryLevel1: 'ropa',
      pub_categoryLevel2: 'ropa-faldas',
      pub_categoryLevel3: null,
    });
  });

  it('lets shoppers clear the category group', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const { getByRole } = renderFilter({
      ...categoryProps,
      liveEdit: true,
      getHandleChangedValueFn: () => onSubmit,
    });
    await user.click(getByRole('button', { name: 'SearchPage.screenreader.openFilterButton' }));
    await user.click(getByRole('button', { name: 'FilterPlain.clear' }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      pub_categoryLevel1: null,
      pub_categoryLevel2: null,
      pub_categoryLevel3: null,
    });
  });

  it('preserves the group when applying the popup without changing it', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const { getByRole } = renderFilter({
      ...categoryProps,
      showAsPopup: true,
      getHandleChangedValueFn: () => onSubmit,
    });
    await user.click(getByRole('button', { name: 'SearchPage.screenreader.openFilterButton' }));
    await user.click(getByRole('button', { name: 'FilterForm.submit' }));
    expect(onSubmit).toHaveBeenLastCalledWith(searchParams);
  });
});

describe('FilterComponent id seam', () => {
  it('uses the caller id, which namespaces desktop and mobile apart', () => {
    const desktop = renderFilter({ id: 'SearchFiltersDesktop.brand' });
    const desktopIds = idsIn(desktop.container);
    desktop.unmount();

    const mobile = renderFilter({ id: 'SearchFiltersMobile.brand' });
    const mobileIds = idsIn(mobile.container);

    expect(desktopIds.length).toBeGreaterThan(0);
    expect(desktopIds.every(id => id.startsWith('SearchFiltersDesktop.brand'))).toBe(true);
    expect(mobileIds.every(id => id.startsWith('SearchFiltersMobile.brand'))).toBe(true);
    expect(desktopIds.some(id => mobileIds.includes(id))).toBe(false);
  });

  it('derives an id from idPrefix when the caller gives none', () => {
    const { container } = renderFilter({ idPrefix: 'SearchFiltersDesktop' });
    expect(idsIn(container).every(id => id.startsWith('SearchFiltersDesktop.brand'))).toBe(true);
  });

  it('falls back to the SearchPage prefix with neither id nor idPrefix', () => {
    const { container } = renderFilter();
    expect(idsIn(container).every(id => id.startsWith('SearchPage.brand'))).toBe(true);
  });

  it('emits no duplicate ids', () => {
    const { container } = renderFilter({ id: 'SearchFiltersDesktop.brand' });
    const ids = idsIn(container);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // AV filters receive the resolved id as an explicit `componentId` prop rather
  // than through the spread, so this is where a stale derived id used to show:
  // both columns emitted the same SearchPage.<key> ids.
  it('hands AV filters an id that differs between the two columns', () => {
    const groupedConfig = {
      key: 'all_sizes',
      scope: 'public',
      schemaType: 'grouped_enum',
      filterConfig: { filterType: 'GroupedSelectMultipleFilter', label: 'Sizes' },
      childFilters: [
        {
          key: 'size_mx',
          schemaType: 'multi-enum',
          scope: 'public',
          enumOptions: [{ option: '28', label: '28' }],
          filterConfig: { label: 'MX' },
        },
      ],
    };

    const desktop = renderFilter({ config: groupedConfig, id: 'SearchFiltersDesktop.all_sizes' });
    const desktopIds = idsIn(desktop.container);
    desktop.unmount();

    const mobile = renderFilter({ config: groupedConfig, id: 'SearchFiltersMobile.all_sizes' });
    const mobileIds = idsIn(mobile.container);

    expect(desktopIds.every(id => id.startsWith('SearchFiltersDesktop.all_sizes'))).toBe(true);
    expect(mobileIds.every(id => id.startsWith('SearchFiltersMobile.all_sizes'))).toBe(true);
    expect(desktopIds.some(id => mobileIds.includes(id))).toBe(false);
  });
});
