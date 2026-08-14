import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { useIntl } from '../../../../util/reactIntl';
import useReducedMotion from '../../../../hooks/useReducedMotion';

import css from './AVPhotoSlider.module.css';

const SLIDE_INTERVAL_MS = 7000;

const isUsableSrc = src => typeof src === 'string' && src.trim() !== '';

const PauseIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" focusable="false" aria-hidden="true">
    <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" />
    <rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" focusable="false" aria-hidden="true">
    <path d="M4 2.5v11l9-5.5-9-5.5z" fill="currentColor" />
  </svg>
);

/**
 * The configured slide URLs, with the unset ones removed.
 *
 * Slides come from the `PhotoSlider.<blockId>.image_N` microcopy keys, which
 * resolve to an empty string when the operator has not filled them in, so an
 * "empty" slider still arrives here as an array of blank strings.
 *
 * @param {Array<string>} images
 * @returns {Array<string>} the usable slide URLs
 */
export const usableSlides = images =>
  Array.isArray(images) ? images.filter(isUsableSrc).map(src => src.trim()) : [];

/**
 * A cross-fading image slider for `photoSlider ::` blocks.
 *
 * Renders nothing when no slide is configured, so a block can fall back to its
 * normal media field.
 *
 * The slides advance on their own indefinitely, so a multi-slide slider offers a
 * pause control (WCAG 2.2.2 Pause, Stop, Hide: content that auto-updates for
 * more than five seconds needs a way to stop it) and starts paused for visitors
 * who prefer reduced motion. Pressing play still overrides that preference —
 * it's their control to use.
 *
 * @component
 * @param {Object} props
 * @param {Array<string>} props.images - slide URLs (blank entries are ignored)
 * @param {string} [props.className] - added to the wrapper element
 * @param {string} [props.alt] - alt text; slides are decorative by default
 * @param {number} [props.intervalMs] - time each slide is shown
 * @returns {JSX.Element|null}
 */
const AVPhotoSlider = props => {
  const { images, className, alt = '', intervalMs = SLIDE_INTERVAL_MS } = props;
  const intl = useIntl();
  const prefersReducedMotion = useReducedMotion();

  const slides = usableSlides(images);
  const slideCount = slides.length;

  // `null` means "nobody has pressed the button yet", so the reduced-motion
  // preference decides. A press pins it either way from then on.
  const [playOverride, setPlayOverride] = useState(null);
  const isPlaying = playOverride === null ? !prefersReducedMotion : playOverride;

  // `maxSeen` is the furthest slide reached so far. It is tracked inside the
  // updater rather than in an effect so that no intermediate index can be
  // missed when several ticks are applied together (a background tab can fire
  // timers in a batch).
  const [{ index, maxSeen }, setSlide] = useState({ index: 0, maxSeen: 0 });

  useEffect(() => {
    // A single slide has nothing to advance to, and a paused one stays put.
    if (slideCount < 2 || !isPlaying) {
      return undefined;
    }
    const interval = setInterval(() => {
      setSlide(prev => {
        const next = (prev.index + 1) % slideCount;
        return { index: next, maxSeen: Math.max(prev.maxSeen, next) };
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [slideCount, intervalMs, isPlaying]);

  if (slideCount === 0) {
    return null;
  }

  // The slide list is microcopy-driven and can shrink between renders, so never
  // read past the end of it.
  const activeIndex = index % slideCount;

  return (
    <div className={classNames(css.sliderWrapper, className)}>
      {slides.map((src, i) => {
        // Every slide sits in the same box, so all of them count as "in the
        // viewport" and a browser would fetch the whole set up front. Mount each
        // one only when it is first shown instead. Slides stay mounted after
        // that, so the wrap back to the first one still has something to fade.
        if (i > maxSeen) {
          return null;
        }
        const isActive = i === activeIndex;
        return (
          <img
            key={`${i}-${src}`}
            src={src}
            alt={alt}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            aria-hidden={!isActive}
            className={classNames(css.sliderImage, { [css.visible]: isActive })}
          />
        );
      })}

      {slideCount > 1 ? (
        <button
          type="button"
          className={css.playToggle}
          onClick={() => setPlayOverride(!isPlaying)}
          aria-label={intl.formatMessage({
            id: isPlaying ? 'AVPhotoSlider.pause' : 'AVPhotoSlider.play',
          })}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      ) : null}
    </div>
  );
};

export default AVPhotoSlider;
