import React from 'react';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import '@testing-library/jest-dom';

import AVShippingNotice from './AVShippingNotice';

const { screen } = testingLibrary;

describe('AVShippingNotice', () => {
  it('renders the title and the text', () => {
    render(<AVShippingNotice title="Recuerda confirmar" text="No se garantiza el mismo día." />);
    expect(screen.getByText('Recuerda confirmar')).toBeInTheDocument();
    expect(screen.getByText('No se garantiza el mismo día.')).toBeInTheDocument();
  });

  it('renders no button', () => {
    render(<AVShippingNotice title="Recuerda confirmar" text="No se garantiza el mismo día." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when both title and text are blank', () => {
    const { container } = render(<AVShippingNotice title="" text="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both title and text are omitted', () => {
    const { container } = render(<AVShippingNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the text alone when the title is blank', () => {
    render(<AVShippingNotice title="" text="Solo el texto." />);
    expect(screen.getByText('Solo el texto.')).toBeInTheDocument();
    expect(screen.getByText('Solo el texto.').previousSibling).toBeNull();
  });

  it('renders the title alone when the text is blank', () => {
    render(<AVShippingNotice title="Solo el título." text="" />);
    expect(screen.getByText('Solo el título.')).toBeInTheDocument();
  });
});
