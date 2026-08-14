// AV BlockBuilder helpers: block components map, blockName parsers, and the
// large `createBlockCustomProps` switch that walks block.blockName tokens and
// pulls intl-keyed copy into block props.
//
// `css` is the SectionBuilder.module.css object passed in by the caller (CSS
// Modules resolve at import time in the consumer file).

import classNames from 'classnames';

// Avoids MISSING_TRANSLATION console errors for empty/absent keys.
const fmt = (intl, id, def = '') => {
  const val = intl?.messages?.[id];
  if (!val) return def;
  return intl.formatMessage({ id, defaultMessage: def }) || def;
};

// ---- Block components ----

// The AV-only block types. These are reached by blockId/blockName rather than by
// a CMS-authored `blockType` — see `getEffectiveBlockType` / `resolveAvBlockComponent`.
//
// Everything here is `require`d lazily and cached: `AVBlockDefault` imports the
// helpers in this file, so a top-level import back into the container tree would
// be a cycle.
let cachedSpecialBlockComponents;

export const getAvSpecialBlockComponents = () => {
  if (cachedSpecialBlockComponents) return cachedSpecialBlockComponents;

  const BlockInstagramFeed = require('../../../containers/PageBuilder/BlockBuilder/BlockInstagramFeed/BlockInstagramFeed')
    .default;
  const BlockMarkdownTable = require('../../../containers/PageBuilder/BlockBuilder/BlockMarkdownTable/BlockMarkdownTable')
    .default;
  const BlockBrevoForm = require('../../../containers/PageBuilder/BlockBuilder/BlockBrevoForm/BlockBrevoForm')
    .default;
  const AVPhotoSliderBlock = require('../../../containers/PageBuilder/BlockBuilder/AVPhotoSliderBlock/AVPhotoSliderBlock')
    .default;

  cachedSpecialBlockComponents = {
    blockInstagramFeed: { component: BlockInstagramFeed },
    blockMarkdownTable: { component: BlockMarkdownTable },
    blockBrevoForm: { component: BlockBrevoForm },
    blockPhotoSlider: { component: AVPhotoSliderBlock },
  };
  return cachedSpecialBlockComponents;
};

let cachedBlockComponents;

/**
 * The full AV block-component map, injected as `options.blockComponents` by
 * SectionBuilder. Overriding the two standard keys is what keeps upstream's
 * `BlockBuilder`, `BlockDefault` and `BlockFooter` byte-identical.
 */
export const getAvBlockComponents = () => {
  if (cachedBlockComponents) return cachedBlockComponents;

  const AVBlockDefault = require('../../../containers/PageBuilder/BlockBuilder/AVBlockDefault/AVBlockDefault')
    .default;
  const AVBlockFooter = require('../../../containers/PageBuilder/BlockBuilder/AVBlockFooter/AVBlockFooter')
    .default;

  cachedBlockComponents = {
    ...getAvSpecialBlockComponents(),
    defaultBlock: { component: AVBlockDefault },
    footerBlock: { component: AVBlockFooter },
  };
  return cachedBlockComponents;
};

// `blockId` shorthands let CMS authors pick a block component with a fixed block
// id instead of a block type; the `photoSlider ::` block-name token picks one the
// same way. A block that carries no `blockType` at all is handled by
// `normalizeAvBlockTypes` below, because upstream's BlockBuilder selects on
// `blockType` before any AV code runs.
export const getEffectiveBlockType = (blockId, blockName, fallbackType) => {
  if (blockId === 'av-insta-feed') return 'blockInstagramFeed';
  if (blockId?.startsWith('av-table-')) return 'blockMarkdownTable';
  if (blockId === 'av-contact-form') return 'blockBrevoForm';
  // Only a default block gains a slider: a footer or social-media block has no
  // media field for it to stand in for.
  const isDefaultBlock = !fallbackType || fallbackType === 'defaultBlock';
  if (isDefaultBlock && hasBlockNameToken(blockName, 'photoSlider')) return 'blockPhotoSlider';
  return fallbackType;
};

/**
 * The AV block component a block should re-route to, or `null` to render the
 * component's own view.
 *
 * `AVBlockDefault` / `AVBlockFooter` call this instead of upstream's BlockBuilder
 * doing the lookup, so the re-routing works on every page — including
 * TermsOfServicePage, PrivacyPolicyPage and the FallbackPages, which pass no
 * PageBuilder options at all.
 */
