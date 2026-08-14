import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the visitor has asked their OS to minimise non-essential motion.
 *
 * Use it to stop anything that moves on its own — auto-advancing carousels,
 * looping animations — rather than to hide content.
 *
 * Always `false` on the server and on the first client render, then corrected in
 * an effect: the server has no media queries, so reading the real value during
 * render would make the markup disagree with the SSR output and break hydration.
 * Nothing here animates within that first frame, so the correction is invisible.
 *
 * @returns {boolean} true when the visitor prefers reduced motion
 */
const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQueryList =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(REDUCED_MOTION_QUERY)
        : null;

    if (!mediaQueryList) {
      return undefined;
    }

    const update = () => setPrefersReducedMotion(!!mediaQueryList.matches);
    update();

    // Safari below 14 only has the deprecated addListener/removeListener pair.
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', update);
      return () => mediaQueryList.removeEventListener('change', update);
    } else if (mediaQueryList.addListener) {
      mediaQueryList.addListener(update);
      return () => mediaQueryList.removeListener(update);
    }
    return undefined;
  }, []);

  return prefersReducedMotion;
};

export default useReducedMotion;
