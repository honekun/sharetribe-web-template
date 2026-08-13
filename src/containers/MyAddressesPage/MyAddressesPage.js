import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { ensureCurrentUser } from '../../util/data';
import { showCreateListingLinkForUser, showPaymentDetailsForUser } from '../../util/userHelpers';
import { isScrollingDisabled } from '../../ducks/ui.duck';

import { H3, Page, UserNav, LayoutSideNavigation } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import { shippingOriginFromValues, valuesFromShippingOrigin } from '../../util/shippingOrigin';

import MyAddressesForm from './MyAddressesForm';
import { saveAddress, saveAddressClear } from './MyAddressesPage.duck';
import css from './MyAddressesPage.module.css';

/**
 * Account settings page where a buyer stores a reusable shipping address. Saved to
 * `currentUser.profile.protectedData.shippingAddress` and auto-prefilled at checkout
 * to speed it up. Single address for now (shape is list-ready for the future).
 *
 * @param {Object} props
 * @param {propTypes.currentUser} [props.currentUser]
 * @param {boolean} props.scrollingDisabled
 * @param {boolean} [props.saveInProgress]
 * @param {Object} [props.saveError]
 * @param {boolean} [props.saveSuccess]
 * @param {Function} props.onSubmit
 * @param {Function} props.onChange
 */
export const MyAddressesPageComponent = props => {
  const config = useConfiguration();
  const intl = useIntl();
  const {
    currentUser,
    scrollingDisabled,
    saveInProgress = false,
    saveError = null,
    saveSuccess = false,
    onSubmit,
    onChange,
  } = props;

  const user = ensureCurrentUser(currentUser);
  const shippingAddress = user.attributes?.profile?.protectedData?.shippingAddress || {};

  // The form uses the granular checkout fields (recipient*); compose them into the
  // stored address on submit and seed the form from the stored address on load.
  const handleSubmit = values => onSubmit(shippingOriginFromValues(values));

  const form = user.id ? (
    <MyAddressesForm
      className={css.form}
      initialValues={valuesFromShippingOrigin(shippingAddress)}
      inProgress={saveInProgress}
      ready={saveSuccess}
      saveError={saveError}
      onSubmit={handleSubmit}
      onChange={onChange}
    />
  ) : null;

  const title = intl.formatMessage({ id: 'MyAddressesPage.title' });

  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'MyAddressesPage',
    showPaymentMethods,
    showPayoutDetails,
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation
        topbar={
          <>
            <TopbarContainer
              desktopClassName={css.desktopTopbar}
              mobileClassName={css.mobileTopbar}
            />
            <UserNav
              currentPage="MyAddressesPage"
              showManageListingsLink={showManageListingsLink}
            />
          </>
        }
        sideNav={null}
        useAccountSettingsNav
        accountSettingsNavProps={accountSettingsNavProps}
        footer={<FooterContainer />}
        intl={intl}
      >
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="MyAddressesPage.heading" />
          </H3>
          <p className={css.intro}>
            <FormattedMessage id="MyAddressesPage.intro" />
          </p>
          {form}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const { saveInProgress, saveError, saveSuccess } = state.MyAddressesPage;
  return {
    currentUser,
    scrollingDisabled: isScrollingDisabled(state),
    saveInProgress,
    saveError,
    saveSuccess,
  };
};

const mapDispatchToProps = dispatch => ({
  onSubmit: shippingAddress => dispatch(saveAddress(shippingAddress)),
  onChange: () => dispatch(saveAddressClear()),
});

const MyAddressesPage = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(MyAddressesPageComponent);

export default MyAddressesPage;
