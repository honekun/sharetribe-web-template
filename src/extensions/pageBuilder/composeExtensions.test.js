import { composePageBuilderExtensions } from './composeExtensions';

describe('composePageBuilderExtensions', () => {
  it('uses safe defaults for missing hooks', () => {
    const api = composePageBuilderExtensions([{}]);
    const args = { pageData: { sections: [] } };

    expect(api.getPageBuilderOptions(args)).toBeUndefined();
    expect(api.transformPageData(args)).toEqual(args.pageData);
  });

  it('merges sectionComponents and blockComponents from multiple extensions', () => {
    const hookA = {
      getPageBuilderOptions: jest.fn(() => ({
        sectionComponents: { first: { component: 'A' } },
        blockComponents: { blockA: { component: 'BA' } },
        other: 'x',
      })),
      transformPageData: jest.fn(({ pageData }) => ({ ...pageData, markerA: true })),
    };
    const hookB = {
      getPageBuilderOptions: jest.fn(() => ({
        sectionComponents: { second: { component: 'B' } },
        blockComponents: { blockB: { component: 'BB' } },
      })),
      transformPageData: jest.fn(({ pageData }) => ({ ...pageData, markerB: true })),
    };
    const api = composePageBuilderExtensions([hookA, hookB]);
    const args = { pageData: { sections: [] } };

    expect(api.getPageBuilderOptions(args)).toEqual({
      sectionComponents: {
        first: { component: 'A' },
        second: { component: 'B' },
      },
      // Merged, not overwritten — hookB must not drop hookA's block.
      blockComponents: {
        blockA: { component: 'BA' },
        blockB: { component: 'BB' },
      },
      other: 'x',
    });

    expect(api.transformPageData(args)).toEqual({
      sections: [],
      markerA: true,
      markerB: true,
    });
  });

  it('lets a later extension override an earlier block of the same type', () => {
    const api = composePageBuilderExtensions([
      { getPageBuilderOptions: () => ({ blockComponents: { shared: { component: 'first' } } }) },
      { getPageBuilderOptions: () => ({ blockComponents: { shared: { component: 'second' } } }) },
    ]);

    expect(api.getPageBuilderOptions({}).blockComponents).toEqual({
      shared: { component: 'second' },
    });
  });
});
