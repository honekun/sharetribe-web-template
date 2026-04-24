import React from 'react';
import classNames from 'classnames';

import Field, { hasDataInFields } from '../../Field';

import SectionContainer from '../SectionContainer';
import css from './SectionHeroCustom2.module.css';

/**
 * @typedef {Object} FieldComponentConfig
 * @property {ReactNode} component
 * @property {Function} pickValidProps
 */

/**
 * Multi-instance hero section (avHero2).
 * Supports 0–2 optional CTA buttons and an optional mobile background image.
 * Identify instances with sectionId prefix "av-hero2-<id>".
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className
 * @param {string?} props.rootClassName
 * @param {Object} props.defaultClasses
 * @param {string} props.sectionId
 * @param {Object?} props.title
 * @param {Object?} props.description
 * @param {Object?} props.appearance
 * @param {Object?} props.callToAction  - optional first CTA button
 * @param {Object?} props.callToAction2 - optional second CTA button
 * @param {string?} props.mobileBackgroundImageUrl - URL for mobile-only background (≤767px)
 * @param {string?} props.classWrap - additional CSS class on the section (e.g. 'contentLeft')
 * @param {boolean?} props.isLanding
 * @param {Object} props.options
 * @returns {JSX.Element}
 */
const SectionHeroCustom2 = props => {
  const {
    sectionId,
    className,
    rootClassName,
    defaultClasses,
    title,
    description,
    appearance,
    callToAction,
    callToAction2,
    mobileBackgroundImageUrl,
    options,
    classWrap,
    isLanding,
  } = props;

  const fieldComponents = options?.fieldComponents;
  const fieldOptions = { fieldComponents };

  const hasHeaderFields = hasDataInFields([title, description, callToAction, callToAction2], fieldOptions);

  const mobileStyle = mobileBackgroundImageUrl
    ? { '--av2-mobile-bg': `url("${mobileBackgroundImageUrl}")` }
    : undefined;

  return (
    <SectionContainer
      id={sectionId}
      className={classNames(className, css[classWrap] ?? '', mobileBackgroundImageUrl ? css.hasMobileBg : '')}
      rootClassName={classNames(rootClassName || css.root)}
      appearance={appearance}
      options={fieldOptions}
      style={mobileStyle}
    >
      {hasHeaderFields ? (
        <header
          className={classNames(
            defaultClasses.sectionDetails,
            css.contentHeader,
            isLanding ? css.landingVersion : ''
          )}
        >
          <Field data={title} className={classNames(defaultClasses.title)} options={fieldOptions} />
          <Field data={description} className={defaultClasses.description} options={fieldOptions} />
          <div className={css.buttonWrap}>
            <Field data={callToAction} className={defaultClasses.ctaButtonPrimary} options={fieldOptions} />
            <Field data={callToAction2} className={defaultClasses.ctaButtonSecondary} options={fieldOptions} />
          </div>
        </header>
      ) : null}
    </SectionContainer>
  );
};

export default SectionHeroCustom2;
