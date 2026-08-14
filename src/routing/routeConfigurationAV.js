import loadable from '@loadable/component';

import getPageDataLoadingAPI from '../containers/pageDataLoadingAPI';

// AV: Archivo Vintach route additions.
//
// Kept out of the upstream `routeConfiguration.js` so that file stays as close to
// `sharetribe/web-template` as possible and upstream merges stay conflict-free.
// `routeConfiguration.js` only imports `avRouteConfiguration()` and spreads the
// three returned groups into its route array at the positions where they belong.
//
// `tailRoutes` is currently empty. It is kept so the splice point at the end of
// the upstream route array stays available without another edit to that file.

const pageDataLoadingAPI = getPageDataLoadingAPI();

// AV: redesigned carousel listing page (drop-in for the carousel variant).
export const AVListingPageCarousel = loadable(() =>
  import(
    /* webpackChunkName: "AVListingPageCarousel" */ /* webpackPrefetch: true */ '../containers/ListingPage/AVListingPageCarousel'
  )
);

const ShippingOriginPage = loadable(() =>
  import(
    /* webpackChunkName: "ShippingOriginPage" */ '../containers/ShippingOriginPage/ShippingOriginPage'
  )
);
const MyAddressesPage = loadable(() =>
  import(/* webpackChunkName: "MyAddressesPage" */ '../containers/MyAddressesPage/MyAddressesPage')
);
const MyPurchasesPage = loadable(() =>
  import(/* webpackChunkName: "MyPurchasesPage" */ '../containers/MyPurchasesPage/MyPurchasesPage')
);
const MyBalancePage = loadable(() =>
  import(/* webpackChunkName: "MyBalancePage" */ '../containers/MyBalancePage/MyBalancePage')
);
const BulkImportPage = loadable(() =>
  import(/* webpackChunkName: "BulkImportPage" */ '../containers/BulkImportPage/BulkImportPage')
);
const MySalesPage = loadable(() =>
  import(/* webpackChunkName: "MySalesPage" */ '../containers/MySalesPage/MySalesPage')
);
const FavoritesPage = loadable(() =>
  import(/* webpackChunkName: "FavoritesPage" */ '../containers/FavoritesPage/FavoritesPage')
);
const BagPage = loadable(() =>
  import(/* webpackChunkName: "BagPage" */ '../containers/BagPage/BagPage')
);
const CreateTypePage = loadable(() =>
  import(/* webpackChunkName: "CreateTypePage" */ '../containers/CreateTypePage/CreateTypePage')
);

/**
 * AV route groups, keyed by where they are spliced into the upstream route array.
 *
 * @returns {{ inboxRoutes: Array, accountRoutes: Array, tailRoutes: Array }}
 */
export const avRouteConfiguration = () => ({
  // Spliced in right after the upstream InboxPage route.
  inboxRoutes: [
    {
      path: '/my-purchases',
      name: 'MyPurchasesPage',
      auth: true,
      authPage: 'LoginPage',
      component: MyPurchasesPage,
      loadData: pageDataLoadingAPI.MyPurchasesPage.loadData,
    },
    {
      path: '/my-sales',
      name: 'MySalesPage',
      auth: true,
      authPage: 'LoginPage',
      component: MySalesPage,
      loadData: pageDataLoadingAPI.MySalesPage.loadData,
    },
    {
      path: '/my-balance',
      name: 'MyBalancePage',
      auth: true,
      authPage: 'LoginPage',
      component: MyBalancePage,
      loadData: pageDataLoadingAPI.MyBalancePage.loadData,
    },
    {
      path: '/favorites',
      name: 'FavoritesPage',
      auth: true,
      authPage: 'LoginPage',
      component: FavoritesPage,
      loadData: pageDataLoadingAPI.FavoritesPage.loadData,
    },
    {
      // Public: the bag lives in localStorage, so no auth and no loadData
      // (the page fetches client-side after hydration).
      path: '/bag',
      name: 'BagPage',
      component: BagPage,
    },
    {
      path: '/admin/bulk-import',
      name: 'BulkImportPage',
      auth: true,
      authPage: 'LoginPage',
      component: BulkImportPage,
    },
    {
      // Chooser between single-listing creation and bulk ZIP import;
      // the topbar VENDE (create listing) button points here.
      path: '/create-type',
      name: 'CreateTypePage',
      auth: true,
      authPage: 'LoginPage',
      component: CreateTypePage,
      loadData: pageDataLoadingAPI.CreateTypePage.loadData,
    },
  ],

  // Spliced in right after the upstream ContactDetailsPage route.
  accountRoutes: [
    {
      path: '/account/my-addresses',
      name: 'MyAddressesPage',
      auth: true,
      authPage: 'LoginPage',
      component: MyAddressesPage,
      loadData: pageDataLoadingAPI.MyAddressesPage.loadData,
    },
    {
      path: '/account/shipping-origin',
      name: 'ShippingOriginPage',
      auth: true,
      authPage: 'LoginPage',
      component: ShippingOriginPage,
      loadData: pageDataLoadingAPI.ShippingOriginPage.loadData,
    },
  ],

  // Appended last — see the note above.
  tailRoutes: [],
});
