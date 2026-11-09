import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import AVShippingLabelSection from './AVShippingLabelSection';

const { screen, userEvent, waitFor } = testingLibrary;

const shippingFee = {
  code: 'line-item/shipping-fee',
  includeFor: ['customer'],
  reversal: false,
  lineTotal: { amount: 11800, currency: 'MXN' },
};
const itemLine = { code: 'line-item/item', includeFor: ['customer', 'provider'], reversal: false };

const makeTx = ({ avShipping, avLabel, metadataShipping, lineItems } = {}) => ({
  id: { uuid: 'tx-1' },
  attributes: {
    lineItems: lineItems || [itemLine, shippingFee],
    protectedData: avShipping ? { avShipping } : {},
    metadata: {
      ...(avLabel ? { avLabel } : {}),
      ...(metadataShipping ? { avShipping: metadataShipping } : {}),
    },
    lastTransition: 'transition/confirm-payment',
    transitions: [{ transition: 'transition/confirm-payment' }],
  },
});

const RATE = {
  bucket: 'nacionalExpress',
  rate_id: 'rate-1',
  carrier: 'Estafeta',
  amountSubunits: 11800,
  currency: 'MXN',
};

const withDispute = transaction => {
  transaction.attributes.transitions.push({ transition: 'transition/dispute' });
  transaction.attributes.lastTransition = 'transition/dispute';
  return transaction;
};

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

  it('hides the control when the buyer was not charged for shipping', () => {
    const { container } = render(
      <AVShippingLabelSection transaction={makeTx({ avShipping: RATE, lineItems: [itemLine] })} />
    );
    expect(screen.queryByRole('button', { name: 'AVShippingLabel.generate' })).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the control when the charge does not match the recorded rate', () => {
    const { container } = render(
      <AVShippingLabelSection
        transaction={makeTx({ metadataShipping: { ...RATE, amountSubunits: 100 } })}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the control for a legacy record a dispute could have rewritten', () => {
    // The server refuses this label (SHIPPING_RECORD_UNTRUSTED), so it is not offered.
    const { container } = render(
      <AVShippingLabelSection transaction={withDispute(makeTx({ avShipping: RATE }))} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('still offers the control for a metadata record after a dispute', () => {
    render(
      <AVShippingLabelSection transaction={withDispute(makeTx({ metadataShipping: RATE }))} />
    );
    expect(screen.getByRole('button', { name: 'AVShippingLabel.generate' })).toBeInTheDocument();
  });

  it('offers the label control from the server-written metadata record', () => {
    render(<AVShippingLabelSection transaction={makeTx({ metadataShipping: RATE })} />);
    expect(screen.getByRole('button', { name: 'AVShippingLabel.generate' })).toBeInTheDocument();
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

  it('tells the seller to contact AV when the server refuses the label', async () => {
    window.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: 'LABEL_NOT_ALLOWED', reason: 'SHIPPING_CHARGE_MISMATCH' }),
    });

    render(<AVShippingLabelSection transaction={makeTx({ avShipping: RATE, avLabel: null })} />);

    await userEvent.click(screen.getByRole('button', { name: 'AVShippingLabel.generate' }));

    await waitFor(() => expect(screen.getByText('AVShippingLabel.notAllowed')).toBeInTheDocument());
    expect(screen.queryByText('AVShippingLabel.error')).toBeNull();
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
