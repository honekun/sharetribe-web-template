'use strict';

// Keeps search engines on the one public copy of the marketplace.
//
// A response is marked noindex when the environment is flagged non-public
// (AV_NOINDEX=true: Render staging, or the Heroku app before cutover) or when the
// request arrives on a host other than REACT_APP_MARKETPLACE_ROOT_URL's — after
// cutover the *.herokuapp.com name still serves the same pages and would
// otherwise be indexed as a duplicate. robots.txt is answered with a blanket
// disallow in that case, ahead of the upstream route that would allow crawling.

const NOINDEX = 'noindex, nofollow';
const DISALLOW_ALL = 'User-agent: *\nDisallow: /\n';

const hostnameOf = url => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (e) {
    return null;
  }
};

const createIndexingGuard = ({ rootUrl, noindex = false, dev = false } = {}) => {
  const canonicalHost = hostnameOf(rootUrl);

  return (req, res, next) => {
    if (dev) {
      return next();
    }
    const host = (req.hostname || '').toLowerCase();
    const offCanonical = canonicalHost !== null && host !== canonicalHost;
    if (!noindex && !offCanonical) {
      return next();
    }

    res.setHeader('X-Robots-Tag', NOINDEX);
    if (req.path === '/robots.txt') {
      return res.type('text/plain').send(DISALLOW_ALL);
    }
    return next();
  };
};

module.exports = { createIndexingGuard };
