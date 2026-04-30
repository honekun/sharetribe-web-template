import React from 'react';
import classNames from 'classnames';

// Section components
import SectionArticle from './SectionArticle';
import SectionCarousel from './SectionCarousel';
import SectionColumns from './SectionColumns';
import SectionFeatures from './SectionFeatures';
import SectionHero from './SectionHero';
import SectionListings from './SectionListings';

// Styles
// Note: these contain
// - shared classes that are passed as defaultClasses
// - dark theme overrides
// TODO: alternatively, we could consider more in-place way of theming components
import css from './SectionBuilder.module.css';
import SectionFooter from './SectionFooter';

// These are shared classes.
// Use these to have consistent styles between different section components
// E.g. share the same title styles
const DEFAULT_CLASSES = {
  sectionDetails: css.sectionDetails,
  sectionDetailsH: css.sectionDetailsH,
  title: css.title,
  description: css.description,
  ctaButton: css.ctaButton,
  ctaButtonPrimary: css.ctaButtonPrimary,
  ctaButtonSecondary: css.ctaButtonSecondary,
  avCtaButton: css.avCtaButton,
  ctaButtonBlue: css.ctaButtonBlue,
  ctaButtonLightBlue: css.ctaButtonLightBlue,
  ctaButtonPurple: css.ctaButtonPurple,
  ctaButtonPink: css.ctaButtonPink,
  ctaButtonYellow: css.ctaButtonYellow,
  // modifiers
  roundedFull: css.roundedFull,
  rounded: css.rounded,
  square: css.square,
  dashed: css.dashed,
  solid: css.solid,
  noOutline: css.noOutline,
  headingFont: css.headingFont,
  bodyFont: css.bodyFont,
  accentFont: css.accentFont,
  blockContainer: css.blockContainer,
  defaultLink: css.defaultLink,
};

////////////////////////////////////////////////////
// CTA button style tokens parsed from sectionName //
////////////////////////////////////////////////////

const SECTION_CTA_BASE_MAP = {
  sectionCtaBtnBlue: css.ctaButtonBlue,
  sectionCtaBtnLightBlue: css.ctaButtonLightBlue,
  sectionCtaBtnPurple: css.ctaButtonPurple,
  sectionCtaBtnPink: css.ctaButtonPink,
  sectionCtaBtnYellow: css.ctaButtonYellow,
};
const CTA_MODIFIER_MAP = {
  roundedFull: css.roundedFull,
  rounded: css.rounded,
  square: css.square,
  dashed: css.dashed,
  solid: css.solid,
  noOutline: css.noOutline,
  headingFont: css.headingFont,
  bodyFont: css.bodyFont,
  accentFont: css.accentFont,
  ctaBtnCenter: css.ctaBtnCenter,
};

const hasToken = (str, token) => new RegExp(`- ${token}(?!\\w)`).test(str);

const parseSectionCtaClass = sectionName => {
  if (!sectionName) return null;
  const classes = [];
  let hasBase = false;
  for (const [token, cls] of Object.entries(SECTION_CTA_BASE_MAP)) {
    if (hasToken(sectionName, token)) { classes.push(cls); hasBase = true; break; }
  }
  for (const [token, cls] of Object.entries(CTA_MODIFIER_MAP)) {
    if (hasToken(sectionName, token)) classes.push(cls);
  }
  // When only layout modifiers are present, preserve the default button appearance
  if (!hasBase && classes.length) classes.unshift(css.ctaButton);
  return classes.length ? classNames(classes.filter(Boolean)) : null;
};

/////////////////////////////////////////////
// Mapping of section types and components //
/////////////////////////////////////////////

const defaultSectionComponents = {
  article: { component: SectionArticle },
  carousel: { component: SectionCarousel },
  columns: { component: SectionColumns },
  features: { component: SectionFeatures },
  footer: { component: SectionFooter },
  hero: { component: SectionHero },
  listings: { component: SectionListings },
};

//////////////////////
// Section builder //
//////////////////////

/**
 * @typedef {Object} FieldOption
 * @property {ReactNode} component
 * @property {Function} pickValidProps
 */

/**
 * @typedef {Object} BlockOption
 * @property {ReactNode} component
 */

/**
 * @typedef {Object} SectionOption
 * @property {ReactNode} component
 */

/**
 * @typedef {Object} SectionConfig
 * @property {string} sectionId
 * @property {string} sectionName
 * @property {('article' | 'carousel' | 'columns' | 'features' | 'hero' | 'listings')} sectionType
 */

/**
 * Build section elements from given section config array.
 *
 * @component
 * @param {Object} props
 * @param {Array<SectionConfig>} props.sections
 * @param {Object} props.options
 * @param {Object<string,FieldOption>} props.options.fieldComponents
 * @param {Object<string,BlockOption>} props.options.blockComponents
 * @param {Object<string,SectionOption>} props.options.sectionComponents
 * @param {boolean} props.options.isInsideContainer
 * @returns {JSX.Element} element containing array of sections according from given config array.
 */
