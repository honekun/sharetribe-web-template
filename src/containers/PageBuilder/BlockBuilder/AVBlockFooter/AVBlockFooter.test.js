import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render } from '../../../../util/testHelpers';

import BlockFooter from '../BlockFooter/BlockFooter';
import AVBlockFooter from './AVBlockFooter';

const text = { fieldType: 'markdown', content: 'Footer copy' };

describe('AVBlockFooter', () => {
  it('renders an untokenised footer block identically to upstream BlockFooter', () => {
    const props = { blockId: 'f1', blockType: 'footerBlock', text };

    const upstream = render(<BlockFooter {...props} />).container.innerHTML;
    const av = render(<AVBlockFooter {...props} />).container.innerHTML;

    expect(av).toEqual(upstream);
  });

  it('newsletter form :: renders the subscribe form', () => {
    const { container } = render(
      <AVBlockFooter
        blockId="f1"
        blockType="footerBlock"
        blockName="newsletter form ::"
        text={text}
      />
    );

    expect(container.querySelector('form')).toBeInTheDocument();
  });

  it('social links :: renders the nested link blocks', () => {
    const { getByRole } = render(
      <AVBlockFooter
        blockId="f1"
        blockType="footerBlock"
        blockName="social links ::"
        text={text}
        customProps={{
          socialLinks: [
            {
              blockId: 'sl1',
              blockType: 'socialMediaLink',
              link: {
                fieldType: 'socialMediaLink',
                platform: 'instagram',
                url: 'https://instagram.test/av',
              },
            },
          ],
        }}
      />
    );

    expect(getByRole('link')).toHaveAttribute('href', 'https://instagram.test/av');
  });

  it('ignores social links :: when the section supplied none', () => {
    const { container } = render(
      <AVBlockFooter blockId="f1" blockType="footerBlock" blockName="social links ::" text={text} />
    );

    expect(container.querySelector('a')).not.toBeInTheDocument();
  });
});
