'use strict';

// AV: unit tests never reach the network.
//
// `react-app-polyfill/jsdom` (the setup file before this one) installs a real
// `fetch` over jsdom's XMLHttpRequest, and jsdom's origin is http://localhost.
// A component that fetches on mount — the AV topbar menus load
// /static/data/top-bar.json and /api/topbar/local-design-users — therefore
// opened real connections to port 80. Where nothing listens (CI) they are
// refused at once; where something does (a local Docker proxy, a dev server)
// the sockets stay open, `--runInBand` Jest never exits, and the test depends on
// whatever answered.
//
// An unmocked request now fails the way a refused connection does
// (whatwg-fetch's TypeError), so every machine behaves like CI. A test that
// needs fetch still installs its own mock (`window.fetch = jest.fn()…`).
const unmockedFetch = input => {
  const url = typeof input === 'string' ? input : input?.url;
  return Promise.reject(
    new TypeError(
      `Network request failed: unit tests do not reach the network (${url}). Mock fetch in the test that needs it.`
    )
  );
};

if (typeof window !== 'undefined') {
  window.fetch = unmockedFetch;
}