export const resolveAvBlockComponent = ({ blockId, blockName, blockType }) => {
  const effectiveType = getEffectiveBlockType(blockId, blockName, blockType);
  // No AV rule matched — the caller renders itself.
  if (effectiveType === blockType) return null;
  return getAvSpecialBlockComponents()[effectiveType]?.component || null;
};

/**
 * Give a `blockType`-less block the `defaultBlock` type when an AV shorthand
 * applies to it.
 *
 * Upstream's BlockBuilder resolves the component with `components[block.blockType]`
 * and warns + renders nothing when that misses, so a CMS block relying purely on
 * an `av-*` blockId (or the `photoSlider ::` token) never reaches `AVBlockDefault`,
 * where the re-routing lives. Typing it `defaultBlock` puts it back on that path;
 * `resolveAvBlockComponent` then swaps in the real AV block.
 *
 * Blocks that already declare a type are returned untouched, and so is a
 * type-less block that no shorthand matches — that one is genuinely unknown and
 * keeps upstream's warning. Applied once per section in SectionBuilder, the choke
 * point every BlockBuilder call site passes through.
 *
 * @param {Array<Object>?} blocks - a section's block configs
 * @returns {Array<Object>?} the same array when nothing needed normalizing
 */
export const normalizeAvBlockTypes = blocks => {
  if (!Array.isArray(blocks)) return blocks;

  let didNormalize = false;
  const normalized = blocks.map(block => {
    if (!block || block.blockType) return block;
    const effectiveType = getEffectiveBlockType(block.blockId, block.blockName, block.blockType);
    if (!effectiveType) return block;
    didNormalize = true;
    return { ...block, blockType: 'defaultBlock' };
  });

  return didNormalize ? normalized : blocks;
};

// ---- Block-name tokens ----

/**
 * Whether a block name carries a given `<token> ::` flag.
 *
 * Tokens may appear anywhere in the name and in any order — that is what
 * docs/operator-guide.md §5.2 promises operators ("combine as many as you like,
 * in any order") — so this is a substring test, never a prefix one. Anything
 * outside this file that reacts to a token has to go through here too, or a
 * combined name like `smallerTitles :: social links ::` is read one way by one
 * caller and another way by the next.
 *
 * @param {string?} blockName - the block's Block Name field
 * @param {string} token - the token without its ` ::` suffix
 * @returns {boolean}
 */
export const hasBlockNameToken = (blockName, token) => !!blockName?.includes(`${token} ::`);

/**
 * The `social links ::` token, which both `AVBlockFooter` (renders the icons
 * inside the block) and `SectionFooter` (suppresses its own default icon row)
 * key off. They must agree, so both ask this.
 *
 * @param {string?} blockName - the block's Block Name field
 * @returns {boolean}
 */
export const hasSocialLinksToken = blockName => hasBlockNameToken(blockName, 'social links');

// ---- CTA token parsers ----

const buildBlockCtaBaseMap = css => ({
  blockCtaBtnBlue: css.ctaButtonBlue,
  blockCtaBtnLightBlue: css.ctaButtonLightBlue,
  blockCtaBtnPurple: css.ctaButtonPurple,
  blockCtaBtnPink: css.ctaButtonPink,
  blockCtaBtnYellow: css.ctaButtonYellow,
  blockCtaBtnSecondary: css.ctaButtonSecondary,
});

const buildBlockCtaModifierMap = css => ({
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
});

// Short-name tokens used inside cta1Style / cta2Style intl strings,
// e.g. "blue roundedFull solid".
const buildCtaStyleBaseMap = css => ({
  blue: css.ctaButtonBlue,
  lightBlue: css.ctaButtonLightBlue,
  purple: css.ctaButtonPurple,
  pink: css.ctaButtonPink,
  yellow: css.ctaButtonYellow,
  primary: css.ctaButtonPrimary,
  secondary: css.ctaButtonSecondary,
});

