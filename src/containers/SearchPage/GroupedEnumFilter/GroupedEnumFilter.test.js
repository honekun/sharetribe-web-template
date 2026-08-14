import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import GroupedEnumFilter from './GroupedEnumFilter';

const { screen, userEvent } = testingLibrary;

const noop = () => null;

const childFilters = [
  {
    key: 'size_mx',
    schemaType: 'multi-enum',
    scope: 'public',
    enumOptions: [{ option: '28', label: '28' }],
    filterConfig: { label: 'MX' },
  },
  {
    key: 'size_us',
    schemaType: 'multi-enum',
    scope: 'public',
    enumOptions: [{ option: '6', label: '6' }],
    filterConfig: { label: 'US' },
  },
];

const baseProps = {
  label: 'Sizes',
  childFilters,
  constructQueryParamName: (key, scope) => `${scope === 'public' ? 'pub_' : ''}${key}`,
  initialValues: () => ({}),
  getHandleChangedValueFn: () => noop,
  getAriaLabel: label => label,
  liveEdit: false,
  useHistoryPush: false,
};

const renderFilter = (props = {}) =>
  render(
    <GroupedEnumFilter componentId="SearchFiltersDesktop.all_sizes" {...baseProps} {...props} />
  );

const idsIn = container => Array.from(container.querySelectorAll('[id]')).map(el => el.id);

describe('GroupedEnumFilter', () => {
  it('derives child ids from the parent id, so both columns stay distinct', () => {
    const desktop = renderFilter();
    const desktopIds = idsIn(desktop.container);
    desktop.unmount();

    const mobile = renderFilter({ componentId: 'SearchFiltersMobile.all_sizes' });
    const mobileIds = idsIn(mobile.container);

    // SelectMultipleFilter suffixes the id it is given, so match on the prefix.
    expect(desktopIds.some(id => id.startsWith('SearchFiltersDesktop.all_sizes.size_mx'))).toBe(
      true
    );
    expect(mobileIds.some(id => id.startsWith('SearchFiltersMobile.all_sizes.size_mx'))).toBe(true);
    expect(desktopIds.every(id => id.startsWith('SearchFiltersDesktop.'))).toBe(true);
    // Nothing is emitted by both columns.
    expect(desktopIds.some(id => mobileIds.includes(id))).toBe(false);
  });

  it('gives every element in one filter a unique id', () => {
    const { container } = renderFilter();
    const ids = idsIn(container);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not let an id arriving through rest overwrite the child ids', () => {
    // FilterComponent keeps `id` out of rest now; this guards the child seam
    // in case anything else spreads one in.
    const { container } = renderFilter({ rest: { id: 'SearchFiltersDesktop.all_sizes' } });
    const ids = idsIn(container);

    expect(new Set(ids).size).toBe(ids.length);
    // Both children keep their own derived id rather than the one from rest.
    expect(ids.some(id => id.startsWith('SearchFiltersDesktop.all_sizes.size_mx'))).toBe(true);
    expect(ids.some(id => id.startsWith('SearchFiltersDesktop.all_sizes.size_us'))).toBe(true);
  });

  it('exposes the toggle as a button that reports its state', async () => {
    const user = userEvent.setup();
    renderFilter();

    const toggle = screen.getByRole('button', { name: 'Sizes' });
    // type=button, so it cannot submit a surrounding filter form.
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const panelId = toggle.getAttribute('aria-controls');
    expect(document.getElementById(panelId)).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders one child filter per configured group', () => {
    const { container } = renderFilter();

    // Each child renders its own filter form, keyed by the derived id.
    const childFormIds = idsIn(container).filter(id => id.endsWith('.plain.form'));
    expect(childFormIds).toEqual([
      'SearchFiltersDesktop.all_sizes.size_mx.plain.form',
      'SearchFiltersDesktop.all_sizes.size_us.plain.form',
    ]);
    expect(screen.getAllByText('MX').length).toBeGreaterThan(0);
    expect(screen.getAllByText('US').length).toBeGreaterThan(0);
  });
});
