import React from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { isNavPageHiddenForUser, storeSellerUserType } from '../../config/configAV';

/**
 * Returns the ordered tab list for the account settings side nav.
 *
 * `currentUser` comes from the store rather than from each page's
 * `accountSettingsNavProps`, so the per-userType tabs are the same on every
 * account page. Only ProfileSettingsPage used to pass the user type down, which
 * meant the store-seller profile label appeared on that one page alone.
 *
 * @param {Object} params
 * @param {string} params.currentPage - Active page name (e.g. 'ProfileSettingsPage')
 * @param {boolean} params.showPaymentMethods
 * @param {boolean} params.showPayoutDetails
 * @param {Object} [params.currentUser] - CurrentUser API entity
 * @returns {Array} Tab config objects for TabNav
 */
export const getAccountSettingsTabs = ({
  currentPage,
  showPaymentMethods,
  showPayoutDetails,
  currentUser,
}) => {
  const userType = currentUser?.attributes?.profile?.publicData?.userType;
  const profileTabLabelId =
    userType === storeSellerUserType
      ? 'LayoutWrapperAccountSettingsSideNav.profileTabTitleTienda'
      : 'LayoutWrapperAccountSettingsSideNav.profileTabTitle';

  // AV: store sellers ship from an origin address rather than receiving orders
  // at one, so the saved-address tab is hidden for them. Visibility only — the
  // page stays reachable at /account/my-addresses.
  const myAddressesMaybe = isNavPageHiddenForUser(currentUser, 'MyAddressesPage')
    ? []
    : [
        {
          text: <FormattedMessage id="LayoutWrapperAccountSettingsSideNav.myAddressesTabTitle" />,
          selected: currentPage === 'MyAddressesPage',
          id: 'MyAddressesPageTab',
          linkProps: { name: 'MyAddressesPage' },
        },
      ];

  const payoutDetailsMaybe = showPayoutDetails
    ? [
        {
          text: <FormattedMessage id="LayoutWrapperAccountSettingsSideNav.paymentsTabTitle" />,
          selected: currentPage === 'StripePayoutPage',
          id: 'StripePayoutPageTab',
          linkProps: { name: 'StripePayoutPage' },
        },
      ]
    : [];

  const paymentMethodsMaybe = showPaymentMethods
    ? [
        {
          text: (
            <FormattedMessage id="LayoutWrapperAccountSettingsSideNav.paymentMethodsTabTitle" />
          ),
          selected: currentPage === 'PaymentMethodsPage',
          id: 'PaymentMethodsPageTab',
          linkProps: { name: 'PaymentMethodsPage' },
        },
      ]
    : [];

  return [
    {
      text: <FormattedMessage id={profileTabLabelId} />,
      selected: currentPage === 'ProfileSettingsPage',
      id: 'ProfileSettingsPageTab',
      linkProps: { name: 'ProfileSettingsPage' },
    },
    {
      text: <FormattedMessage id="LayoutWrapperAccountSettingsSideNav.contactDetailsTabTitle" />,
      selected: currentPage === 'ContactDetailsPage',
      id: 'ContactDetailsPageTab',
      linkProps: { name: 'ContactDetailsPage' },
    },
    ...myAddressesMaybe,
    {
      text: <FormattedMessage id="LayoutWrapperAccountSettingsSideNav.shippingOriginTabTitle" />,
      selected: currentPage === 'ShippingOriginPage',
      id: 'ShippingOriginPageTab',
      linkProps: { name: 'ShippingOriginPage' },
    },
    {
      text: <FormattedMessage id="LayoutWrapperAccountSettingsSideNav.passwordTabTitle" />,
      selected: currentPage === 'PasswordChangePage',
      id: 'PasswordChangePageTab',
      linkProps: { name: 'PasswordChangePage' },
    },
    ...payoutDetailsMaybe,
    ...paymentMethodsMaybe,
    {
      text: <FormattedMessage id="LayoutWrapperAccountSettingsSideNav.manageAccountTabTitle" />,
      selected: currentPage === 'ManageAccountPage',
      id: 'ManageAccountPageTab',
      linkProps: { name: 'ManageAccountPage' },
    },
  ];
};
