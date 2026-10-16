import React from 'react';

import { useIntl } from '../../../../util/reactIntl';

import { getSibformsFormUrl } from './sibformsEmbed';
import css from './BlockBrevoForm.module.css';

// The form runs in its own cross-origin frame. allow-scripts + allow-same-origin
// let Sibforms validate and submit within its own origin (sibforms.com), which
// cannot reach this page: the frame is cross-origin either way. Popups (the
// privacy-policy link) open unsandboxed; top-level navigation is not allowed.
const SANDBOX = [
  'allow-forms',
  'allow-scripts',
  'allow-same-origin',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
].join(' ');

/**
 * Brevo (Sibforms) contact form, reached with the `av-contact-form` block id.
 *
 * Renders only a sandboxed iframe whose URL is taken from the block text and
 * checked by getSibformsFormUrl. Inline Brevo embeds (scripts + markup) are not
 * supported: they would run hosted script on this origin, and the CSP blocks
 * them anyway. Sibforms sends no resize messages, so the height is set in CSS.
 */
const BlockBrevoForm = ({ blockId, text }) => {
  const intl = useIntl();
  const raw = text?.content || (typeof text === 'string' ? text : '');
  const src = getSibformsFormUrl(raw);

  if (!src) {
    if (raw && process.env.NODE_ENV !== 'production') {
      console.warn(
        `BlockBrevoForm "${blockId}": expected Brevo's iframe embed code or an https://*.sibforms.com/serve/… URL; nothing rendered.`
      );
    }
    return null;
  }

  return (
    <div id={blockId} className={css.root}>
      <iframe
        className={css.frame}
        src={src}
        title={intl.formatMessage({ id: 'BlockBrevoForm.title' })}
        sandbox={SANDBOX}
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
};

export default BlockBrevoForm;
