import { composeLandingPageExtensions } from './composeExtensions';
import { landingPageExtensions } from './registry';

const extensionAPI = composeLandingPageExtensions(landingPageExtensions);

export const loadDataExtension = args => extensionAPI.loadDataExtension(args);

export const selectExtensionProps = args => extensionAPI.selectExtensionProps(args);

export const getPageBuilderOptions = args => extensionAPI.getPageBuilderOptions(args);

export const transformPageData = args => extensionAPI.transformPageData(args);
