import React from 'react';
import classNames from 'classnames';

import { useIntl } from '../../../../util/reactIntl';
import {
  AV_SECTION_GRID_RAMP,
  AV_SECTION_ONE_COLUMN_RAMP,
  buildSectionRenderSizes,
} from '../../../../util/avGridSizes';
import { AVListingCard } from '../../../../components';

import Field, { hasDataInFields } from '../../Field';
import AVSectionContainer from '../SectionContainer/AVSectionContainer';

import css from './SectionRecommendedListings.module.css';

// The number of columns (numColumns) affects styling and responsive images.
// One column is the odd one out: the CSS keeps `.oneColumn` full-width at every
// breakpoint, so it gets a ramp of its own rather than the 3-up one the other
// counts collapse into between 550px and 967px. The desktop figure is the
// `.baseColumn` max-width (--contentMaxWidthPages), which is the widest a card
// can be once side paddings are dropped inside a container section.
const COLUMN_CONFIG = [
  {
    css: css.oneColumn,
    responsiveImageSizes: buildSectionRenderSizes(AV_SECTION_ONE_COLUMN_RAMP, '1120px'),
  },
  {
    css: css.twoColumns,
    responsiveImageSizes: buildSectionRenderSizes(AV_SECTION_GRID_RAMP, '600px'),
  },
  {
    css: css.threeColumns,
    responsiveImageSizes: buildSectionRenderSizes(AV_SECTION_GRID_RAMP, '400px'),
  },
  {
    css: css.fourColumns,
    responsiveImageSizes: buildSectionRenderSizes(AV_SECTION_GRID_RAMP, '265px'),
  },
];
const getIndex = numColumns => numColumns - 1;
const getColumnCSS = numColumns => {
  const config = COLUMN_CONFIG[getIndex(numColumns)];
  return config ? config.css : COLUMN_CONFIG[0].css;
};
const getResponsiveImageSizes = numColumns => {
  const config = COLUMN_CONFIG[getIndex(numColumns)];
  return config ? config.responsiveImageSizes : COLUMN_CONFIG[0].responsiveImageSizes;
};

// Section component that's able to show blocks in multiple different columns (defined by "numColumns" prop)
const SectionRecommendedListings = props => {
  const intl = useIntl();
  const {
    sectionId,
    className,
    rootClassName,
    defaultClasses,
    numColumns,
    title,
    description,
    appearance,
    callToAction,
    isInsideContainer,
    options,
    customOption,
    listings,
  } = props;

  // If external mapping has been included for fields
  // E.g. { h1: { component: MyAwesomeHeader } }
  const fieldComponents = options?.fieldComponents;
  const fieldOptions = { fieldComponents };

  const hasHeaderFields = hasDataInFields([title, description, callToAction], fieldOptions);
  const hasListings = listings.length > 0;
  const renderSizes = getResponsiveImageSizes(numColumns);

  return (
    <AVSectionContainer
      id={sectionId}
      className={className}
      rootClassName={rootClassName}
      appearance={appearance}
      options={fieldOptions}
      customOption={customOption}
    >
      {hasHeaderFields ? (
        <header className={defaultClasses.sectionDetails}>
          <Field data={title} className={defaultClasses.title} options={fieldOptions} />
          <Field data={description} className={defaultClasses.description} options={fieldOptions} />
          <Field data={callToAction} className={defaultClasses.ctaButton} options={fieldOptions} />
        </header>
      ) : null}
      {hasListings ? (
        <div
          className={classNames(defaultClasses.blockContainer, getColumnCSS(numColumns), {
            [css.noSidePaddings]: isInsideContainer,
          })}
        >
          {listings.map(l => (
            <AVListingCard key={l.id.uuid} listing={l} intl={intl} renderSizes={renderSizes} />
          ))}
        </div>
      ) : null}
    </AVSectionContainer>
  );
};

export default SectionRecommendedListings;
