/**
 * Export reducers from ducks modules of different containers (i.e. default export)
 * We are following Ducks module proposition:
 * https://github.com/erikras/ducks-modular-redux
 */
import CheckoutPage from './CheckoutPage/CheckoutPage.duck';
import shippingQuote from './CheckoutPage/shippingQuote.duck';
import CMSPage from './CMSPage/CMSPage.duck';
import ContactDetailsPage from './ContactDetailsPage/ContactDetailsPage.duck';
import EditListingPage from './EditListingPage/EditListingPage.duck';
import InboxPage from './InboxPage/InboxPage.duck';
import ListingPage from './ListingPage/ListingPage.duck';
import MakeOfferPage from './MakeOfferPage/MakeOfferPage.duck';
import ManageListingsPage from './ManageListingsPage/ManageListingsPage.duck';
import MyPurchasesPage from './MyPurchasesPage/MyPurchasesPage.duck';
import MyBalancePage from './MyBalancePage/MyBalancePage.duck';
import MySalesPage from './MySalesPage/MySalesPage.duck';
import FavoritesPage from './FavoritesPage/FavoritesPage.duck';
import PasswordChangePage from './PasswordChangePage/PasswordChangePage.duck';
import PasswordRecoveryPage from './PasswordRecoveryPage/PasswordRecoveryPage.duck';
import PasswordResetPage from './PasswordResetPage/PasswordResetPage.duck';
import PaymentMethodsPage from './PaymentMethodsPage/PaymentMethodsPage.duck';
import ManageAccountPage from './ManageAccountPage/ManageAccountPage.duck';
import ProfilePage from './ProfilePage/ProfilePage.duck';
import ProfileSettingsPage from './ProfileSettingsPage/ProfileSettingsPage.duck';
import RequestQuotePage from './RequestQuotePage/RequestQuotePage.duck';
import SearchPage from './SearchPage/SearchPage.duck';
import ShippingOriginPage from './ShippingOriginPage/ShippingOriginPage.duck';
import MyAddressesPage from './MyAddressesPage/MyAddressesPage.duck';
import StripePayoutPage from './StripePayoutPage/StripePayoutPage.duck';
import TransactionPage from './TransactionPage/TransactionPage.duck';

export {
  CheckoutPage,
  shippingQuote,
  CMSPage,
  ContactDetailsPage,
  EditListingPage,
  InboxPage,
  ListingPage,
  MakeOfferPage,
  ManageListingsPage,
  MyPurchasesPage,
  MyBalancePage,
  MySalesPage,
  FavoritesPage,
  PasswordChangePage,
  PasswordRecoveryPage,
  PasswordResetPage,
  PaymentMethodsPage,
  ManageAccountPage,
  ProfilePage,
  ProfileSettingsPage,
  RequestQuotePage,
  SearchPage,
  ShippingOriginPage,
  MyAddressesPage,
  StripePayoutPage,
  TransactionPage,
};
