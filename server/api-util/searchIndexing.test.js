'use strict';

const { createIndexingGuard } = require('./searchIndexing');

const run = (guard, { hostname = 'www.archivovintach.com', path = '/' } = {}) => {
  const res = {
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    type(value) {
      this.headers['content-type'] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  const next = jest.fn();
  guard({ hostname, path, method: 'GET' }, res, next);
  return { res, next };
};

const ROOT = 'https://www.archivovintach.com';

describe('createIndexingGuard', () => {
  it('leaves the canonical host indexable', () => {
    const { res, next } = run(createIndexingGuard({ rootUrl: ROOT }));

    expect(next).toHaveBeenCalled();
    expect(res.headers['x-robots-tag']).toBeUndefined();
  });

  it('marks every response noindex when the environment is flagged non-public', () => {
    const { res, next } = run(createIndexingGuard({ rootUrl: ROOT, noindex: true }));

    expect(next).toHaveBeenCalled();
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('marks another host noindex, e.g. the herokuapp.com name after cutover', () => {
    const { res } = run(createIndexingGuard({ rootUrl: ROOT }), {
      hostname: 'archivo-vintach-marketplace-ee5adafa97a8.herokuapp.com',
    });

    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('compares host names case-insensitively and ignores the root URL port', () => {
    const guard = createIndexingGuard({ rootUrl: 'https://WWW.archivovintach.com:443' });
    const { res } = run(guard, { hostname: 'www.ArchivoVintach.com' });

    expect(res.headers['x-robots-tag']).toBeUndefined();
  });

  it('answers robots.txt with a blanket disallow instead of the crawlable file', () => {
    const { res, next } = run(createIndexingGuard({ rootUrl: ROOT, noindex: true }), {
      path: '/robots.txt',
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.headers['content-type']).toBe('text/plain');
    expect(res.body).toBe('User-agent: *\nDisallow: /\n');
  });

  it('serves the normal robots.txt on the canonical host', () => {
    const { next } = run(createIndexingGuard({ rootUrl: ROOT }), { path: '/robots.txt' });

    expect(next).toHaveBeenCalled();
  });

  it('does nothing in development', () => {
    const guard = createIndexingGuard({
      rootUrl: 'http://localhost:3000',
      noindex: true,
      dev: true,
    });
    const { res, next } = run(guard, { hostname: 'localhost', path: '/robots.txt' });

    expect(next).toHaveBeenCalled();
    expect(res.headers['x-robots-tag']).toBeUndefined();
  });

  it('skips the host check when no root URL is configured', () => {
    const { res } = run(createIndexingGuard({ rootUrl: undefined }), { hostname: 'anything.test' });

    expect(res.headers['x-robots-tag']).toBeUndefined();
  });
});
