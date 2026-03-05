import { transformCustomSections } from './transform';

describe('landingPage AV transform', () => {
  it('returns original data when extension is inactive', () => {
    const pageData = { sections: [{ sectionId: 'plain' }] };

    expect(transformCustomSections({ pageData, extensionData: { hasCustomSections: false } })).toBe(pageData);
    expect(transformCustomSections({ pageData: null, extensionData: { hasCustomSections: true } })).toBeNull();
  });

  it('maps custom section types and injects listing data', () => {
    const intl = { formatMessage: ({ defaultMessage }) => defaultMessage };
    const pageData = {
      sections: [
        { sectionId: 'av-hero', title: { content: 'hero' } },
        { sectionId: 'av-recommendeds' },
        { sectionId: 'av-selections-1' },
        { sectionId: 'plain' },
      ],
    };
    const extensionData = {
      hasCustomSections: true,
      listings: [{ id: 'rec-1' }],
      selectionsListings: { 'av-selections-1': [{ id: 'sel-1' }] },
    };

    const transformed = transformCustomSections({ pageData, intl, extensionData });
    const [hero, recommendeds, selections, plain] = transformed.sections;

    expect(hero.sectionType).toBe('avHero');
    expect(hero.classWrap).toBe('contentLeft');
    expect(hero.callToAction.content).toBe('Explore now');
    expect(hero.callToAction2.content).toBe('Browse all');
    expect(hero.isLanding).toBe(true);

    expect(recommendeds.sectionType).toBe('avRecommendeds');
    expect(recommendeds.listings).toEqual([{ id: 'rec-1' }]);

    expect(selections.sectionType).toBe('avSelections');
    expect(selections.listings).toEqual([{ id: 'sel-1' }]);

    expect(plain.sectionId).toBe('plain');
    expect(plain.sectionType).toBeUndefined();
  });
});
