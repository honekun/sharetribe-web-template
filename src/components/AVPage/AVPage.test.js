import React from 'react';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

import { ConfigurationProvider } from '../../context/configurationContext';
import { RouteConfigurationProvider } from '../../context/routeConfigurationContext';
import { mergeConfig } from '../../util/configHelpers';
import { IntlProvider } from '../../util/reactIntl';
import {
  getDefaultConfiguration,
  getHostedConfiguration,
  getRouteConfiguration,
  renderWithProviders as render,
  testingLibrary,
} from '../../util/testHelpers';

import AVPage from './AVPage';

const { waitFor } = testingLibrary;

const renderOnServer = (props = {}) => {
  const config = mergeConfig(getHostedConfiguration(), getDefaultConfiguration());
  const helmetContext = {};
  const wasUsingDOM = HelmetProvider.canUseDOM;
  HelmetProvider.canUseDOM = false;
  try {
    const body = renderToString(
      <HelmetProvider context={helmetContext}>
        <ConfigurationProvider value={config}>
          <RouteConfigurationProvider value={getRouteConfiguration()}>
            <IntlProvider locale="es" messages={{}}>
              <MemoryRouter>
                <AVPage title="Archivo Vintach" {...props}>
                  <p>Page content</p>
                </AVPage>
              </MemoryRouter>
            </IntlProvider>
          </RouteConfigurationProvider>
        </ConfigurationProvider>
      </HelmetProvider>
    );
    const head = document.createElement('div');
    head.innerHTML = helmetContext.helmet.link.toString() + helmetContext.helmet.meta.toString();
    return { body, head, helmet: helmetContext.helmet };
  } finally {
    HelmetProvider.canUseDOM = wasUsingDOM;
  }
};

const verifyIcons = head => {
  const icons = [...head.querySelectorAll('link[rel="icon"]')];
  expect(icons.map(icon => icon.getAttribute('href'))).toEqual([
    '/static/icons/favicon-16x16.png',
    '/static/icons/favicon-32x32.png',
    '/static/icons/favicon-48x48.png',
    '/static/icons/favicon-96x96.png',
    '/static/icons/favicon.ico',
    '/static/icons/favicon.svg',
  ]);
  expect(head.querySelector('link[type="image/svg+xml"]')).toHaveAttribute('sizes', 'any');
  expect(head.querySelectorAll('link[rel="apple-touch-icon"]')).toHaveLength(1);
  expect(head.querySelector('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/static/icons/apple-touch-icon.png'
  );
  expect(head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
  expect(head.querySelector('link[rel="manifest"]').getAttribute('href')).toMatch(
    /\/site\.webmanifest$/
  );
  expect(head.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#0f26e4');
};

describe('AVPage', () => {
  it('renders the approved icon links once in the server head', () => {
    const { body, head } = renderOnServer();
    verifyIcons(head);
    expect(body).toContain('Page content');
  });

  it('uses the same icon links after client rendering', async () => {
    render(<AVPage title="Archivo Vintach">Page content</AVPage>);
    await waitFor(() => verifyIcons(document.head));
  });

  it('preserves explicit page configuration and SEO without mutating hosted branding', () => {
    const config = mergeConfig(getHostedConfiguration(), getDefaultConfiguration());
    config.marketplaceRootURL = 'https://www.archivovintach.com';
    const originalBranding = { ...config.branding };
    const { head, helmet } = renderOnServer({ config, title: 'Custom page title' });
    verifyIcons(head);
    expect(head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.archivovintach.com/'
    );
    expect(helmet.title.toString()).toContain('Custom page title');
    expect(config.branding).toEqual(originalBranding);
  });

  it('preserves the upstream page body', () => {
    const { asFragment } = render(<AVPage title="Archivo Vintach">Page content</AVPage>);
    expect(asFragment()).toMatchSnapshot();
  });
});
