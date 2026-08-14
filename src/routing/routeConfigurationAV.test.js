import routeConfiguration from './routeConfiguration';
import { avRouteConfiguration } from './routeConfigurationAV';

// Guards the AV route extraction: the AV groups must stay spliced into the
// upstream route array at the documented positions (see routeConfigurationAV.js).
describe('avRouteConfiguration', () => {
  const routes = routeConfiguration({ listingPage: { variantType: 'carousel' } }, {});
  const names = routes.map(r => r.name);
  const groups = avRouteConfiguration();

  it('adds every AV route exactly once', () => {
    const avNames = [...groups.inboxRoutes, ...groups.accountRoutes, ...groups.tailRoutes].map(
      r => r.name
    );

    avNames.forEach(name => {
      expect(names.filter(n => n === name)).toHaveLength(1);
    });
  });

  it('keeps the AV groups at their splice points', () => {
    expect(names.indexOf('MyPurchasesPage')).toBe(names.indexOf('InboxPage') + 1);
    expect(names.indexOf('MyAddressesPage')).toBe(names.indexOf('ContactDetailsPage') + 1);
  });

  it('leaves /s to the real SearchPage', () => {
    expect(routes.filter(r => r.path === '/s')).toHaveLength(1);
    expect(routes.find(r => r.path === '/s').name).toBe('SearchPage');
  });
});
