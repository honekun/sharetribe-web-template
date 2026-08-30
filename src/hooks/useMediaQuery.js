import { useEffect, useState } from 'react';

/**
 * AV: subscribe to a CSS media query from JS.
 *
 * Returns `false` during SSR and on the first client render, then the real
 * value once mounted. That is the same discipline the topbar already uses for
 * its auth-only links: the server has no viewport, so anything measured has to
 * arrive after hydration or the two renders disagree.
 *
 * Use this only for behaviour that CSS cannot express — deciding which of
 * several mounted components owns a piece of state, for instance. Anything
 * purely visual belongs in a media query in the stylesheet.
 *
 * @param {string} query a media query string, e.g. '(min-width: 1024px)'
 * @returns {boolean} whether the query currently matches
 */
const useMediaQuery = query => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const mql = window.matchMedia(query);
    const onChange = e => setMatches(e.matches);
    setMatches(mql.matches);

    // Safari below 14 only has the deprecated addListener/removeListener pair.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
};

export default useMediaQuery;
