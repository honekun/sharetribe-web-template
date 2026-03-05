import {
  AV_HERO_SECTION_ID,
  AV_RECOMMENDEDS_SECTION_ID,
  AV_SELECTIONS_SECTION_ID_PREFIX,
} from './constants';

export const getListingIdsFromSection = section =>
  section?.blocks?.map(block => block?.blockName).filter(Boolean) || [];

export const isSelectionsSectionId = sectionId =>
  (sectionId || '').indexOf(AV_SELECTIONS_SECTION_ID_PREFIX) === 0;

export const getRecommendedListingIds = pageData => {
  const section = pageData?.sections?.find(s => s?.sectionId === AV_RECOMMENDEDS_SECTION_ID);
  return getListingIdsFromSection(section);
};

export const getSelectionsSections = pageData => {
  const sections = pageData?.sections || [];
  return sections.reduce((collected, section) => {
    const sectionId = section?.sectionId || '';
    if (isSelectionsSectionId(sectionId)) {
      return { ...collected, [sectionId]: getListingIdsFromSection(section) };
    }
    return collected;
  }, {});
};

export const hasCustomSections = pageData => {
  const sections = pageData?.sections || [];
  return sections.some(s => {
    const sectionId = s?.sectionId || '';
    return (
      sectionId === AV_HERO_SECTION_ID ||
      sectionId === AV_RECOMMENDEDS_SECTION_ID ||
      isSelectionsSectionId(sectionId)
    );
  });
};
