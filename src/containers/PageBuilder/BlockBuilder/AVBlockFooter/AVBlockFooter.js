import React from 'react';
import classNames from 'classnames';

import { useIntl } from '../../../../util/reactIntl';
import {
  buildAvBlockProps,
  resolveAvBlockComponent,
} from '../../../../extensions/pageBuilder/av/blocks';

import Field, { hasDataInFields } from '../../Field';
import BlockContainer from '../BlockContainer';
import BlockBuilder from '../../BlockBuilder';
import sectionCss from '../../SectionBuilder/SectionBuilder.module.css';
import NewsletterForm from '../../../../components/NewsletterForm/NewsletterForm';

import css from './AVBlockFooter.module.css';

/**
 * @typedef {Object} FieldComponentConfig
 * @property {ReactNode} component
 * @property {Function} pickValidProps
 */

/**
 * Renders a 'footerBlock' config.
 *
 * AV fork of upstream `BlockFooter` (forked at a252774a — see the fork note in
 * CLAUDE.md), adding the `social links ::` and `newsletter form ::` block-name
 * tokens. The token props themselves are computed by `AVBlockDefault`'s shared
 * helper and arrive here as props.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.blockId id from the block config
 * @param {string} props.blockName name from the block config (not used)
 * @param {'footerBlock'} props.blockType blockType is set to 'footerBlock'
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {string?} props.className add more styles in addition to components own css.root
 * @param {string?} props.textClassName add styles for the block's attached text field
 * @param {Object?} props.text content config for the block (can be markdown)
 * @param {Object} props.options extra options for the block component (e.g. custom fieldComponents)
 * @param {Object<string,FieldComponentConfig>?} props.options.fieldComponents Custom fieldComponents
 * @returns {JSX.Element} component that renders block type: 'footerBlock'
 */
const AVBlockFooter = props => {
  const intl = useIntl();
  // The `blockName` tokens used to be parsed in BlockBuilder and spread in as
  // props. They are parsed here now so upstream's BlockBuilder stays pristine.
  const avProps = buildAvBlockProps(props, intl, sectionCss, props.ctaButtonClass);

  // A footer block can still carry an AV blockId shorthand (e.g. `av-table-*`).
  const AVBlock = resolveAvBlockComponent(props);
  if (AVBlock) {
    return <AVBlock {...props} {...avProps} />;
  }

  const { blockId, className, rootClassName, textClassName, text, options, customProps } = props;
  const { hasSocialLinks, hasNewsletterForm, disclaimerText, okMsg, errorMsg } = avProps;
  const classes = classNames(rootClassName || css.root, className);
  const hasTextComponentFields = hasDataInFields([text], options);

  return (
    <BlockContainer id={blockId} className={classes}>
      {hasTextComponentFields ? (
        <nav
          className={classNames(textClassName, css.text)}
          aria-label={blockId || 'Footer navigation'}
        >
          <Field data={text} options={options} />
        </nav>
      ) : null}

      {hasNewsletterForm ? (
        <div className={classNames(css.newsletter)}>
          <NewsletterForm disclaimerText={disclaimerText} okMsg={okMsg} errorMsg={errorMsg} />
        </div>
      ) : null}

      {hasSocialLinks && customProps?.socialLinks ? (
        <div className={css.blockSocial}>
          <BlockBuilder
            blocks={customProps.socialLinks}
            sectionId={blockId + '-social'}
            options={options}
          />
        </div>
      ) : null}
    </BlockContainer>
  );
};

export default AVBlockFooter;
