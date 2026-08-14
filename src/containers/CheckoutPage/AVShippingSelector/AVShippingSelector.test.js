import React from 'react';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import '@testing-library/jest-dom';

import AVShippingSelector from './AVShippingSelector';

const { screen } = testingLibrary;

const base = {
  express: { amountSubunits: 18900, currency: 'MXN', days: 2 },
  estandar: { amountSubunits: 12900, currency: 'MXN', days: 5 },
  rawRates: [
    {
      rate_id: 'r1',
      provider: 'DHL',
      servicelevel: { name: 'Exp' },
      days: 2,
      buyerAmountSubunits: 18900,
      currency: 'MXN',
      tags: ['FASTEST'],
    },
  ],
  selectedType: null,
  onSelect: () => {},
  onRetry: () => {},
  onContactSeller: () => {},
};

describe('AVShippingSelector', () => {
  it('renders Express and Estándar buckets when quoted', () => {
    render(<AVShippingSelector status="quoted" {...base} />);
    expect(screen.getByText('AVShippingSelector.express')).toBeInTheDocument();
    expect(screen.getByText('AVShippingSelector.estandar')).toBeInTheDocument();
  });

  it('lists the raw rates below the buckets', () => {
    render(<AVShippingSelector status="quoted" {...base} />);
    expect(screen.getByText(/DHL/)).toBeInTheDocument();
  });

  it('shows a loading state while quoting', () => {
    render(<AVShippingSelector status="quoting" {...base} />);
    expect(screen.getByText('AVShippingSelector.loading')).toBeInTheDocument();
  });

  it('shows an animated spinner alongside the loading text', () => {
    render(<AVShippingSelector status="quoting" {...base} />);
    expect(
      screen.getByRole('img', { name: 'IconSpinner.screenreader.loading' })
    ).toBeInTheDocument();
  });

  it('does not show the spinner once quoted', () => {
    render(<AVShippingSelector status="quoted" {...base} />);
    expect(
      screen.queryByRole('img', { name: 'IconSpinner.screenreader.loading' })
    ).not.toBeInTheDocument();
  });

  it('shows the confirm-with-seller notice below the buckets when quoted', () => {
    render(<AVShippingSelector status="quoted" {...base} />);
    expect(screen.getByText('AVShippingSelector.noticeTitle')).toBeInTheDocument();
    expect(screen.getByText('AVShippingSelector.noticeText')).toBeInTheDocument();
  });

  it('hides the notice when the microcopy keys are blank', () => {
    render(<AVShippingSelector status="quoted" {...base} />, {
      messages: { 'AVShippingSelector.noticeTitle': '', 'AVShippingSelector.noticeText': '' },
    });
    expect(screen.queryByText('AVShippingSelector.noticeTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('AVShippingSelector.noticeText')).not.toBeInTheDocument();
  });

  it('does not show the notice while quoting or on error', () => {
    const { unmount } = render(<AVShippingSelector status="quoting" {...base} />);
    expect(screen.queryByText('AVShippingSelector.noticeTitle')).not.toBeInTheDocument();
    unmount();

    render(<AVShippingSelector status="error" errorCode="ESHIP_ERROR" {...base} />);
    expect(screen.queryByText('AVShippingSelector.noticeTitle')).not.toBeInTheDocument();
  });

  it('shows a retry control on transient error', () => {
    render(<AVShippingSelector status="error" errorCode="ESHIP_ERROR" {...base} />);
    expect(screen.getByText('AVShippingSelector.retry')).toBeInTheDocument();
  });

  it('shows Contact AV for NO_ORIGIN/ESPECIAL', () => {
    render(<AVShippingSelector status="error" errorCode="NO_ORIGIN" {...base} />);
    expect(screen.getByText('AVShippingSelector.contactSeller')).toBeInTheDocument();
  });

  it('shows Contact AV when quoted but no buckets qualified', () => {
    render(
      <AVShippingSelector status="quoted" {...base} express={null} estandar={null} rawRates={[]} />
    );
    expect(screen.getByText('AVShippingSelector.contactSeller')).toBeInTheDocument();
  });
});
