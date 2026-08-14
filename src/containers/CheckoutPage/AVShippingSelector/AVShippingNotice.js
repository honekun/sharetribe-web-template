import React from 'react';

import css from './AVShippingNotice.module.css';

const hasContent = value => typeof value === 'string' && value.trim().length > 0;

/**
 * Static notice shown under the checkout shipping buckets.
 *
 * Renders nothing unless at least one of title/text carries content, so blanking the
 * backing microcopy keys removes the box without a code change.
 *
 * @param {Object} props
 * @param {string} [props.title] - bold first line
 * @param {string} [props.text] - body copy below the title
 */
const AVShippingNotice = props => {
  const { title, text } = props;
  const showTitle = hasContent(title);
  const showText = hasContent(text);

  if (!showTitle && !showText) {
    return null;
  }

  return (
    <div className={css.root}>
      {showTitle ? <p className={css.title}>{title}</p> : null}
      {showText ? <p className={css.text}>{text}</p> : null}
    </div>
  );
};

export default AVShippingNotice;
