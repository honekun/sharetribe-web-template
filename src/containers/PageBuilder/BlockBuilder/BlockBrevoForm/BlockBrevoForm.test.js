import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render } from '../../../../util/testHelpers';
import BlockBrevoForm from './BlockBrevoForm';

const FORM_URL = 'https://0aed740b.sibforms.com/serve/MUIFAPHTGoxblxygKiPZd==';
const EMBED = `<iframe src="${FORM_URL}" frameborder="0" scrolling="auto" allowfullscreen style="display: block;max-width: 100%;"></iframe>`;

describe('BlockBrevoForm', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => console.warn.mockRestore());

  it('renders nothing when no text content is provided', () => {
    const { container } = render(<BlockBrevoForm blockId="brevo-1" />);
    expect(container.firstChild).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('renders a sandboxed iframe for Brevo embed code', () => {
    const { container } = render(<BlockBrevoForm blockId="brevo-2" text={{ content: EMBED }} />);
    expect(container.querySelector('#brevo-2')).toBeInTheDocument();

    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    const iframe = iframes[0];
    expect(iframe).toHaveAttribute('src', FORM_URL);
    expect(iframe).toHaveAttribute('title', 'BlockBrevoForm.title');
    expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    const sandbox = iframe.getAttribute('sandbox').split(' ');
    expect(sandbox).toEqual(
      expect.arrayContaining(['allow-forms', 'allow-scripts', 'allow-same-origin'])
    );
    expect(sandbox).not.toContain('allow-top-navigation');
    // The pasted embed's own attributes (inline style, allowfullscreen) are dropped.
    expect(iframe).not.toHaveAttribute('style');
    expect(iframe).not.toHaveAttribute('allowfullscreen');
  });

  it('accepts a plain string text prop holding the form URL', () => {
    const { container } = render(<BlockBrevoForm blockId="brevo-3" text={FORM_URL} />);
    expect(container.querySelector('iframe')).toHaveAttribute('src', FORM_URL);
  });

  it('never renders hosted markup or scripts', () => {
    const text = {
      content:
        '<form data-testid="brevo">hi</form><img src=x onerror="window.__pwned=1">' +
        '<script>window.__pwned=1</script>',
    };
    const { container } = render(<BlockBrevoForm blockId="brevo-4" text={text} />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector('form, img, script')).toBeNull();
    expect(document.head.querySelector('script:not([src])')).toBeNull();
    expect(window.__pwned).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('brevo-4'));
  });

  it('refuses an iframe pointing anywhere but Sibforms', () => {
    const text = { content: '<iframe src="https://evil.example/serve/x"></iframe>' };
    const { container } = render(<BlockBrevoForm blockId="brevo-5" text={text} />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<BlockBrevoForm blockId="brevo-6" text={{ content: EMBED }} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
