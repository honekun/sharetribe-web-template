import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import AVShippingLabelSection from './AVShippingLabelSection';

const { screen, userEvent, waitFor } = testingLibrary;

const makeTx = ({ avShipping, avLabel } = {}) => ({
  id: { uuid: 'tx-1' },
  attributes: {
    protectedData: avShipping ? { avShipping } : {},
    metadata: avLabel ? { avLabel } : {},
    lastTransition: 'transition/confirm-payment',
    transitions: [{ transition: 'transition/confirm-payment' }],
  },
});

const RATE = { bucket: 'nacionalExpress', rate_id: 'rate-1', carrier: 'Estafeta' };

describe('AVShippingLabelSection', () => {
  afterEach(() => {
    if (window.fetch && window.fetch.mockRestore) window.fetch.mockRestore();
  });

  it('renders the persisted purchased label without any request', () => {
    render(
      <AVShippingLabelSection
        transaction={makeTx({
          avShipping: RATE,
          avLabel: { status: 'purchased', labelUrl: 'https://l/persisted.pdf' },
        })}
      />
    );
    expect(screen.getByRole('link', { name: 'AVShippingLabel.download' })).toHaveAttribute(
      'href',
      'https://l/persisted.pdf'
    );
  });

  it('posts to /api/shipping/label on click and swaps in the returned label on success', async () => {
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ avLabel: { status: 'purchased', labelUrl: 'https://l/new.pdf' } }),
    });

    render(
      <AVShippingLabelSection
        transaction={makeTx({ avShipping: RATE, avLabel: { status: 'failed', error: 'x' } })}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'AVShippingLabel.generate' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'AVShippingLabel.download' })).toBeInTheDocument()
    );
    const [url, opts] = window.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/shipping\/label$/);
    expect(JSON.parse(opts.body)).toEqual({ transactionId: 'tx-1' });
  });

  it('shows an error message when the request fails', async () => {
    window.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: 'LABEL_FAILED' }),
    });

    render(<AVShippingLabelSection transaction={makeTx({ avShipping: RATE, avLabel: null })} />);

    await userEvent.click(screen.getByRole('button', { name: 'AVShippingLabel.generate' }));

    await waitFor(() => expect(screen.getByText('AVShippingLabel.error')).toBeInTheDocument());
  });

  it('does not offer to buy a label before payment', () => {
    const transaction = makeTx({ avShipping: RATE });
    transaction.attributes.lastTransition = 'transition/request-payment';
    transaction.attributes.transitions = [{ transition: 'transition/request-payment' }];

    const { container } = render(<AVShippingLabelSection transaction={transaction} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not offer to buy a label after cancellation', () => {
    const transaction = makeTx({ avShipping: RATE });
    transaction.attributes.lastTransition = 'transition/cancel';
    transaction.attributes.transitions.push({ transition: 'transition/cancel' });

    const { container } = render(<AVShippingLabelSection transaction={transaction} />);

    expect(container).toBeEmptyDOMElement();
  });
});
