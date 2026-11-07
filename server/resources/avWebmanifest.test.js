'use strict';

const fs = require('fs');
const path = require('path');
const handler = require('./avWebmanifest');

const getManifest = () => {
  const res = { setHeader: jest.fn(), send: jest.fn() };
  handler({}, res);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/manifest+json');
  return JSON.parse(res.send.mock.calls[0][0]);
};

describe('AV web app manifest', () => {
  const originalRootURL = process.env.REACT_APP_MARKETPLACE_ROOT_URL;

  afterEach(() => {
    if (originalRootURL === undefined) delete process.env.REACT_APP_MARKETPLACE_ROOT_URL;
    else process.env.REACT_APP_MARKETPLACE_ROOT_URL = originalRootURL;
  });

  it.each(['https://www.archivovintach.com', 'http://localhost:3000/'])(
    'resolves the application and icons against the frontend root: %s',
    rootURL => {
      process.env.REACT_APP_MARKETPLACE_ROOT_URL = rootURL;
      const root = rootURL.replace(/\/$/, '');
      expect(getManifest()).toEqual({
        name: 'Archivo Vintach',
        short_name: 'Archivo Vintach',
        theme_color: '#0f26e4',
        background_color: '#0f26e4',
        display: 'standalone',
        start_url: `${root}/`,
        scope: `${root}/`,
        icons: [192, 512].map(size => ({
          src: `${root}/static/icons/android-chrome-${size}x${size}.png`,
          sizes: `${size}x${size}`,
          type: 'image/png',
        })),
      });
    }
  );

  it('keeps the application at the site root when no origin is configured', () => {
    delete process.env.REACT_APP_MARKETPLACE_ROOT_URL;
    const manifest = getManifest();
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons[0].src).toBe('/static/icons/android-chrome-192x192.png');
  });

  it('references shipped PNG images with the declared dimensions', () => {
    delete process.env.REACT_APP_MARKETPLACE_ROOT_URL;
    for (const icon of getManifest().icons) {
      const file = fs.readFileSync(path.join(__dirname, '../../public', icon.src));
      const size = `${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`;
      expect(size).toBe(icon.sizes);
      expect(file.subarray(1, 4).toString()).toBe('PNG');
    }
  });
});
