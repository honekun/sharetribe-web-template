import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import GroupedMultiSelectFilter from './GroupedMultiSelectFilter';

const { screen } = testingLibrary;

const groups = [
  {
    key: 'standard',
    label: 'Standard',
    options: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }],
  },
  { key: 'mx', label: 'MX', options: [{ key: 'mx-28', label: '28' }] },
];

const renderFilter = (props = {}) =>
  render(
    <GroupedMultiSelectFilter
      id="SearchFilters.all_sizes"
      name="pub_all_sizes"
      label="Size"
      getAriaLabel={(label, values) => `${label}: ${values}`}
      groups={groups}
      queryParamNames={['pub_all_sizes']}
      initialValues={{}}
      onSubmit={jest.fn()}
      searchMode="has_any"
      {...props}
    />,
    { messages: { 'SelectMultipleFilterPlainForm.labelSelected': '{count} selected' } }
  );

describe('GroupedMultiSelectFilter', () => {
  it('matches snapshot (plain variant)', () => {
    const { asFragment } = renderFilter();
    expect(asFragment().firstChild).toMatchSnapshot();
  });

  it('renders the label without a selection summary when nothing is selected', () => {
    renderFilter();
    expect(screen.getAllByText('Size').length).toBeGreaterThan(0);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('summarises the selection parsed from a search-mode query param', () => {
    renderFilter({ initialValues: { pub_all_sizes: 'has_any:s,mx-28' } });
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  // Regression: the display-override config stores translation keys and bare
  // option keys; the filter rendered them as blank group headers and options.
  it('labels groups and options given in the display-override config shape', () => {
    render(
      <GroupedMultiSelectFilter
        id="SearchFilters.all_sizes"
        name="pub_all_sizes"
        label="Size"
        getAriaLabel={(label, values) => `${label}: ${values}`}
        groups={[
          { key: 'standard', labelTranslationKey: 'Group.standard', options: ['s', 'm'] },
          { key: 'mx', labelTranslationKey: 'Group.mx', options: ['mx_28'] },
        ]}
        enumOptions={[
          { option: 's', label: 'S' },
          { option: 'm', label: 'M' },
          { option: 'mx_28', label: 'MX 28' },
        ]}
        queryParamNames={['pub_all_sizes']}
        initialValues={{}}
        onSubmit={jest.fn()}
        searchMode="has_any"
      />,
      {
        messages: {
          'Group.standard': 'Ropa (Estándar)',
          'Group.mx': 'Ropa (MX)',
          'FieldGroupedMultiSelect.expand': 'Expandir',
        },
      }
    );

    testingLibrary.fireEvent.click(screen.getByRole('button', { name: 'Expandir' }));

    expect(screen.getByText('Ropa (Estándar)')).toBeInTheDocument();
    expect(screen.getByText('Ropa (MX)')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('MX 28')).toBeInTheDocument();
  });
});
