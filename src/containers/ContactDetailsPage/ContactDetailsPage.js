import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { ensureCurrentUser } from '../../util/data';
import { showCreateListingLinkForUser, showPaymentDetailsForUser } from '../../util/userHelpers';

import { sendVerificationEmail } from '../../ducks/user.duck';
import { isScrollingDisabled } from '../../ducks/ui.duck';

import { H3, Page, UserNav, LayoutSideNavigation } from '../../components';

import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import ContactDetailsForm from './ContactDetailsForm/ContactDetailsForm';

import {
  saveContactDetails,
  saveContactDetailsClear,
  fetchMarketingPreference,
  resetPassword,
} from './ContactDetailsPage.duck';
import css from './ContactDetailsPage.module.css';

/**
 * @param {Object} props
 * @param {propTypes.error} [props.saveEmailError] - The save email error
 * @param {propTypes.error} [props.savePhoneNumberError] - The save phone number error
 * @param {boolean} [props.saveContactDetailsInProgress] - Whether the contact details are in progress
 * @param {propTypes.currentUser} [props.currentUser] - The current user
 * @param {boolean} [props.contactDetailsChanged] - Whether the contact details have changed
 * @param {Function} props.onChange - The change function
 * @param {boolean} props.scrollingDisabled - Whether the scrolling is disabled
 * @param {boolean} props.sendVerificationEmailInProgress - Whether the verification email is in progress
 * @param {propTypes.error} [props.sendVerificationEmailError] - The verification email error
 * @param {Function} props.onResendVerificationEmail - The resend verification email function
 * @param {Function} props.onSubmitContactDetails - The submit contact details function
 * @param {Function} props.onResetPassword - The reset password function
 * @param {boolean} [props.resetPasswordInProgress] - Whether the reset password is in progress
 * @param {propTypes.error} [props.resetPasswordError] - The reset password error
 * @returns {JSX.Element}
 */
export const ContactDetailsPageComponent = props => {
  const config = useConfiguration();
  const intl = useIntl();
  const {
    saveEmailError,
    savePhoneNumberError,
    saveMarketingPreferenceError,
    saveContactDetailsInProgress,
    currentUser,
    contactDetailsChanged,
    onChange,
    scrollingDisabled,
    sendVerificationEmailInProgress = false,
    sendVerificationEmailError,
    onResendVerificationEmail,
    onSubmitContactDetails,
    onResetPassword,
    resetPasswordInProgress = false,
    resetPasswordError,
    marketingPreference,
    marketingPreferenceLoading,
    onFetchMarketingPreference = () => Promise.resolve(),
  } = props;
  const { userTypes = [] } = config.user;

  const user = ensureCurrentUser(currentUser);
  const currentEmail = user.attributes.email || '';
  const publicData = user.attributes.profile.publicData || {};
  const userType = publicData?.userType;
  const protectedData = user.attributes.profile.protectedData || {};
  const currentPhoneNumber = protectedData.phoneNumber || '';
  const protectedMarketingConsent = protectedData.marketingConsent === true;
  const currentMarketingConsent =
    typeof marketingPreference === 'boolean' ? marketingPreference : protectedMarketingConsent;
  const userTypeConfig = userType && userTypes.find(config => config.userType === userType);
  const isPhoneNumberIncluded = userTypeConfig?.defaultUserFields?.phoneNumber !== false;
  // ContactDetailsForm decides if it's allowed to show the input field.
  const phoneNumberMaybe =
    isPhoneNumberIncluded && currentPhoneNumber ? { phoneNumber: currentPhoneNumber } : {};

  const handleSubmit = values => {
    const phoneNumber = values.phoneNumber ? values.phoneNumber : null;
    return onSubmitContactDetails({
      ...values,
      phoneNumber,
      currentEmail,
      currentPhoneNumber,
      currentMarketingConsent,
    });
  };

  useEffect(() => {
    if (user.id) {
      onFetchMarketingPreference().catch(() => {
        // The protected-data value remains a safe fallback if the local
        // preference service is temporarily unavailable.
      });
    }
  }, [user.id, onFetchMarketingPreference]);

  const contactInfoForm = user.id ? (
    <ContactDetailsForm
      className={css.form}
      keepDirtyOnReinitialize
      initialValues={{
        email: currentEmail,
        marketingConsent: currentMarketingConsent,
        ...phoneNumberMaybe,
      }}
      saveEmailError={saveEmailError}
      savePhoneNumberError={savePhoneNumberError}
      saveMarketingPreferenceError={saveMarketingPreferenceError}
      currentUser={currentUser}
      onResendVerificationEmail={onResendVerificationEmail}
      onResetPassword={onResetPassword}
      onSubmit={handleSubmit}
      onChange={onChange}
      inProgress={saveContactDetailsInProgress}
      ready={contactDetailsChanged}
      sendVerificationEmailInProgress={sendVerificationEmailInProgress}
      sendVerificationEmailError={sendVerificationEmailError}
      resetPasswordInProgress={resetPasswordInProgress}
      resetPasswordError={resetPasswordError}
      userTypeConfig={userTypeConfig}
      currentMarketingConsent={currentMarketingConsent}
      marketingPreferenceLoading={marketingPreferenceLoading}
    />
  ) : null;

  const title = intl.formatMessage({ id: 'ContactDetailsPage.title' });

  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'ContactDetailsPage',
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
              currentPage="ContactDetailsPage"
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
            <FormattedMessage id="ContactDetailsPage.heading" />
          </H3>
          {contactInfoForm}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

const mapStateToProps = state => {
  // Topbar needs user info.
  const { currentUser, sendVerificationEmailInProgress, sendVerificationEmailError } = state.user;
  const {
    saveEmailError,
    savePhoneNumberError,
    saveMarketingPreferenceError,
    saveContactDetailsInProgress,
    contactDetailsChanged,
    resetPasswordInProgress,
    resetPasswordError,
    marketingPreference,
    marketingPreferenceLoading,
  } = state.ContactDetailsPage;
  return {
    saveEmailError,
    savePhoneNumberError,
    saveMarketingPreferenceError,
    saveContactDetailsInProgress,
    currentUser,
    contactDetailsChanged,
    scrollingDisabled: isScrollingDisabled(state),
    sendVerificationEmailInProgress,
    sendVerificationEmailError,
    resetPasswordInProgress,
    resetPasswordError,
    marketingPreference,
    marketingPreferenceLoading,
  };
};

const mapDispatchToProps = dispatch => ({
  onChange: () => dispatch(saveContactDetailsClear()),
  onResendVerificationEmail: () => dispatch(sendVerificationEmail()),
  onSubmitContactDetails: values => dispatch(saveContactDetails(values)),
  onFetchMarketingPreference: () => dispatch(fetchMarketingPreference()),
  onResetPassword: values => dispatch(resetPassword(values)),
});

const ContactDetailsPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  ContactDetailsPageComponent
);

export default ContactDetailsPage;