export const parseCtaStyleString = (styleStr, css) => {
  if (!styleStr?.trim()) return null;
  const baseMap = buildCtaStyleBaseMap(css);
  const modMap = buildBlockCtaModifierMap(css);
  const tokens = styleStr.trim().split(/\s+/);
  const classes = [];
  let hasBase = false;
  for (const token of tokens) {
    if (baseMap[token]) {
      classes.push(baseMap[token]);
      hasBase = true;
    } else if (modMap[token]) {
      classes.push(modMap[token]);
    }
  }
  if (!hasBase && classes.length) classes.unshift(css.ctaButton);
  return classes.length ? classNames(classes.filter(Boolean)) : null;
};

// Tokens written as "token ::" inside block.blockName,
// e.g. "blockCtaBtnBlue :: rounded :: dashed ::".
//
// Returns the base color class (or null when the block specifies only
// modifiers) and the list of modifier classes separately, so the caller can
// LAYER block modifiers onto a section-inherited base color instead of
// clobbering it. Position/border/font modifiers only set CSS vars and never
// imply a base color, so a modifier-only block (e.g. "ctaBtnCenter ::") keeps
// whatever base the section's `- SectionCtaBtn*` token provided.
export const parseBlockCtaClass = (blockName, css) => {
  if (!blockName) return null;
  const baseMap = buildBlockCtaBaseMap(css);
  const modMap = buildBlockCtaModifierMap(css);
  const tokens = [...blockName.matchAll(/(\S+)\s*::/g)].map(m => m[1]);
  if (!tokens.length) return null;
  let baseClass = null;
  const modifierClasses = [];
  for (const token of tokens) {
    if (baseMap[token]) {
      baseClass = baseMap[token];
    } else if (modMap[token]) {
      modifierClasses.push(modMap[token]);
    }
  }
  if (!baseClass && !modifierClasses.length) return null;
  return { baseClass, modifierClasses };
};

// Merge a parsed block CTA override onto the CTA class the section already
// supplies (`inheritedClass`, e.g. the blue from a `- SectionCtaBtnBlue` token).
// The block's own color token replaces the inherited base; modifiers always
// layer on top. Falls back to the neutral `css.ctaButton` only when nothing is
// inherited so a modifier-only block still renders a real button.
export const mergeBlockCtaClass = (override, inheritedClass, css) => {
  if (!override) return inheritedClass || null;
  const base = override.baseClass || inheritedClass || css.ctaButton;
  return classNames(base, ...override.modifierClasses) || null;
};

// ---- Per-block customProps ----

const getDefaultClassesForBlock = css => ({
  ctaButtonPrimary: css.ctaButtonPrimary,
  ctaButtonSecondary: css.ctaButtonSecondary,
});

