import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render } from '../../../../util/testHelpers';
import { getAvBlockComponents } from '../../../../extensions/pageBuilder/av/blocks';

import SectionFooter from './SectionFooter';

// The footer renders social icons from one of two places: its own row below the
// slogan, or a footer block carrying `social links ::`. Exactly one of them has
// to win, whatever else the block name says.

const socialMediaLinks = [
  {
    fieldType: 'socialMediaLink',
    blockType: 'socialMediaLink',
    link: { fieldType: 'socialMediaLink', platform: 'instagram', url: 'https://instagram.test/av' },
  },
];

const renderFooter = blocks =>
  render(
    <SectionFooter
      sectionId="footer"
      sectionType="footer"
      numberOfColumns={1}
      socialMediaLinks={socialMediaLinks}
      blocks={blocks}
      options={{ blockComponents: getAvBlockComponents() }}
    />
  );

const instagramLinkCount = container =>
  container.querySelectorAll('a[href="https://instagram.test/av"]').length;

describe('SectionFooter — social media links', () => {
  it('renders its own icon row when no block claims the links', () => {
    const { container } = renderFooter([
      { blockId: 'b1', blockType: 'footerBlock', blockName: 'smallerTitles ::' },
    ]);

    expect(instagramLinkCount(container)).toBe(1);
  });

  it('lets a "social links ::" block render them instead of doubling up', () => {
    const { container } = renderFooter([
      { blockId: 'b1', blockType: 'footerBlock', blockName: 'social links ::' },
    ]);

    expect(instagramLinkCount(container)).toBe(1);
  });

  it('still renders them once when the token follows another token', () => {
    // Block-name tokens combine in any order (operator guide §5.2). A prefix
    // match here used to leave the default row on while the block rendered its
    // own, showing every icon twice.
    const { container } = renderFooter([
      { blockId: 'b1', blockType: 'footerBlock', blockName: 'smallerTitles :: social links ::' },
    ]);

    expect(instagramLinkCount(container)).toBe(1);
  });

  it('renders no icons when the footer asset has no social media links', () => {
    const { container } = render(
      <SectionFooter
        sectionId="footer"
        sectionType="footer"
        numberOfColumns={1}
        blocks={[{ blockId: 'b1', blockType: 'footerBlock', blockName: 'social links ::' }]}
        options={{ blockComponents: getAvBlockComponents() }}
      />
    );

    expect(instagramLinkCount(container)).toBe(0);
  });
});
