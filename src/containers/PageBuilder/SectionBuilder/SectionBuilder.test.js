import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render } from '../../../util/testHelpers';

import SectionBuilder from './SectionBuilder';

// SectionBuilder is the AV choke point: it injects the AV block components and
// normalizes blockType-less blocks before upstream's BlockBuilder selects on
// `blockType`. These tests cover that seam end to end.

const tableText = {
  fieldType: 'markdown',
  content: '| Fee | Amount |\n| --- | --- |\n| Commission | 10% |',
};

const renderSection = (section, options) =>
  render(<SectionBuilder sections={[section]} options={options} />);

const columnsSection = blocks => ({
  sectionType: 'columns',
  sectionId: 'sec-1',
  numColumns: 1,
  blocks,
});

describe('SectionBuilder — AV block type normalization', () => {
  it('renders a shorthand blockId block that carries no blockType', () => {
    const { getByText } = renderSection({
      sectionType: 'columns',
      sectionId: 'sec-1',
      numColumns: 1,
      blocks: [{ blockId: 'av-table-fees', text: tableText }],
    });

    // Reached AVBlockDefault, which re-routed to BlockMarkdownTable.
    expect(getByText('Commission')).toBeInTheDocument();
  });

  it('renders the same block when the CMS does set blockType', () => {
    const { getByText } = renderSection({
      sectionType: 'columns',
      sectionId: 'sec-1',
      numColumns: 1,
      blocks: [{ blockId: 'av-table-fees', blockType: 'defaultBlock', text: tableText }],
    });

    expect(getByText('Commission')).toBeInTheDocument();
  });

  it('still warns and renders nothing for a type-less block with no shorthand', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { queryByText } = renderSection({
      sectionType: 'columns',
      sectionId: 'sec-1',
      numColumns: 1,
      blocks: [{ blockId: 'regular-block', text: tableText }],
    });

    expect(queryByText('Commission')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown block type'));

    warn.mockRestore();
  });

  it('renders a section that has no blocks at all', () => {
    const { getByText } = renderSection({
      sectionType: 'article',
      sectionId: 'sec-1',
      title: { fieldType: 'heading1', content: 'No blocks here' },
    });

    expect(getByText('No blocks here')).toBeInTheDocument();
  });
});

describe('SectionBuilder — AV block component registration', () => {
  // Every assertion here renders SectionBuilder the way ToS/Privacy/Fallback
  // pages do — with no blockComponents of its own — so a broken injection at the
  // top of SectionBuilder fails these rather than being papered over by a test
  // that hands getAvBlockComponents() in itself.

  it('routes defaultBlock to AVBlockDefault when the caller passes no options', () => {
    const { getByText } = renderSection(
      columnsSection([
        {
          blockId: 'b1',
          blockType: 'defaultBlock',
          blockName: 'blueTitle ::',
          title: { fieldType: 'heading2', content: 'Block title' },
        },
      ])
    );

    // Upstream's BlockDefault knows nothing about blockName tokens, so the
    // class only appears if the AV component was the one registered.
    expect(getByText('Block title')).toHaveClass('blueTitle');
  });

  it('routes footerBlock to AVBlockFooter when the caller passes no options', () => {
    const { container } = renderSection({
      sectionType: 'footer',
      sectionId: 'footer',
      numberOfColumns: 1,
      socialMediaLinks: [
        {
          fieldType: 'socialMediaLink',
          blockType: 'socialMediaLink',
          link: {
            fieldType: 'socialMediaLink',
            platform: 'instagram',
            url: 'https://instagram.test/av',
          },
        },
      ],
      blocks: [{ blockId: 'f1', blockType: 'footerBlock', blockName: 'social links ::' }],
    });

    // Upstream's BlockFooter ignores the token, and SectionFooter has already
    // stood its own icon row down, so this is 0 unless AVBlockFooter rendered.
    expect(container.querySelectorAll('a[href="https://instagram.test/av"]')).toHaveLength(1);
  });

  it('still registers the AV blocks when the caller passes unrelated options', () => {
    const { getByText } = renderSection(
      columnsSection([{ blockId: 'av-table-fees', text: tableText }]),
      {
        fieldComponents: {},
        isInsideContainer: true,
      }
    );

    expect(getByText('Commission')).toBeInTheDocument();
  });

  it('lets a caller-supplied blockComponents entry win over the AV one', () => {
    const StubBlock = ({ blockId }) => <div data-testid="stub-block">stub for {blockId}</div>;

    const { getByTestId, queryByText } = renderSection(
      columnsSection([{ blockId: 'av-table-fees', blockType: 'defaultBlock', text: tableText }]),
      { blockComponents: { defaultBlock: { component: StubBlock } } }
    );

    expect(getByTestId('stub-block')).toHaveTextContent('stub for av-table-fees');
    expect(queryByText('Commission')).toBeNull();
  });

  it('keeps the AV blocks the caller did not override', () => {
    const StubFooterBlock = () => <div data-testid="stub-footer-block" />;

    // Overriding footerBlock must not drop AV's defaultBlock alongside it.
    const { getByText } = renderSection(
      columnsSection([
        {
          blockId: 'b1',
          blockType: 'defaultBlock',
          blockName: 'blueTitle ::',
          title: { fieldType: 'heading2', content: 'Block title' },
        },
      ]),
      { blockComponents: { footerBlock: { component: StubFooterBlock } } }
    );

    expect(getByText('Block title')).toHaveClass('blueTitle');
  });
});
