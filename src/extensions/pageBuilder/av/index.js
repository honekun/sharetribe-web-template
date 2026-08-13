// AV CMS PageBuilder extension. Mirrors src/extensions/landingPage/av/index.js.
//
// - getPageBuilderOptions: returns the AV section components map so PageBuilder
//   can render section types like 'avHero2', 'avHero3', and 'avVideo'.
// - transformPageData: rewrites recognized AV sections into the shape their
//   components expect (pulling text/links from intl).

import { AV_HERO2_SECTION_TYPE, AV_HERO3_SECTION_TYPE, AV_VIDEO_SECTION_TYPE } from './constants';
import { transformAvSections } from './transform';

let cachedSectionComponents;

const getSectionComponents = () => {
  if (cachedSectionComponents) return cachedSectionComponents;

  const SectionHeroCustom2 = require('../../../containers/PageBuilder/SectionBuilder/SectionHeroCustom2')
    .default;
  const SectionHeroCustom3 = require('../../../containers/PageBuilder/SectionBuilder/SectionHeroCustom3')
    .default;
  const SectionVideoSection = require('../../../containers/PageBuilder/SectionBuilder/SectionVideoSection')
    .default;

  cachedSectionComponents = {
    [AV_HERO2_SECTION_TYPE]: { component: SectionHeroCustom2 },
    [AV_HERO3_SECTION_TYPE]: { component: SectionHeroCustom3 },
    [AV_VIDEO_SECTION_TYPE]: { component: SectionVideoSection },
  };
  return cachedSectionComponents;
};

export const getPageBuilderOptions = () => ({
  sectionComponents: getSectionComponents(),
});

export const transformPageData = ({ pageData, intl }) => transformAvSections({ pageData, intl });

export const avPageBuilderExtension = {
  getPageBuilderOptions,
  transformPageData,
};

export default avPageBuilderExtension;
