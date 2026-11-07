'use strict';

const fs = require('fs');
const path = require('path');

// Read the shipped manifest once, rather than making Marketplace/Asset API
// requests for icon data which is owned by this deployment.
const manifest = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../public/static/icons/site.webmanifest'), 'utf8')
);

module.exports = (req, res) => {
  const rootUrl = (process.env.REACT_APP_MARKETPLACE_ROOT_URL || '').replace(/\/$/, '');
  const absoluteUrl = resourcePath => `${rootUrl}${resourcePath}`;

  // In yarn dev the manifest is served by the API server on :3500, while the
  // icons and app live on :3000. Resolve these URLs against the frontend root.
  const data = {
    ...manifest,
    start_url: absoluteUrl('/'),
    scope: absoluteUrl('/'),
    icons: manifest.icons.map(icon => ({ ...icon, src: absoluteUrl(icon.src) })),
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.send(JSON.stringify(data, null, 2));
};
