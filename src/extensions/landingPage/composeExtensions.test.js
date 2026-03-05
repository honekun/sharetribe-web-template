import { composeLandingPageExtensions } from './composeExtensions';

describe('composeLandingPageExtensions', () => {
  it('uses safe defaults for missing hooks', async () => {
    const api = composeLandingPageExtensions([{}]);
    const args = { pageData: { sections: [] } };

    await expect(api.loadDataExtension(args)).resolves.toBeUndefined();
    expect(api.selectExtensionProps(args)).toEqual({});
    expect(api.getPageBuilderOptions(args)).toBeUndefined();
    expect(api.transformPageData(args)).toEqual(args.pageData);
  });

  it('composes and merges data from multiple extensions', async () => {
    const hookA = {
      loadDataExtension: jest.fn(() => Promise.resolve()),
      selectExtensionProps: jest.fn(() => ({ a: 1 })),
      getPageBuilderOptions: jest.fn(() => ({
        sectionComponents: { first: { component: 'A' } },
        other: 'x',
      })),
      transformPageData: jest.fn(({ pageData }) => ({ ...pageData, markerA: true })),
    };
    const hookB = {
      loadDataExtension: jest.fn(() => Promise.resolve()),
      selectExtensionProps: jest.fn(() => ({ b: 2 })),
      getPageBuilderOptions: jest.fn(() => ({
        sectionComponents: { second: { component: 'B' } },
      })),
      transformPageData: jest.fn(({ pageData }) => ({ ...pageData, markerB: true })),
    };
    const api = composeLandingPageExtensions([hookA, hookB]);
    const args = { pageData: { sections: [] } };

    await api.loadDataExtension(args);
    expect(hookA.loadDataExtension).toHaveBeenCalledWith(args);
    expect(hookB.loadDataExtension).toHaveBeenCalledWith(args);

    expect(api.selectExtensionProps(args)).toEqual({ a: 1, b: 2 });
    expect(api.getPageBuilderOptions(args)).toEqual({
      sectionComponents: {
        first: { component: 'A' },
        second: { component: 'B' },
      },
      other: 'x',
    });
    expect(api.transformPageData(args)).toEqual({
      sections: [],
      markerA: true,
      markerB: true,
    });
  });
});
