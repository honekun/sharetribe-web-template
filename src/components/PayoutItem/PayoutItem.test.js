import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { types as sdkTypes } from '../../util/sdkLoader';
import PayoutItem from './PayoutItem';

const { Money } = sdkTypes;

const { screen } = testingLibrary;

const messages = {
  'PayoutItem.gross': 'Gross',
  'PayoutItem.net': 'Net',
  'PayoutItem.statusCompleted': 'Completed',
  'PayoutItem.statusPending': 'Pending',
  'PayoutItem.statusCancelled': 'Cancelled',
};

const makeTx = (overrides = {}) => ({
  id: { uuid: 'tx-abc-123' },
  attributes: {
    lastTransition: 'transition/auto-complete',
    lastTransitionedAt: new Date('2024-03-15T10:00:00Z'),
    payinTotal: new Money(45000, 'MXN'),
    payoutTotal: new Money(40500, 'MXN'),
    processName: 'default-purchase',
    ...overrides,
  },
  listing: { attributes: { title: 'Vestido Vintage' } },
  customer: { attributes: { profile: { displayName: 'Ana García' } } },
});

describe('PayoutItem', () => {
  // Dates are pinned to UTC so the output does not depend on the machine's
  // timezone (the snapshot was once recorded in UTC-6 and failed on UTC CI).
  it('renders the transition date in the given timezone', () => {
    render(<PayoutItem timeZone="Etc/UTC" tx={makeTx()} />, { messages });
    expect(screen.getByText('Mar 15, 2024 10:00 AM')).toBeInTheDocument();
  });

  it('renders the same instant in another timezone', () => {
    render(<PayoutItem timeZone="America/Mexico_City" tx={makeTx()} />, { messages });
    expect(screen.getByText('Mar 15, 2024 4:00 AM')).toBeInTheDocument();
  });

  it('renders the listing title as a link', () => {
    render(<PayoutItem timeZone="Etc/UTC" tx={makeTx()} />, { messages });
    const link = screen.getByRole('link', { name: 'Vestido Vintage' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('tx-abc-123'));
  });

  it('renders the buyer display name', () => {
    render(<PayoutItem timeZone="Etc/UTC" tx={makeTx()} />, { messages });
    expect(screen.getByText('Ana García')).toBeInTheDocument();
  });

  it('renders gross and net amount labels', () => {
    render(<PayoutItem timeZone="Etc/UTC" tx={makeTx()} />, { messages });
    expect(screen.getByText('Gross')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
  });

  it('shows dashes when payinTotal is absent', () => {
    const tx = makeTx({ payinTotal: null });
    render(<PayoutItem timeZone="Etc/UTC" tx={tx} />, { messages });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Completed status badge for completed transition', () => {
    render(<PayoutItem timeZone="Etc/UTC" tx={makeTx()} />, { messages });
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders Pending status badge for in-progress transition', () => {
    render(
      <PayoutItem
        timeZone="Etc/UTC"
        tx={makeTx({ lastTransition: 'transition/confirm-payment' })}
      />,
      {
        messages,
      }
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders Cancelled status badge for cancelled transition', () => {
    render(<PayoutItem timeZone="Etc/UTC" tx={makeTx({ lastTransition: 'transition/cancel' })} />, {
      messages,
    });
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<PayoutItem timeZone="Etc/UTC" tx={makeTx()} />, { messages });
    expect(asFragment().firstChild).toMatchSnapshot();
  });
});
