import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render } from '../../../../util/testHelpers';
import { getAvBlockComponents } from '../../../../extensions/pageBuilder/av/blocks';

import BlockBuilder from '../BlockBuilder';
import BlockDefault from '../BlockDefault/BlockDefault';
import AVBlockDefault from './AVBlockDefault';

// AVBlockDefault stands in for upstream's `defaultBlock`. These tests pin two
// things: an untokenised block must still render exactly like upstream's
// BlockDefault, and each AV blockName token must reach the view.

const title = { fieldType: 'heading2', content: 'Block title' };
const text = { fieldType: 'markdown', content: 'Body copy' };
const callToAction = { fieldType: 'internalButtonLink', href: '/s', content: 'Browse' };

const media = {
  fieldType: 'image',
  alt: 'Block media',
  image: {
    id: 'image-id',
    type: 'imageAsset',
    attributes: {
      variants: { square: { url: 'https://cdn.test/media.jpg', width: 400, height: 400 } },
    },
  },
};

// Render a block the way BlockBuilder does, through the AV component map, so the
// options seam itself is covered rather than just the component.
const renderThroughBlockBuilder = (block, opts = {}) =>
  render(
    <BlockBuilder
      blocks={[block]}
      sectionId="s1"
      options={{ blockComponents: getAvBlockComponents() }}
      {...opts}
    />
  );

describe('AVBlockDefault — parity with upstream BlockDefault', () => {
  it('renders an untokenised block identically to upstream BlockDefault', () => {
    const props = { blockId: 'b1', blockType: 'defaultBlock', title, text, callToAction, media };

    const upstream = render(<BlockDefault {...props} />).container.innerHTML;
    const av = render(<AVBlockDefault {...props} />).container.innerHTML;

    expect(av).toEqual(upstream);
  });

  it('is what BlockBuilder resolves for defaultBlock via options.blockComponents', () => {
    const { getByText } = renderThroughBlockBuilder({
      blockId: 'b1',
      blockType: 'defaultBlock',
      blockName: 'blueTitle ::',
      title,
    });

    // The token only takes effect if AVBlockDefault (not BlockDefault) rendered.
    expect(getByText('Block title')).toHaveClass('blueTitle');
  });

  it('keeps the props the section passes down', () => {
    const { container, getByText } = render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        title={title}
        media={media}
        mediaClassName="sectionMedia"
        textClassName="sectionText"
        ctaButtonClass="sectionCta"
        callToAction={callToAction}
      />
    );

    expect(container.querySelector('.sectionMedia')).toBeInTheDocument();
    expect(container.querySelector('.sectionText')).toBeInTheDocument();
    expect(getByText('Browse')).toHaveClass('sectionCta');
  });
});

describe('AVBlockDefault — blockName tokens', () => {
  const renderWithToken = (blockName, extra = {}) =>
    render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        blockName={blockName}
        title={title}
        text={text}
        media={media}
        {...extra}
      />
    );

  it('blueTitle :: colors only the block title', () => {
    expect(renderWithToken('blueTitle ::').getByText('Block title')).toHaveClass('blueTitle');
  });

  it('smallerTitles :: drops the headings a level', () => {
    const { container } = renderWithToken('smallerTitles ::');
    expect(container.querySelector('.smallerTitles')).toBeInTheDocument();
  });

  it('fullLinks :: keeps body links unbroken', () => {
    const { container } = renderWithToken('fullLinks ::');
    expect(container.querySelector('.fullLinks')).toBeInTheDocument();
  });

  it('icon img :: slims the content and shrinks the media', () => {
    const { container } = renderWithToken('icon img ::');
    expect(container.querySelector('.slimContent')).toBeInTheDocument();
    expect(container.querySelector('.iconImg')).toBeInTheDocument();
  });

  it('imgTop :: anchors cropped media to the top', () => {
    const { container } = renderWithToken('imgTop ::');
    expect(container.querySelector('.imgTop')).toBeInTheDocument();
  });

  it('mediaTitle :: moves the media inside the text column', () => {
    const { container } = renderWithToken('mediaTitle ::');
    expect(container.querySelector('.mediaInTitle')).toBeInTheDocument();
  });

  it('mediaTitle :: still renders media when the block has no text fields', () => {
    const { container } = render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        blockName="mediaTitle ::"
        media={media}
      />
    );

    expect(container.querySelector('img')).toBeInTheDocument();
    expect(container.querySelector('.mediaInTitle')).not.toBeInTheDocument();
  });

  it('an untokenised blockName adds no token classes', () => {
    const { container } = renderWithToken('Just a human label');
    ['blueTitle', 'smallerTitles', 'fullLinks', 'slimContent', 'imgTop', 'mediaInTitle'].forEach(
      cls => expect(container.querySelector(`.${cls}`)).not.toBeInTheDocument()
    );
  });
});

