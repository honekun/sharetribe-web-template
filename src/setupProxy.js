const { createProxyMiddleware } = require('http-proxy-middleware');

const devApiServerPort = process.env.REACT_APP_DEV_API_SERVER_PORT || '3500';
const target = `http://localhost:${devApiServerPort}`;

module.exports = app => {
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );

  app.use(
    '/.well-known',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );

  app.use(
    ['/site.webmanifest', '/robots.txt'],
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );

  app.use(
    /^\/sitemap-.*/,
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
