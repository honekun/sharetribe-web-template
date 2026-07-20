import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import NewsletterForm, { NEWSLETTER_CONSENT_VERSION } from './NewsletterForm';

const { screen, userEvent, fireEvent, waitFor } = testingLibrary;

const messages = {
  'NewsletterForm.emailPlaceholder': 'you@example.com',
  'NewsletterForm.successMessage': 'Subscribed!',
  'NewsletterForm.errorMessage': 'Subscribe failed.',
  'NewsletterForm.invalidEmail': 'Invalid email',
  'NewsletterForm.networkError': 'Network error',
};

const originalFetch = global.fetch;

describe('NewsletterForm', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders an email input + submit button', () => {
    render(<NewsletterForm />, { messages });
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows an inline validation error for an invalid email', async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />, { messages });
    await user.type(screen.getByPlaceholderText('you@example.com'), 'not-an-email');
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('Invalid email')).toBeInTheDocument();
  });

  it('posts to /api/brevo/subscribe and shows success on ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const user = userEvent.setup();
    render(<NewsletterForm okMsg="Yay" />, { messages });
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.co');
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/brevo/subscribe'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(await screen.findByText('Yay')).toBeInTheDocument();
  });

  it('sends an empty honeypot for a normal submission', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    const user = userEvent.setup();
    render(<NewsletterForm />, { messages });
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.co');
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    // Empty honeypot + consent-evidence fields for the server-side record (BR-03).
    expect(body).toEqual(
      expect.objectContaining({
        email: 'a@b.co',
        hp: '',
        source: 'footer_newsletter',
        policyVersion: NEWSLETTER_CONSENT_VERSION,
      })
    );
    expect(typeof body.locale).toBe('string');
  });

  it('captures a filled honeypot and forwards it to the server', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    const user = userEvent.setup();
    render(<NewsletterForm />, { messages });

    // A bot fills the hidden honeypot field (it's off-screen, so use a direct
    // change event). The bound value must now reach the request payload so the
    // server can reject it without calling Brevo.
    const honeypot = document.querySelector('input[name="hp"]');
    fireEvent.change(honeypot, { target: { value: 'i-am-a-bot' } });

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.co');
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.hp).toBe('i-am-a-bot');
  });

  it('shows an error message when the API returns ok: false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: false }),
    });
    const user = userEvent.setup();
    render(<NewsletterForm errorMsg="Nope" />, { messages });
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.co');
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('Nope')).toBeInTheDocument();
  });

  it('shows a network error when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<NewsletterForm />, { messages });
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.co');
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });

  it('renders the disclaimer text when provided', () => {
    render(<NewsletterForm disclaimerText="We never spam." />, { messages });
    expect(screen.getByText('We never spam.')).toBeInTheDocument();
  });
});
