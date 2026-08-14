'use strict';

import {
  getEffectiveBlockType,
  normalizeAvBlockTypes,
  hasBlockNameToken,
  hasSocialLinksToken,
  createBlockCustomProps,
  parseBlockCtaClass,
  mergeBlockCtaClass,
} from './blocks';

// Minimal css mock: each key maps to its own name so classNames output is readable.
const cssMock = new Proxy({}, { get: (_, prop) => prop });

describe('getEffectiveBlockType', () => {
  it('returns blockInstagramFeed for blockId "av-insta-feed"', () => {
    expect(getEffectiveBlockType('av-insta-feed', null, 'defaultBlock')).toBe('blockInstagramFeed');
  });

  it('returns blockMarkdownTable for blockId starting with "av-table-"', () => {
    expect(getEffectiveBlockType('av-table-pricing', null, 'defaultBlock')).toBe(
      'blockMarkdownTable'
    );
  });

  it('returns blockBrevoForm for blockId "av-contact-form"', () => {
    expect(getEffectiveBlockType('av-contact-form', null, 'defaultBlock')).toBe('blockBrevoForm');
  });

  it('returns fallbackType when no special blockId matches', () => {
    expect(getEffectiveBlockType('regular-block', 'Normal block', 'blockDefault')).toBe(
      'blockDefault'
    );
  });

  it('returns blockPhotoSlider for a default block named "photoSlider ::"', () => {
    expect(getEffectiveBlockType('b1', 'Gallery photoSlider ::', 'defaultBlock')).toBe(
      'blockPhotoSlider'
    );
    expect(getEffectiveBlockType('b1', 'photoSlider ::', undefined)).toBe('blockPhotoSlider');
  });

  it('leaves non-default block types alone even with the slider token', () => {
    expect(getEffectiveBlockType('b1', 'photoSlider ::', 'footerBlock')).toBe('footerBlock');
    expect(getEffectiveBlockType('b1', 'photoSlider ::', 'socialMediaLink')).toBe(
      'socialMediaLink'
    );
  });

  it('a blockId shortcut wins over the slider token', () => {
    expect(getEffectiveBlockType('av-insta-feed', 'photoSlider ::', 'defaultBlock')).toBe(
      'blockInstagramFeed'
    );
  });

  it('apart from the slider token, only blockId drives the shortcut', () => {
    expect(getEffectiveBlockType('av-insta-feed', '2 cols buttons :: A', 'defaultBlock')).toBe(
      'blockInstagramFeed'
    );
    // A blockName that previously routed to a component now falls through.
    expect(getEffectiveBlockType('regular-block', '2 cols buttons :: A', 'defaultBlock')).toBe(
      'defaultBlock'
    );
  });

  it('handles null blockId and blockName gracefully', () => {
    expect(getEffectiveBlockType(null, null, 'blockDefault')).toBe('blockDefault');
  });

  it('handles undefined blockId and blockName gracefully', () => {
    expect(getEffectiveBlockType(undefined, undefined, 'blockDefault')).toBe('blockDefault');
  });
});

describe('normalizeAvBlockTypes', () => {
  it('types a shorthand blockId with no blockType as defaultBlock', () => {
    // Upstream's BlockBuilder looks up components[block.blockType], so without
    // this the block would warn and render nothing instead of reaching
    // AVBlockDefault's re-routing.
    expect(normalizeAvBlockTypes([{ blockId: 'av-insta-feed' }])).toEqual([
      { blockId: 'av-insta-feed', blockType: 'defaultBlock' },
    ]);
    expect(normalizeAvBlockTypes([{ blockId: 'av-table-fees' }])).toEqual([
      { blockId: 'av-table-fees', blockType: 'defaultBlock' },
    ]);
    expect(normalizeAvBlockTypes([{ blockId: 'av-contact-form' }])).toEqual([
      { blockId: 'av-contact-form', blockType: 'defaultBlock' },
    ]);
  });

  it('types a blockType-less "photoSlider ::" block as defaultBlock', () => {
    expect(normalizeAvBlockTypes([{ blockId: 'b1', blockName: 'photoSlider ::' }])).toEqual([
      { blockId: 'b1', blockName: 'photoSlider ::', blockType: 'defaultBlock' },
    ]);
  });

  it('leaves blocks that declare a blockType untouched', () => {
    const blocks = [
      { blockId: 'av-insta-feed', blockType: 'defaultBlock' },
      { blockId: 'av-table-fees', blockType: 'footerBlock' },
      { blockId: 'b1', blockName: 'photoSlider ::', blockType: 'socialMediaLink' },
    ];
    expect(normalizeAvBlockTypes(blocks)).toBe(blocks);
  });

  it('leaves a type-less block that matches no shorthand alone, so it still warns', () => {
    const blocks = [{ blockId: 'regular-block', blockName: 'Just a name' }];
    expect(normalizeAvBlockTypes(blocks)).toBe(blocks);
  });

  it('normalizes only the blocks that need it, keeping the others by reference', () => {
    const typed = { blockId: 'b1', blockType: 'defaultBlock' };
    const untyped = { blockId: 'av-insta-feed' };
    const result = normalizeAvBlockTypes([typed, untyped]);

    expect(result[0]).toBe(typed);
    expect(result[1]).not.toBe(untyped);
    expect(untyped.blockType).toBeUndefined();
  });

  it('passes through a missing or non-array blocks value', () => {
    expect(normalizeAvBlockTypes(undefined)).toBeUndefined();
    expect(normalizeAvBlockTypes(null)).toBeNull();
  });

  it('tolerates null entries in the block list', () => {
    expect(normalizeAvBlockTypes([null, { blockId: 'av-insta-feed' }])).toEqual([
      null,
      { blockId: 'av-insta-feed', blockType: 'defaultBlock' },
    ]);
  });
});

