import React from 'react';
import classNames from 'classnames';

import Field, { hasDataInFields } from '../../Field';
import BlockContainer from '../BlockContainer';

import css from './AVBlockDefault.module.css';

const FieldMedia = props => {
  const { className, media, sizes, options } = props;
  const hasMediaField = hasDataInFields([media], options);
  return hasMediaField ? (
    <div className={classNames(className, css.media)}>
      <Field data={media} sizes={sizes} options={options} />
    </div>
  ) : null;
};

/**
 * @typedef {Object} FieldComponentConfig
 * @property {ReactNode} component
 * @property {Function} pickValidProps
 */

/**
 * Renders a 'defaultBlock' config.
 *
 * AV fork of upstream `BlockDefault` (forked at a252774a — see the fork note in
 * CLAUDE.md). This is the *view*: it is purely prop-driven and does no token
 * parsing. `AVBlockDefault` is the dispatcher that computes those props; render
 * this directly (as AVPhotoSliderBlock does) to avoid dispatching twice.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.blockId id from the block config
 * @param {string} props.blockName name from the block config (not used)
 * @param {'defaultBlock'} props.blockType blockType is set to 'defaultBlock'
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {string?} props.className add more styles in addition to components own css.root
 * @param {string?} props.mediaClassName add styles for the block's attached media field
 * @param {string?} props.textClassName add styles for the block's attached text field
 * @param {string?} props.ctaButtonClass add styles for the block's attached CTA field
 * @param {Object?} props.title heading config for the block
 * @param {Object?} props.text content config for the block (can be markdown)
 * @param {Object?} props.callToAction call to action button (e.g. internal link config)
 * @param {ReactNode?} props.mediaSlot element rendered in place of the media field
 * @param {string?} props.responsiveImageSizes
 * @param {Object} props.options extra options for the block component (e.g. custom fieldComponents)
 * @param {Object<string,FieldComponentConfig>?} props.options.fieldComponents Custom fieldComponents
 * @returns {JSX.Element} component that renders block type: 'defaultBlock'
 */
const AVBlockDefaultView = props => {
  const {
    blockId,
    className,
    rootClassName,
    mediaClassName,
    textClassName,
    ctaButtonClass,
    title,
    text,
    callToAction,
    media,
    responsiveImageSizes,
    options = {},
    alignment,
    twoButtons,
    hasIconImg,
    hasSmallerTitles,
    hasMediaTitle,
    hasBlueTitle,
    hasFullLinks,
    hasImgTop,
    mediaSlot,
    ctaButtonWrapClass,
    ...customProps
  } = props;
  const classes = classNames(rootClassName || css.root, className);
  const hasTextComponentFields = hasDataInFields([title, text, callToAction], options);

  const alignmentClasses = {
    left: css.alignLeft,
    center: css.alignCenter,
    right: css.alignRight,
  };

  const alignmentClass = alignmentClasses[alignment];

  const textComponentsClass = classNames(
    textClassName,
    alignmentClass,
    css.text,
    hasIconImg ? css.slimContent : '',
    hasSmallerTitles ? css.smallerTitles : '',
    hasFullLinks ? css.fullLinks : ''
  );

  const fieldMediaClass = classNames(
    mediaClassName,
    hasIconImg ? css.iconImg : '',
    hasImgTop ? css.imgTop : ''
  );

  // The block media. When `hasMediaTitle` is set it is rendered between the
  // title and the rest of the content (see below); otherwise it stays above
  // the text column as usual.
  // A block variant may pass its own media element as `mediaSlot` (AV's
  // photoSlider block does) — it then stands in for the media field.
  const renderMedia = extraClassName =>
    mediaSlot ? (
      React.cloneElement(mediaSlot, {
        className: classNames(mediaSlot.props.className, extraClassName),
      })
    ) : (
      <FieldMedia
        media={media}
        sizes={responsiveImageSizes}
        className={classNames(fieldMediaClass, extraClassName)}
        options={options}
      />
    );

  // Place the media inside the text column (after the title) only when the
  // token is set AND there are text fields to anchor it under. Otherwise keep
  // it at the top so a media-only block still renders.
  const mediaInTitle = hasMediaTitle && hasTextComponentFields;

  return (
    <BlockContainer id={blockId} className={classes}>
      {mediaInTitle ? null : renderMedia()}
      {hasTextComponentFields ? (
        <div className={textComponentsClass}>
          {twoButtons && twoButtons.titleEyebrow ? (
            <span className={css.titleEyebrow}>{twoButtons.titleEyebrow}</span>
          ) : null}
          <Field
            data={title}
            className={hasBlueTitle ? css.blueTitle : undefined}
            options={options}
          />
          {mediaInTitle ? renderMedia(css.mediaInTitle) : null}
          <Field data={text} options={options} />
          <Field data={callToAction} className={ctaButtonClass} options={options} />

          {twoButtons ? (
            <div className={classNames(css.buttonWrap, ctaButtonWrapClass)}>
              <Field
                data={twoButtons.callToAction1}
                className={twoButtons.cta1ClassName || customProps.ctaButtonPrimaryClass}
                options={options}
              />
              <Field
                data={twoButtons.callToAction2}
                className={twoButtons.cta2ClassName || customProps.ctaButtonSecondaryClass}
                options={options}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </BlockContainer>
  );
};

export default AVBlockDefaultView;