// Walks block.blockName for "token ::" flags and returns the prop map that
// BlockBuilder spreads onto the rendered Block component. Each token here is
// documented in docs/operator-guide.md §5.2.
export const createBlockCustomProps = (block, intl, css) => {
  const DEFAULT_CLASSES = getDefaultClassesForBlock(css);
  const blockCustomProps = {};

  blockCustomProps.ctaButtonPrimaryClass = DEFAULT_CLASSES.ctaButtonPrimary;
  blockCustomProps.ctaButtonSecondaryClass = DEFAULT_CLASSES.ctaButtonSecondary;

  const hasToken = token => hasBlockNameToken(block.blockName, token);

  // 2Buttons :: — a two-button row below the block content.
  if (hasToken('2Buttons')) {
    const tb = 'TwoButtons.' + block.blockId;
    const cta1ClassName = parseCtaStyleString(fmt(intl, tb + '.cta1Style'), css);
    const cta2ClassName = parseCtaStyleString(fmt(intl, tb + '.cta2Style'), css);
    blockCustomProps.twoButtons = {
      titleEyebrow: fmt(intl, tb + '.titleEyebrow'),
      callToAction1: {
        fieldType: 'internalButtonLink',
        href: fmt(intl, tb + '.cta1Link', 'Hello'),
        content: fmt(intl, tb + '.cta1Text', 'Hello'),
      },
      callToAction2: {
        fieldType: 'internalButtonLink',
        href: fmt(intl, tb + '.cta2Link', 'Hello'),
        content: fmt(intl, tb + '.cta2Text', 'Hello'),
      },
      ...(cta1ClassName ? { cta1ClassName } : {}),
      ...(cta2ClassName ? { cta2ClassName } : {}),
    };
  }

  // Layout / text style flags.
  // mediaTitle :: — render media between the title and the rest of the content.
  if (hasToken('mediaTitle')) blockCustomProps.hasMediaTitle = true;
  // smallerTitles :: — mirror of the section-name token "- SmallerTitles".
  if (hasToken('smallerTitles')) blockCustomProps.hasSmallerTitles = true;
  // blueTitle :: — mirror of "- BlueTitle"; colors only this block's own title.
  if (hasToken('blueTitle')) blockCustomProps.hasBlueTitle = true;
  // fullLinks :: — keep links in the block's body P elements whole (never break a
  // word/URL mid-character; `word-break: keep-all`). A too-long link overflows at
  // full size rather than being split.
  if (hasToken('fullLinks')) blockCustomProps.hasFullLinks = true;
  // imgTop :: — anchor cropped block media to the top (object-position: top)
  // instead of the default center.
  if (hasToken('imgTop')) blockCustomProps.hasImgTop = true;
  if (hasToken('icon img')) blockCustomProps.hasIconImg = true;
  // social links :: — SectionFooter drops its own icon row when a block claims
  // them, so both sides read the token through `hasSocialLinksToken`.
  if (hasSocialLinksToken(block.blockName)) blockCustomProps.hasSocialLinks = true;
  if (hasToken('newsletter form')) {
    blockCustomProps.hasNewsletterForm = true;
    blockCustomProps.disclaimerText = fmt(intl, 'NewsletterForm.disclaimerText');
    blockCustomProps.okMsg = fmt(intl, 'NewsletterForm.successMessage');
    blockCustomProps.errorMsg = fmt(intl, 'NewsletterForm.errorMessage');
  }

  // photoSlider :: — 4-image carousel sourced from intl keys.
  if (hasToken('photoSlider')) {
    const ps = 'PhotoSlider.' + block.blockId;
    blockCustomProps.sliderImages = [
      fmt(intl, ps + '.image_1'),
      fmt(intl, ps + '.image_2'),
      fmt(intl, ps + '.image_3'),
      fmt(intl, ps + '.image_4'),
    ];
  }

  return blockCustomProps;
};

/**
 * All AV props for one block: the token-driven copy/layout props from
 * `createBlockCustomProps`, plus the CTA classes layered onto whatever the
 * section passed down.
 *
 * This used to run in upstream's BlockBuilder, once per block before the render
 * loop. It now runs inside the AV block component itself, which is what lets
 * BlockBuilder stay byte-identical to upstream.
 *
 * @param {Object} block - the block config (blockId, blockName, …)
 * @param {Object} intl - react-intl object, for the token-keyed microcopy
 * @param {Object} css - SectionBuilder.module.css, where the CTA classes live
 * @param {string?} inheritedCtaButtonClass - the section's own CTA class
 * @returns {Object} props to spread over the rendered block component
 */
export const buildAvBlockProps = (block, intl, css, inheritedCtaButtonClass) => {
  const customProps = createBlockCustomProps(block, intl, css);

  const blockCtaOverride = parseBlockCtaClass(block.blockName, css);
  if (blockCtaOverride) {
    // Layer the block's CTA tokens onto the section-inherited CTA class
    // (e.g. `- SectionCtaBtnBlue`): a block color token replaces the base,
    // while modifiers (position/border/font) layer on top and keep the
    // inherited color.
    customProps.ctaButtonClass = mergeBlockCtaClass(blockCtaOverride, inheritedCtaButtonClass, css);
    if (customProps.twoButtons) {
      if (!customProps.twoButtons.cta1ClassName)
        customProps.ctaButtonPrimaryClass = mergeBlockCtaClass(
          blockCtaOverride,
          customProps.ctaButtonPrimaryClass,
          css
        );
      if (!customProps.twoButtons.cta2ClassName)
        customProps.ctaButtonSecondaryClass = mergeBlockCtaClass(
          blockCtaOverride,
          customProps.ctaButtonSecondaryClass,
          css
        );
    }
  }

  const tokens = block.blockName ? [...block.blockName.matchAll(/(\S+)\s*::/g)].map(m => m[1]) : [];
  if (tokens.includes('ctaBtnCenter')) {
    customProps.ctaButtonWrapClass = css.ctaBtnCenterWrap;
  }

  return customProps;
};
