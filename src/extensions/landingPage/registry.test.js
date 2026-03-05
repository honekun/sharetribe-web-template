import { avLandingPageExtension } from './av/index';
import { noopLandingPageExtension } from './noop';
import { landingPageExtensions } from './registry';

describe('landingPage extension registry', () => {
  it('registers noop then AV extension', () => {
    expect(landingPageExtensions).toEqual([noopLandingPageExtension, avLandingPageExtension]);
  });
});
