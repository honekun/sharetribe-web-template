import {
  getRecommendedListingIds,
  getSelectionsSections,
  hasCustomSections,
  isSelectionsSectionId,
} from './sections';

describe('landingPage AV sections helpers', () => {
  it('detects selection section ids by prefix', () => {
    expect(isSelectionsSectionId('av-selections')).toBe(true);
    expect(isSelectionsSectionId('av-selections-1')).toBe(true);
    expect(isSelectionsSectionId('hero')).toBe(false);
  });

  it('extracts recommended and selection listing ids', () => {
    const pageData = {
      sections: [
        {
          sectionId: 'av-recommendeds',
          blocks: [{ blockName: 'id-r1' }, { blockName: 'id-r2' }],
        },
        {
          sectionId: 'av-selections-1',
          blocks: [{ blockName: 'id-s1' }],
        },
      ],
    };

    expect(getRecommendedListingIds(pageData)).toEqual(['id-r1', 'id-r2']);
    expect(getSelectionsSections(pageData)).toEqual({
      'av-selections-1': ['id-s1'],
    });
  });

  it('returns whether custom AV sections exist', () => {
    expect(hasCustomSections({ sections: [{ sectionId: 'other' }] })).toBe(false);
    expect(hasCustomSections({ sections: [{ sectionId: 'av-hero' }] })).toBe(true);
  });
});
