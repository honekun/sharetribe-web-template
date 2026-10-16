import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import BrandFilter from './BrandFilter';

const { screen, userEvent } = testingLibrary;

const options = [
  { option: 'adidas', label: 'Adidas' },
  { option: 'levis', label: "Levi's" },
  { option: 'zara', label: 'Zara' },
];

const renderFilter = (props = {}) => {
  const onSubmit = jest.fn();
  const utils = render(
    <BrandFilter
      id="SearchFilters.brand"
      name="pub_brand"
      label="Brand"
      getAriaLabel={(label, values) => `${label}: ${values}`}
      options={options}
      queryParamNames={['pub_brand']}
      initialValues={{}}
      onSubmit={onSubmit}
      {...props}
    />,
    { messages: { 'BrandFilter.searchPlaceholder': 'Search brands' } }
  );
  return { ...utils, onSubmit };
};

describe('BrandFilter', () => {
  it('matches snapshot', () => {
    const { asFragment } = renderFilter();
    expect(asFragment().firstChild).toMatchSnapshot();
  });

  it('narrows the option list by the search text, case-insensitively', async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.type(screen.getByPlaceholderText('Search brands'), 'ZA');

    expect(screen.getByLabelText('Zara')).toBeInTheDocument();
    expect(screen.queryByLabelText('Adidas')).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.type(screen.getByPlaceholderText('Search brands'), 'gucci');

    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('pre-checks options from the query param', () => {
    renderFilter({ initialValues: { pub_brand: 'zara,adidas' } });

    expect(screen.getByLabelText('Zara')).toBeChecked();
    expect(screen.getByLabelText('Adidas')).toBeChecked();
    expect(screen.getByLabelText("Levi's")).not.toBeChecked();
  });

  it('submits the selection as a comma-separated query param', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderFilter();

    await user.click(screen.getByLabelText('Zara'));

    expect(onSubmit).toHaveBeenLastCalledWith({ pub_brand: 'zara' });
  });
});