describe('hasBlockNameToken', () => {
  it('matches a token wherever it sits in the block name', () => {
    expect(hasBlockNameToken('social links ::', 'social links')).toBe(true);
    expect(hasBlockNameToken('smallerTitles :: social links ::', 'social links')).toBe(true);
    expect(hasBlockNameToken('Footer col :: social links :: blueTitle ::', 'social links')).toBe(
      true
    );
  });

  it('does not match a token that is absent or missing its "::" suffix', () => {
    expect(hasBlockNameToken('smallerTitles ::', 'social links')).toBe(false);
    expect(hasBlockNameToken('social links', 'social links')).toBe(false);
  });

  it('returns false rather than throwing for an unset block name', () => {
    expect(hasBlockNameToken(undefined, 'social links')).toBe(false);
    expect(hasBlockNameToken(null, 'social links')).toBe(false);
    expect(hasBlockNameToken('', 'social links')).toBe(false);
  });

  it('reads the social-links token the same way for SectionFooter and AVBlockFooter', () => {
    // Both sides call this; if they disagree the footer shows its icons twice.
    expect(hasSocialLinksToken('smallerTitles :: social links ::')).toBe(true);
    expect(hasSocialLinksToken('smallerTitles ::')).toBe(false);
    expect(hasSocialLinksToken(undefined)).toBe(false);
  });
});

describe('createBlockCustomProps', () => {
  const intl = { formatMessage: () => '' };
  const css = {};

  it('sets hasSmallerTitles for blockName containing "smallerTitles ::"', () => {
    const props = createBlockCustomProps(
      { blockId: 'b1', blockName: 'smallerTitles ::' },
      intl,
      css
    );
    expect(props.hasSmallerTitles).toBe(true);
  });

  it('does not set hasSmallerTitles when the token is absent', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'blueTitle ::' }, intl, css);
    expect(props.hasSmallerTitles).toBeUndefined();
  });

  it('sets hasMediaTitle for blockName containing "mediaTitle ::"', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'mediaTitle ::' }, intl, css);
    expect(props.hasMediaTitle).toBe(true);
  });

  it('does not set hasMediaTitle when the token is absent', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'blueTitle ::' }, intl, css);
    expect(props.hasMediaTitle).toBeUndefined();
  });

  it('sets hasBlueTitle for blockName containing "blueTitle ::"', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'blueTitle ::' }, intl, css);
    expect(props.hasBlueTitle).toBe(true);
  });

  it('does not set hasBlueTitle when the token is absent', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'mediaTitle ::' }, intl, css);
    expect(props.hasBlueTitle).toBeUndefined();
  });

  it('sets hasFullLinks for blockName containing "fullLinks ::"', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'fullLinks ::' }, intl, css);
    expect(props.hasFullLinks).toBe(true);
  });

  it('does not set hasFullLinks when the token is absent', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'blueTitle ::' }, intl, css);
    expect(props.hasFullLinks).toBeUndefined();
  });

  it('sets hasImgTop for blockName containing "imgTop ::"', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'imgTop ::' }, intl, css);
    expect(props.hasImgTop).toBe(true);
  });

  it('does not set hasImgTop when the token is absent', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'blueTitle ::' }, intl, css);
    expect(props.hasImgTop).toBeUndefined();
  });

  it('sets hasIconImg for "icon img ::"', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'icon img ::' }, intl, css);
    expect(props.hasIconImg).toBe(true);
  });

  it('builds a 4-image sliderImages array for "photoSlider ::"', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: 'photoSlider ::' }, intl, css);
    expect(Array.isArray(props.sliderImages)).toBe(true);
    expect(props.sliderImages).toHaveLength(4);
  });

  it('builds twoButtons for "2Buttons ::"', () => {
    const props = createBlockCustomProps({ blockId: 'b1', blockName: '2Buttons ::' }, intl, css);
    expect(props.twoButtons).toBeTruthy();
    expect(props.twoButtons.callToAction1.fieldType).toBe('internalButtonLink');
  });

  it('ignores removed block tokens (no prop emitted)', () => {
    const props = createBlockCustomProps(
      {
        blockId: 'b1',
        blockName:
          '2 cols :: contact buttons :: buyer list :: seller list :: text gray ::' +
          ' text darkgray :: text nogap :: text larger :: smaller :: large list ::' +
          ' content short :: full height media :: button secondary :: button tertiary ::',
      },
      intl,
      css
    );
    expect(props.blueCols).toBeUndefined();
    expect(props.contactButtons).toBeUndefined();
    expect(props.showBuyerList).toBeUndefined();
    expect(props.showSellerList).toBeUndefined();
    expect(props.hasTextGray).toBeUndefined();
    expect(props.hasTextDarkGray).toBeUndefined();
    expect(props.hasTextNoGap).toBeUndefined();
    expect(props.hasTextLarger).toBeUndefined();
    expect(props.hasTextSmaller).toBeUndefined();
    expect(props.hasLargeList).toBeUndefined();
    expect(props.hasShortContent).toBeUndefined();
    expect(props.hasFullHeightMedia).toBeUndefined();
    expect(props.hasCTASecondary).toBeUndefined();
    expect(props.hasCTATertiary).toBeUndefined();
  });
});