describe('AVBlockDefault — two-button CTA row', () => {
  const messages = {
    'TwoButtons.b1.cta1Text': 'Primary',
    'TwoButtons.b1.cta1Link': '/one',
    'TwoButtons.b1.cta2Text': 'Secondary',
    'TwoButtons.b1.cta2Link': '/two',
    'TwoButtons.b1.titleEyebrow': 'Eyebrow',
  };

  it('2Buttons :: renders both CTAs and the eyebrow', () => {
    const { getByText } = render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        blockName="2Buttons ::"
        title={title}
      />,
      { messages }
    );

    expect(getByText('Primary')).toBeInTheDocument();
    expect(getByText('Secondary')).toBeInTheDocument();
    expect(getByText('Eyebrow')).toBeInTheDocument();
  });

  it('ctaBtnCenter :: centers the button row', () => {
    const { container } = render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        blockName="2Buttons :: ctaBtnCenter ::"
        title={title}
      />,
      { messages }
    );

    expect(container.querySelector('.ctaBtnCenterWrap')).toBeInTheDocument();
  });
});

describe('AVBlockDefault — CTA class layering', () => {
  it('a block color token replaces the section base', () => {
    const { getByText } = render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        blockName="blockCtaBtnBlue ::"
        title={title}
        callToAction={callToAction}
        ctaButtonClass="ctaButtonYellow"
      />
    );

    const cta = getByText('Browse');
    expect(cta).toHaveClass('ctaButtonBlue');
    expect(cta).not.toHaveClass('ctaButtonYellow');
  });

  it('a modifier-only token keeps the inherited color', () => {
    const { getByText } = render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        blockName="blockCtaBtnRounded ::"
        title={title}
        callToAction={callToAction}
        ctaButtonClass="ctaButtonYellow"
      />
    );

    expect(getByText('Browse')).toHaveClass('ctaButtonYellow');
  });

  it('leaves the section CTA class alone when the block has no CTA token', () => {
    const { getByText } = render(
      <AVBlockDefault
        blockId="b1"
        blockType="defaultBlock"
        blockName="blueTitle ::"
        title={title}
        callToAction={callToAction}
        ctaButtonClass="ctaButtonYellow"
      />
    );

    expect(getByText('Browse')).toHaveClass('ctaButtonYellow');
  });
});

describe('AVBlockDefault — re-routing to AV block components', () => {
  it('routes blockId "av-insta-feed" to the Instagram block', () => {
    const { container } = renderThroughBlockBuilder({
      blockId: 'av-insta-feed',
      blockType: 'defaultBlock',
      title,
    });

    // The Instagram block renders its own shell, not the default block's title.
    expect(container.textContent).not.toContain('Block title');
  });

  it('routes an "av-table-" blockId to the markdown table block', () => {
    const { container } = renderThroughBlockBuilder({
      blockId: 'av-table-pricing',
      blockType: 'defaultBlock',
      text: { fieldType: 'markdown', content: '| a | b |\n| --- | --- |\n| 1 | 2 |' },
    });

    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('routes "photoSlider ::" to the slider and uses the microcopy slides', () => {
    const { container } = renderThroughBlockBuilder(
      { blockId: 'b1', blockType: 'defaultBlock', blockName: 'photoSlider ::', media },
      {}
    );

    // Without PhotoSlider.* microcopy the slider falls back to the media field,
    // which ResponsiveImage renders as a srcset.
    expect(container.querySelector('img[srcset]')).toBeInTheDocument();
  });

  it('uses the configured slides when the PhotoSlider microcopy is set', () => {
    const { container } = render(
      <BlockBuilder
        blocks={[{ blockId: 'b1', blockType: 'defaultBlock', blockName: 'photoSlider ::', media }]}
        sectionId="s1"
        options={{ blockComponents: getAvBlockComponents() }}
      />,
      { messages: { 'PhotoSlider.b1.image_1': 'https://cdn.test/slide1.jpg' } }
    );

    const sources = Array.from(container.querySelectorAll('img')).map(i => i.getAttribute('src'));
    expect(sources).toContain('https://cdn.test/slide1.jpg');
  });

  it('gives the slider the section and token media classes the media field gets', () => {
    // The slider stands in for the media field, so anything that would have
    // styled that field has to reach it too.
    const { container } = render(
      <BlockBuilder
        blocks={[
          {
            blockId: 'b1',
            blockType: 'defaultBlock',
            blockName: 'photoSlider :: imgTop ::',
            media,
          },
        ]}
        sectionId="s1"
        mediaClassName="sectionMedia"
        options={{ blockComponents: getAvBlockComponents() }}
      />,
      { messages: { 'PhotoSlider.b1.image_1': 'https://cdn.test/slide1.jpg' } }
    );

    const slider = container.querySelector('.sliderWrapper');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveClass('sectionMedia');
    expect(slider).toHaveClass('imgTop');
  });

  it('does not re-route an ordinary block', () => {
    const { getByText } = renderThroughBlockBuilder({
      blockId: 'b1',
      blockType: 'defaultBlock',
      title,
    });

    expect(getByText('Block title')).toBeInTheDocument();
  });
});
