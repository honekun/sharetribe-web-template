// AV section transformers for the CMS PageBuilder.
// Each function takes a raw CMS section + intl
// and returns the section enriched with the AV-specific shape that the matching
// AV Section component expects.
//
// Used from index.js's transformPageData hook — never import directly from
// CMSPage.js or other render-path code.

import {
  AV_HERO2_SECTION_TYPE,
  AV_HERO3_SECTION_TYPE,
  AV_VIDEO_SECTION_TYPE,
  AV_HERO2_PREFIX,
  AV_HERO3_PREFIX,
  AV_VIDEO_PREFIX,
} from './constants';

// Avoids calling formatMessage for missing/empty keys — react-intl fires a
// MISSING_TRANSLATION console error even when defaultMessage is provided.
const fmt = (intl, id, def = '') => {
  const val = intl?.messages?.[id];
  if (!val) return def;
  const result = intl.formatMessage({ id, defaultMessage: def }).trim();
  return result === id ? def : result;
};

// --- avHero2 (instance per sectionId suffix, e.g. "av-hero2-shop") ---
const buildHero2Section = (intl, section) => {
  const instanceId = section.sectionId.slice(AV_HERO2_PREFIX.length) || section.sectionId;
  const cta1Text = fmt(intl, `AVHero2.${instanceId}.cta1Text`).trim();
  const cta2Text = fmt(intl, `AVHero2.${instanceId}.cta2Text`).trim();
  // Safe read: `fmt` returns '' for a missing key (no react-intl id fallback), so
  // an unset bgLink yields null instead of a bogus full-section link.
  const rawBgLink = fmt(intl, `AVHero2.${instanceId}.bgLink`);
  return {
    ...section,
    sectionType: AV_HERO2_SECTION_TYPE,
    // Empty when unset, so SectionHeroCustom2 can fall back to Section Name CTA
    // tokens (and then the primary/secondary defaults).
    cta1Style: fmt(intl, `AVHero2.${instanceId}.cta1Style`),
    cta2Style: fmt(intl, `AVHero2.${instanceId}.cta2Style`),
    callToAction: cta1Text
      ? {
          fieldType: 'internalButtonLink',
          href: fmt(intl, `AVHero2.${instanceId}.cta1Link`, '/s'),
          content: cta1Text,
        }
      : section.callToAction || null,
    callToAction2: cta2Text
      ? {
          fieldType: 'internalButtonLink',
          href: fmt(intl, `AVHero2.${instanceId}.cta2Link`, '/s'),
          content: cta2Text,
        }
      : section.callToAction2 || null,
    mobileBackgroundImageUrl: fmt(intl, `AVHero2.${instanceId}.mobileBackgroundUrl`) || null,
    bgLink: rawBgLink && rawBgLink !== '#' ? rawBgLink : null,
  };
};

// --- avHero3 ---
// Button styling comes from block/section name tokens (parsed at render time),
// not from translation strings.
const buildHero3Section = (intl, section) => ({
  ...section,
  sectionType: AV_HERO3_SECTION_TYPE,
});

// --- avVideo ---
const buildVideoSection = (intl, section) => {
  const instanceId = section.sectionId.slice(AV_VIDEO_PREFIX.length) || section.sectionId;
  return {
    ...section,
    sectionType: AV_VIDEO_SECTION_TYPE,
    videoUrl: fmt(intl, `AVVideo.${instanceId}.videoUrl`) || null,
  };
};

// Top-level transform: walk every section and rewrite the AV-recognized ones.
export const transformAvSections = ({ pageData, intl }) => {
  if (!pageData?.sections) return pageData;

  const sections = pageData.sections.map(s => {
    if (s.sectionId?.startsWith(AV_HERO2_PREFIX)) return buildHero2Section(intl, s);
    if (s.sectionId?.startsWith(AV_HERO3_PREFIX)) return buildHero3Section(intl, s);
    if (s.sectionId?.startsWith(AV_VIDEO_PREFIX)) return buildVideoSection(intl, s);
    return s;
  });

  return { ...pageData, sections };
};
