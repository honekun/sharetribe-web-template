import { avLandingPageExtension } from './av/index';
import { noopLandingPageExtension } from './noop';

export const landingPageExtensions = [noopLandingPageExtension, avLandingPageExtension];
