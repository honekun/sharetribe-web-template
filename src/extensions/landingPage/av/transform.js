import {
  AV_HERO_SECTION_ID,
  AV_HERO_SECTION_TYPE,
  AV_RECOMMENDEDS_SECTION_ID,
  AV_RECOMMENDEDS_SECTION_TYPE,
  AV_SELECTIONS_SECTION_TYPE,
  AV_TAG_LISTINGS_SECTION_TYPE,
  AV_SELECTED_CATS_SECTION_TYPE,
} from './constants';
import { isSelectionsSectionId, isTagListingsSectionId, isSelectedCatsSectionId } from './sections';

const formatMessage = (intl, id, defaultMessage) => {
  return intl?.formatMessage
    ? intl.formatMessage({ id, defaultMessage })
    : defaultMessage || id;
};

export const transformCustomSections = ({ pageData, intl, extensionData }) => {
  if (!pageData || !extensionData?.hasCustomSections) {
    return pageData;
  }

  const sections = pageData?.sections || [];
  const listings = extensionData?.listings || [];
  const selectionsListings = extensionData?.selectionsListings || {};
  const tagListingsSections = extensionData?.tagListingsSections || {};

  const customSections = sections.map(section => {
    const sectionId = section?.sectionId || '';

    if (sectionId === AV_HERO_SECTION_ID) {
      return {
        ...section,
        sectionType: AV_HERO_SECTION_TYPE,
        classWrap: 'contentLeft',
        callToAction: {
          fieldType: 'internalButtonLink',
          href: formatMessage(intl, 'AVHero.ctaFirstLink', '/s?pub_tags=hot-list'),
          content: formatMessage(intl, 'AVHero.ctaFirstText', 'Explore now'),
        },
        callToAction2: {
          fieldType: 'internalButtonLink',
          href: formatMessage(intl, 'AVHero.ctaSecondLink', '/s'),
          content: formatMessage(intl, 'AVHero.ctaSecondText', 'Browse all'),
        },
        isLanding: true,
      };
    }

    if (sectionId === AV_RECOMMENDEDS_SECTION_ID) {
      return {
        ...section,
        sectionType: AV_RECOMMENDEDS_SECTION_TYPE,
        listings,
      };
    }

    if (isSelectionsSectionId(sectionId)) {
      return {
        ...section,
        sectionType: AV_SELECTIONS_SECTION_TYPE,
        listings: selectionsListings[sectionId] || [],
      };
    }

    if (isTagListingsSectionId(sectionId)) {
      return {
        ...section,
        sectionType: AV_TAG_LISTINGS_SECTION_TYPE,
        listings: tagListingsSections[sectionId] || [],
      };
    }

    if (isSelectedCatsSectionId(sectionId)) {
      // blocks are already in section.blocks from the CMS — just set the type
      return {
        ...section,
        sectionType: AV_SELECTED_CATS_SECTION_TYPE,
      };
    }

    return section;
  });

  return {
    ...pageData,
    sections: customSections,
  };
};
