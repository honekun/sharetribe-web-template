// AV style helpers for SectionBuilder. Encapsulates the CSS class shortcuts
// added to DEFAULT_CLASSES and the sectionName token parsers, so SectionBuilder
// only needs a couple of import + call lines from this module.
//
// `css` here is the SectionBuilder.module.css object (passed in by the caller
// since CSS Modules resolve at import-time in the consumer file); only its
// upstream `ctaButton` is read from it. The AV button classes come from the
// AV-owned src/styles/avCtaButtons.module.css (audit U01).

import classNames from 'classnames';

import avButtons from '../../../styles/avCtaButtons.module.css';
import sectionLayout from './sectionLayout.module.css';

// Extra entries added to upstream DEFAULT_CLASSES to expose AV CSS hooks to
// section components.
export const getAvDefaultClassEntries = css => ({
  sectionDetailsH: sectionLayout.sectionDetailsH,
  // Upstream's own button, under the AV key the hero sections read.
  ctaButtonPrimary: css.ctaButton,
  ctaButtonSecondary: avButtons.ctaButtonSecondary,
  avCtaButton: avButtons.avCtaButton,
  ctaButtonBlue: avButtons.ctaButtonBlue,
  ctaButtonLightBlue: avButtons.ctaButtonLightBlue,
  ctaButtonPurple: avButtons.ctaButtonPurple,
  ctaButtonPink: avButtons.ctaButtonPink,
  ctaButtonYellow: avButtons.ctaButtonYellow,
  // modifiers
  roundedFull: avButtons.roundedFull,
  rounded: avButtons.rounded,
  square: avButtons.square,
  dashed: avButtons.dashed,
  solid: avButtons.solid,
  noOutline: avButtons.noOutline,
  headingFont: avButtons.headingFont,
  bodyFont: avButtons.bodyFont,
  accentFont: avButtons.accentFont,
  ctaBtnCenter: avButtons.ctaBtnCenter,
});

// CTA tokens recognized in `section.sectionName`. Order in BASE_MAP matters:
// the first matching base token wins.
const buildSectionCtaBaseMap = css => ({
  SectionCtaBtnBlue: avButtons.ctaButtonBlue,
  SectionCtaBtnLightBlue: avButtons.ctaButtonLightBlue,
  SectionCtaBtnPurple: avButtons.ctaButtonPurple,
  SectionCtaBtnPink: avButtons.ctaButtonPink,
  SectionCtaBtnYellow: avButtons.ctaButtonYellow,
  SectionCtaBtnSecondary: avButtons.ctaButtonSecondary,
});

const buildCtaModifierMap = css => ({
  RoundedFull: avButtons.roundedFull,
  Rounded: avButtons.rounded,
  Square: avButtons.square,
  Dashed: avButtons.dashed,
  Solid: avButtons.solid,
  NoOutline: avButtons.noOutline,
  HeadingFont: avButtons.headingFont,
  BodyFont: avButtons.bodyFont,
  AccentFont: avButtons.accentFont,
  CtaBtnCenter: avButtons.ctaBtnCenter,
});

const hasToken = (str, token) => new RegExp(`- ${token}(?!\\w)`).test(str);

export const parseSectionCtaClass = (sectionName, css) => {
  if (!sectionName) return null;
  const baseMap = buildSectionCtaBaseMap(css);
  const modifierMap = buildCtaModifierMap(css);
  const classes = [];
  let hasBase = false;
  for (const [token, cls] of Object.entries(baseMap)) {
    if (hasToken(sectionName, token)) {
      classes.push(cls);
      hasBase = true;
      break;
    }
  }
  for (const [token, cls] of Object.entries(modifierMap)) {
    if (hasToken(sectionName, token)) classes.push(cls);
  }
  // When only layout modifiers are present, preserve the default button look.
  if (!hasBase && classes.length) classes.unshift(css.ctaButton);
  return classes.length ? classNames(classes.filter(Boolean)) : null;
};

// Parse all the `- Token` flags in section.sectionName into a customOption
// object that AV section components consume. Keep the keys grouped the same way
// they are documented in docs/operator-guide.md §5.1.
export const parseSectionCustomOptions = sectionName => {
  const customOption = {};
  if (!sectionName) return customOption;

  // Layout / width
  customOption.isLarge = hasToken(sectionName, 'Large');
  customOption.isFullW = hasToken(sectionName, 'FullW');
  customOption.isFullWHeader = hasToken(sectionName, 'FullWHeader');
  customOption.isShortHero = hasToken(sectionName, 'ShortHero');
  customOption.isTwoThirdsCols = hasToken(sectionName, '2/3 cols');
  customOption.isAvFeature = hasToken(sectionName, 'AvFeature');
  customOption.isReverseFeature = hasToken(sectionName, 'ReverseFeature');

  // Title / text
  customOption.isBlueTitle = hasToken(sectionName, 'BlueTitle');
  customOption.isWhiteTitle = hasToken(sectionName, 'WhiteTitle');
  customOption.isCenterTitleText = hasToken(sectionName, 'CenterTitleText');
  customOption.isCenterDescText = hasToken(sectionName, 'CenterDescText');
  customOption.isLargeDesc = hasToken(sectionName, 'LargeDesc');
  customOption.isSmallerTitles = hasToken(sectionName, 'SmallerTitles');

  // Spacing
  customOption.hasNoPaddings = hasToken(sectionName, 'NoPaddings');
  customOption.hasSmallGapCols = hasToken(sectionName, 'SmallGapCols');
  customOption.hasSmallGapRows = hasToken(sectionName, 'SmallGapRows');
  customOption.hasNoGapCols = hasToken(sectionName, 'NoGapCols');
  customOption.hasNoGapRows = hasToken(sectionName, 'NoGapRows');

  return customOption;
};
