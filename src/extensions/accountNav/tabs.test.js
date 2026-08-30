import { getAccountSettingsTabs } from './tabs';

const userWith = userType => ({
  attributes: { profile: { publicData: { userType } } },
});

const tabIdsFor = (currentUser, overrides = {}) =>
  getAccountSettingsTabs({
    currentPage: 'ProfileSettingsPage',
    showPaymentMethods: false,
    showPayoutDetails: false,
    currentUser,
    ...overrides,
  }).map(tab => tab.id);

const labelIdOf = tab => tab.text.props.id;

describe('getAccountSettingsTabs', () => {
  it('returns the full tab list for a regular seller', () => {
    expect(tabIdsFor(userWith('vendedor'))).toEqual([
      'ProfileSettingsPageTab',
      'ContactDetailsPageTab',
      'MyAddressesPageTab',
      'ShippingOriginPageTab',
      'PasswordChangePageTab',
      'ManageAccountPageTab',
    ]);
  });

  it('appends the payout and payment-method tabs when they are enabled', () => {
    const ids = tabIdsFor(userWith('vendedor'), {
      showPaymentMethods: true,
      showPayoutDetails: true,
    });

    expect(ids).toEqual([
      'ProfileSettingsPageTab',
      'ContactDetailsPageTab',
      'MyAddressesPageTab',
      'ShippingOriginPageTab',
      'PasswordChangePageTab',
      'StripePayoutPageTab',
      'PaymentMethodsPageTab',
      'ManageAccountPageTab',
    ]);
  });

  it('hides the saved-address tab from store sellers', () => {
    const ids = tabIdsFor(userWith('vendedor-tienda'));

    expect(ids).not.toContain('MyAddressesPageTab');
    // Only that one tab goes; the shipping-origin tab they do use stays.
    expect(ids).toContain('ShippingOriginPageTab');
    expect(ids).toEqual([
      'ProfileSettingsPageTab',
      'ContactDetailsPageTab',
      'ShippingOriginPageTab',
      'PasswordChangePageTab',
      'ManageAccountPageTab',
    ]);
  });

  it('keeps the saved-address tab when there is no signed-in user yet', () => {
    expect(tabIdsFor(null)).toContain('MyAddressesPageTab');
    expect(tabIdsFor(undefined)).toContain('MyAddressesPageTab');
  });

  it('marks the current page as selected', () => {
    const tabs = getAccountSettingsTabs({
      currentPage: 'ContactDetailsPage',
      showPaymentMethods: false,
      showPayoutDetails: false,
      currentUser: userWith('vendedor'),
    });

    const selected = tabs.filter(tab => tab.selected).map(tab => tab.id);
    expect(selected).toEqual(['ContactDetailsPageTab']);
  });

  // The label used to depend on ProfileSettingsPage passing `userType` down, so
  // it was generic on every other account page. It now comes from the user.
  it('uses the store-seller profile label on every account page', () => {
    ['ProfileSettingsPage', 'ContactDetailsPage', 'PasswordChangePage'].forEach(currentPage => {
      const tabs = getAccountSettingsTabs({
        currentPage,
        showPaymentMethods: false,
        showPayoutDetails: false,
        currentUser: userWith('vendedor-tienda'),
      });

      expect(labelIdOf(tabs[0])).toBe('LayoutWrapperAccountSettingsSideNav.profileTabTitleTienda');
    });
  });

  it('uses the generic profile label for other user types', () => {
    const tabs = getAccountSettingsTabs({
      currentPage: 'ProfileSettingsPage',
      showPaymentMethods: false,
      showPayoutDetails: false,
      currentUser: userWith('vendedor'),
    });

    expect(labelIdOf(tabs[0])).toBe('LayoutWrapperAccountSettingsSideNav.profileTabTitle');
  });
});
