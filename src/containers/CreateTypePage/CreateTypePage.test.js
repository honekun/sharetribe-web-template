import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import CreateTypePage from './CreateTypePage';

const { screen } = testingLibrary;

describe('CreateTypePage', () => {
  it('renders the heading and both upload options', () => {
    render(<CreateTypePage params={{}} location={{ search: '' }} />);

    expect(screen.getByText('CreateTypePage.heading')).toBeInTheDocument();
    expect(screen.getByText('CreateTypePage.singleTitle')).toBeInTheDocument();
    expect(screen.getByText('CreateTypePage.bulkTitle')).toBeInTheDocument();
  });

  it('links the single-product CTA to the new-listing flow and the bulk CTA to the importer', () => {
    render(<CreateTypePage params={{}} location={{ search: '' }} />);

    expect(screen.getByRole('link', { name: 'CreateTypePage.singleCta' })).toHaveAttribute(
      'href',
      '/l/new'
    );
    expect(screen.getByRole('link', { name: 'CreateTypePage.bulkCta' })).toHaveAttribute(
      'href',
      '/admin/bulk-import'
    );
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<CreateTypePage params={{}} location={{ search: '' }} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