const SectionBuilder = props => {
  const { sections = [], options } = props;
  const { sectionComponents = {}, isInsideContainer, ...otherOption } = options || {};

  // If there's no sections, we can't render the correct section component
  if (!sections || sections.length === 0) {
    return null;
  }

  // Selection of Section components
  const components = { ...defaultSectionComponents, ...sectionComponents };
  const getComponent = sectionType => {
    const config = components[sectionType];
    return config?.component;
  };

  // Generate unique ids for sections if operator has managed to create duplicates
  // E.g. "foobar", "foobar1", and "foobar2"
  const sectionIds = [];
  const getUniqueSectionId = (sectionId, index) => {
    const candidate = sectionId || `section-${index + 1}`;
    if (sectionIds.includes(candidate)) {
      let sequentialCandidate = `${candidate}1`;
      for (let i = 2; sectionIds.includes(sequentialCandidate); i++) {
        sequentialCandidate = `${candidate}${i}`;
      }
      return getUniqueSectionId(sequentialCandidate, index);
    } else {
      sectionIds.push(candidate);
      return candidate;
    }
  };

  // Resolve all section ids
  const sectionsWithResolvedIds = sections.map((section, index) => ({
    ...section,
    sectionId: getUniqueSectionId(section.sectionId, index),
  }));

  return (
    <>
      {sectionsWithResolvedIds.map((section, index) => {
        const Section = getComponent(section.sectionType);
        // If the default "dark" theme should be applied (when text color is white).
        // By default, this information is stored to customAppearance field
        const isDarkTheme =
          section?.appearance?.fieldType === 'customAppearance' &&
          section?.appearance?.textColor === 'white';
        const classes = classNames({ [css.darkTheme]: isDarkTheme });
        const sectionId = section.sectionId;

        // TODO: Move to function.
        const customOption = {};
        customOption.isBlueTitle = section.sectionName?.indexOf('- BlueTitle') >= 0;
        customOption.isLarge = section.sectionName?.indexOf('- Large') >= 0;
        customOption.isMedium = section.sectionName?.indexOf('- Medium') >= 0;
        customOption.isFullH = section.sectionName?.indexOf('- FullH') >= 0;
        customOption.isFullW = section.sectionName?.indexOf('- FullW') >= 0;
        customOption.isShortC = section.sectionName?.indexOf('- ShortContent') >= 0;
        customOption.isSmallerT = section.sectionName?.indexOf('- SmallerTitle') >= 0;
        customOption.isMediumT = section.sectionName?.indexOf('- SmallTitle') >= 0;

        customOption.hasPaddings = section.sectionName?.indexOf('- Paddings') >= 0;
        customOption.hasNoPaddings = /- NoPaddings(?![XY])/.test(section.sectionName);
        customOption.hasNoPaddingsX = section.sectionName?.indexOf('- NoPaddingsX') >= 0;
        customOption.hasNoPaddingsY = section.sectionName?.indexOf('- NoPaddingsY') >= 0;

        customOption.isHeadingH = section.sectionName?.indexOf('- Heading2') >= 0;
        customOption.isTwoThirdsCols = section.sectionName?.indexOf('- 2/3 cols') >= 0;

        // Content text is larger & gray.
        if (section.sectionName?.includes('- TextGray')) {
          customOption.hasTextGray = true;
        }
        customOption.hasStar = section.sectionName?.indexOf('- Star') >= 0;
        if (customOption.hasStar) {
          const starPos = section.sectionName?.indexOf('- Star');
          customOption.starDeco = parseInt(section.sectionName?.substring(starPos + 6, starPos + 7));
        }

        const ctaOverride = parseSectionCtaClass(section.sectionName);
        const resolvedDefaultClasses = ctaOverride
          ? { ...DEFAULT_CLASSES, ctaButton: ctaOverride, ctaButtonPrimary: ctaOverride }
          : DEFAULT_CLASSES;

        if (Section) {
          return (
            <Section
              key={`${sectionId}_i${index}`}
              className={classes}
              defaultClasses={resolvedDefaultClasses}
              isInsideContainer={isInsideContainer}
              options={{ ...otherOption, defaultClasses: resolvedDefaultClasses }}
              {...section}
              sectionId={sectionId}
              customOption={customOption}
              allSections={sectionsWithResolvedIds}
            />
          );
        } else {
          // If the section type is unknown, the app can't know what to render
          console.warn(
            `Unknown section type (${section.sectionType}) detected using sectionName (${section.sectionName}).`
          );
          return null;
        }
      })}
    </>
  );
};

export default SectionBuilder;
