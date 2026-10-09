'use strict';

// SERVER_SHARETRIBE_TRUST_PROXY arrives as a string, and Express reads any
// string as a list of proxy addresses. A hop count therefore has to become a
// number first: "1" is the right setting behind the Heroku router, which
// appends the real client address to whatever X-Forwarded-For the client sent.
// As a string it trusts nothing and req.ip becomes the router itself; `true`
// trusts everything and req.ip becomes the client's own, spoofable, value.
const toTrustProxySetting = value => {
  const trimmed = String(value).trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : value;
};

module.exports = { toTrustProxySetting };
