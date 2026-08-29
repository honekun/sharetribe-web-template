import React from 'react';
import '@testing-library/jest-dom';

// CustomLinksMenu fetches /static/data/top-bar.json in a useEffect (via fetchLocalTopbarData).
// Mock the whole component to prevent it from consuming global.fetch responses meant for tests.
jest.mock('../TopbarContainer/Topbar/TopbarDesktop/AVLinksMenu/AVCustomLinksMenu', () => () =>
  null
);

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import BulkImportPage from './BulkImportPage';

const { screen, waitFor, fireEvent, act } = testingLibrary;

const baseState = {
  marketplaceData: { entities: {} },
  user: {
    currentUser: null,
    currentUserHasListings: false,
    sendVerificationEmailInProgress: false,
  },
};

const originalFetch = global.fetch;
const originalCreateObjectURL = window.URL.createObjectURL;
const originalRevokeObjectURL = window.URL.revokeObjectURL;
const originalCreateElement = document.createElement.bind(document);

describe('BulkImportPage', () => {
  beforeEach(() => {
    // Default mock returns a resolved promise so the Topbar's fetchLocalTopbarData
    // (fired in a useEffect) doesn't crash. Tests that need specific responses
    // use mockResolvedValueOnce to override on a call-by-call basis.
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => null });
    window.localStorage.clear();
    window.URL.createObjectURL = jest.fn(() => 'blob:test-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    document.createElement = originalCreateElement;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('renders page heading', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.heading')).toBeInTheDocument();
    });
  });

  it('renders description text', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.description')).toBeInTheDocument();
    });
  });

  it('does not render or persist an import API key', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.startImport')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('BulkImportPage.apiKeyLabel')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('bulkImportApiKey')).toBeNull();
  });

  it('renders ZIP file input', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      const input = screen.getByLabelText('BulkImportPage.zipLabel');
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('file');
      expect(input.accept).toBe('.zip');
    });
  });

  it('renders ZIP helper text', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.zipHelp')).toBeInTheDocument();
    });
  });

  it('renders start import button', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.startImport')).toBeInTheDocument();
    });
  });

  const TEMPLATE_URL = '/api/bulk-import/template';

  it('renders the template link', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      const link = screen.getByText('BulkImportPage.downloadTemplate');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', TEMPLATE_URL);
    });
  });

  it('downloads the same-origin template without navigating away from an import', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    const link = (await screen.findByText('BulkImportPage.downloadTemplate')).closest('a');

    // The route is same-origin and sends Content-Disposition: attachment. The
    // attribute makes the intended browser behaviour explicit as well.
    expect(link).toHaveAttribute('download');
    expect(link).not.toHaveAttribute('target');
  });

  it('shows error when submitting without a ZIP file', async () => {
    render(<BulkImportPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.startImport')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.errorNoZip')).toBeInTheDocument();
    });
  });

  it('shows validation error returned from start endpoint', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, token: 'action-token' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error:
            'Falta información para completar en tu archivo CSV. Completa la información en la plantilla y vuelve a exportar.',
          details: ['Fila 1: "image_back" es obligatorio.'],
        }),
      });

    render(<BulkImportPage />, { initialState: baseState });

    const zipInput = await screen.findByLabelText('BulkImportPage.zipLabel');
    const zipFile = new File(['fake zip content'], 'listings.zip', { type: 'application/zip' });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });

    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(
        screen.getByText(/Falta información para completar en tu archivo CSV\./)
      ).toBeInTheDocument();
      expect(screen.getByText(/image_back/)).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bulk-import/authorize',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bulk-import/start',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Bulk-Import-Token': 'action-token' },
      })
    );
  });

  it('polls status until completion after a successful submit', async () => {
    jest.useFakeTimers();

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, token: 'action-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-123', total: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'job-123',
          status: 'processing',
          total: 2,
          processed: 1,
          succeeded: 1,
          failed: 0,
          errors: [],
          results: [{ row: 1, title: 'First listing', status: 'published' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'job-123',
          status: 'completed',
          total: 2,
          processed: 2,
          succeeded: 2,
          failed: 0,
          errors: [],
          results: [
            { row: 1, title: 'First listing', status: 'published' },
            { row: 2, title: 'Second listing', status: 'published' },
          ],
        }),
      });

    render(<BulkImportPage />, { initialState: baseState });

    const zipInput = await screen.findByLabelText('BulkImportPage.zipLabel');
    const zipFile = new File(['fake zip content'], 'listings.zip', { type: 'application/zip' });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });

    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.processing')).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.completed')).toBeInTheDocument();
      expect(screen.getByText('BulkImportPage.newImport')).toBeInTheDocument();
    });
    // The created-listings table is never rendered; a clean import shows the
    // "view your listings" link instead.
    expect(screen.queryByText('Second listing')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BulkImportPage.viewListings' })).toHaveAttribute(
      'href',
      '/listings'
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bulk-import/start',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Bulk-Import-Token': 'action-token' },
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bulk-import/status/job-123',
      expect.objectContaining({
        credentials: 'include',
        headers: { 'X-Bulk-Import-Token': 'action-token' },
      })
    );
  });

  it('stops polling and shows an error when the job is no longer found (404)', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, token: 'action-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-404', total: 1 }),
      })
      // Every status poll returns 404 (job expired / server restarted).
      .mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'not found' }) });

    render(<BulkImportPage />, { initialState: baseState });

    const zipInput = await screen.findByLabelText('BulkImportPage.zipLabel');
    const zipFile = new File(['fake zip content'], 'listings.zip', { type: 'application/zip' });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });

    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.errorJobUnavailable')).toBeInTheDocument();
    });

    // A 404 stops polling immediately: only the first (immediate) status call runs.
    const statusCalls = global.fetch.mock.calls.filter(c => String(c[0]).includes('/status/'));
    expect(statusCalls.length).toBe(1);
  });

  it('stops polling after repeated status failures instead of spinning forever', async () => {
    jest.useFakeTimers();

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, token: 'action-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-err', total: 1 }),
      })
      // Non-404 failures (e.g. transient 500) keep failing on every poll.
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    render(<BulkImportPage />, { initialState: baseState });

    const zipInput = await screen.findByLabelText('BulkImportPage.zipLabel');
    const zipFile = new File(['fake zip content'], 'listings.zip', { type: 'application/zip' });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });

    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.processing')).toBeInTheDocument();
    });

    // Advance through several poll intervals; polling must give up (not loop forever).
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
    }

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.errorStatusUnavailable')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('shows only the error rows (no listings link) when some rows fail', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, token: 'action-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-123', total: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'job-123',
          status: 'completed',
          total: 2,
          processed: 2,
          succeeded: 1,
          failed: 1,
          errors: [
            {
              row: 2,
              title: 'Broken listing',
              error: 'Request failed with status code 400',
              status: 400,
            },
          ],
          results: [{ row: 1, title: 'Good listing', status: 'published' }],
        }),
      });

    render(<BulkImportPage />, { initialState: baseState });

    const zipInput = await screen.findByLabelText('BulkImportPage.zipLabel');
    const zipFile = new File(['fake zip content'], 'listings.zip', { type: 'application/zip' });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });

    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.completed')).toBeInTheDocument();
    });

    // Errors table lists the failed row only; the succeeded row is not shown.
    expect(screen.getByText('BulkImportPage.errorsTitle')).toBeInTheDocument();
    expect(screen.getByText('Broken listing')).toBeInTheDocument();
    // The row error is shown via its translated (status-mapped) message, not the
    // raw English SDK string.
    expect(screen.getByText('BulkImportPage.rowError.http400')).toBeInTheDocument();
    expect(screen.queryByText('Request failed with status code 400')).not.toBeInTheDocument();
    expect(screen.queryByText('Good listing')).not.toBeInTheDocument();
    // No "view your listings" link when there were failures.
    expect(
      screen.queryByRole('link', { name: 'BulkImportPage.viewListings' })
    ).not.toBeInTheDocument();
  });

  it('renders row errors translated by code/status, with a raw code hint', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, token: 'action-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-err', total: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'job-err',
          status: 'completed',
          total: 3,
          processed: 3,
          succeeded: 0,
          failed: 3,
          errors: [
            {
              row: 1,
              title: 'Bad image',
              error: 'Request failed with status code 400',
              status: 400,
              sdkErrors: [
                {
                  status: 400,
                  code: 'image-invalid-content',
                  title: 'Invalid or unrecognized image file.',
                  source: { path: ['images'] },
                },
              ],
            },
            // No structured code — falls back to the HTTP-status message + hint.
            {
              row: 2,
              title: 'Server hiccup',
              error: 'Request failed with status code 500',
              status: 500,
            },
            // Worker-thrown synthetic code: the bundled placeholder image could
            // not be loaded for an image-less row.
            {
              row: 3,
              title: 'Sin fotos',
              error: 'No se encontró la imagen de reemplazo',
              code: 'placeholder-missing',
            },
          ],
          results: [],
        }),
      });

    render(<BulkImportPage />, { initialState: baseState });

    const zipInput = await screen.findByLabelText('BulkImportPage.zipLabel');
    const zipFile = new File(['fake zip content'], 'listings.zip', { type: 'application/zip' });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });
    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.completed')).toBeInTheDocument();
    });

    // Code-mapped translated message (react-intl renders the key id in tests), and
    // the raw English SDK/axios string is no longer shown.
    expect(screen.getByText('BulkImportPage.rowError.imageInvalidContent')).toBeInTheDocument();
    expect(screen.queryByText('Request failed with status code 400')).not.toBeInTheDocument();
    // Raw code hint (with offending field) is retained for support.
    expect(screen.getByText('image-invalid-content (images)')).toBeInTheDocument();

    // Row without a structured code falls back to the HTTP-status message + hint.
    expect(screen.getByText('BulkImportPage.rowError.http500')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();

    // Placeholder-asset failure maps to its own message rather than the generic one.
    expect(screen.getByText('BulkImportPage.rowError.placeholderUnavailable')).toBeInTheDocument();
  });

  it('resets the form after a completed import', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, token: 'action-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-123', total: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'job-123',
          status: 'completed',
          total: 1,
          processed: 1,
          succeeded: 1,
          failed: 0,
          errors: [],
          results: [{ row: 1, title: 'Imported listing', status: 'published' }],
        }),
      });

    render(<BulkImportPage />, { initialState: baseState });

    const zipInput = await screen.findByLabelText('BulkImportPage.zipLabel');
    const zipFile = new File(['fake zip content'], 'listings.zip', { type: 'application/zip' });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });

    fireEvent.click(screen.getByText('BulkImportPage.startImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.newImport')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('BulkImportPage.newImport'));

    await waitFor(() => {
      expect(screen.getByText('BulkImportPage.startImport')).toBeInTheDocument();
      expect(screen.queryByText('Imported listing')).not.toBeInTheDocument();
    });
  });
});
