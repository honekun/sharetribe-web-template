import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';
import AVShippingLabelMaybe from './AVShippingLabelMaybe';

const { screen, userEvent } = testingLibrary;

const RATE = { bucket: 'nacionalExpress', rate_id: 'rate-1', carrier: 'Estafeta' };

describe('AVShippingLabelMaybe', () => {
  it('renders nothing when there is no shippable rate (especial / non-shipping)', () => {
    const { container } = render(<AVShippingLabelMaybe avShipping={null} avLabel={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a download link to the label PDF when the label is purchased', () => {
    render(
      <AVShippingLabelMaybe
        avShipping={RATE}
        avLabel={{ status: 'purchased', labelUrl: 'https://eship/labels/1.pdf' }}
      />
    );
    const link = screen.getByRole('link', { name: 'AVShippingLabel.download' });
    expect(link).toHaveAttribute('href', 'https://eship/labels/1.pdf');
  });

  it('renders a generate button when a rate exists but no label is purchased', async () => {
    const onGenerate = jest.fn();
    render(
      <AVShippingLabelMaybe
        avShipping={RATE}
        avLabel={{ status: 'failed', error: 'rate expired' }}
        onGenerate={onGenerate}
      />
    );
    const button = screen.getByRole('button', { name: 'AVShippingLabel.generate' });
    await userEvent.click(button);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows an error message when a generation attempt failed', () => {
    render(<AVShippingLabelMaybe avShipping={RATE} avLabel={null} error="LABEL_FAILED" />);
    expect(screen.getByText('AVShippingLabel.error')).toBeInTheDocument();
  });

  it('disables the button while generating', () => {
    render(<AVShippingLabelMaybe avShipping={RATE} avLabel={null} inProgress={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
