export const loadDataExtension = () => Promise.resolve();

export const selectExtensionProps = () => ({ hasCustomSections: false });

export const getPageBuilderOptions = () => undefined;

export const transformPageData = ({ pageData }) => pageData;

export const noopLandingPageExtension = {
  loadDataExtension,
  selectExtensionProps,
  getPageBuilderOptions,
  transformPageData,
};