describe('parseBlockCtaClass', () => {
  it('returns null for empty/absent blockName or no CTA tokens', () => {
    expect(parseBlockCtaClass(null, cssMock)).toBeNull();
    expect(parseBlockCtaClass('', cssMock)).toBeNull();
    expect(parseBlockCtaClass('just a name', cssMock)).toBeNull();
  });

  it('parses a base color token with no modifiers', () => {
    expect(parseBlockCtaClass('blockCtaBtnBlue ::', cssMock)).toEqual({
      baseClass: 'ctaButtonBlue',
      modifierClasses: [],
    });
  });

  it('parses the secondary base token', () => {
    expect(parseBlockCtaClass('blockCtaBtnSecondary ::', cssMock)).toEqual({
      baseClass: 'ctaButtonSecondary',
      modifierClasses: [],
    });
  });

  it('parses a modifier-only token with no base color (does NOT inject a default base)', () => {
    expect(parseBlockCtaClass('ctaBtnCenter ::', cssMock)).toEqual({
      baseClass: null,
      modifierClasses: ['ctaBtnCenter'],
    });
  });

  it('parses base color + multiple modifiers', () => {
    expect(parseBlockCtaClass('blockCtaBtnPink :: rounded :: dashed ::', cssMock)).toEqual({
      baseClass: 'ctaButtonPink',
      modifierClasses: ['rounded', 'dashed'],
    });
  });
});

describe('mergeBlockCtaClass', () => {
  it('returns the inherited class when there is no override', () => {
    expect(mergeBlockCtaClass(null, 'ctaButtonBlue', cssMock)).toBe('ctaButtonBlue');
    expect(mergeBlockCtaClass(null, undefined, cssMock)).toBeNull();
  });

  it('keeps the inherited base color and layers a modifier-only override on top', () => {
    // The reported bug: "- SectionCtaBtnBlue" + block "ctaBtnCenter ::" must stay blue.
    const override = parseBlockCtaClass('ctaBtnCenter ::', cssMock);
    expect(mergeBlockCtaClass(override, 'ctaButtonBlue', cssMock)).toBe(
      'ctaButtonBlue ctaBtnCenter'
    );
  });

  it('lets a block color token replace the inherited base, still layering modifiers', () => {
    const override = parseBlockCtaClass('blockCtaBtnPink :: rounded ::', cssMock);
    expect(mergeBlockCtaClass(override, 'ctaButtonBlue', cssMock)).toBe('ctaButtonPink rounded');
  });

  it('falls back to the neutral ctaButton when nothing is inherited', () => {
    const override = parseBlockCtaClass('ctaBtnCenter ::', cssMock);
    expect(mergeBlockCtaClass(override, undefined, cssMock)).toBe('ctaButton ctaBtnCenter');
  });
});
