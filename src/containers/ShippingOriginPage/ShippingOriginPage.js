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

import ShippingOriginForm from './ShippingOriginForm';
import { saveShippingOrigin, saveShippingOriginClear } from './ShippingOriginPage.duck';
import css from './ShippingOriginPage.module.css';

/**
 * Account settings page where a seller stores their origin shipping address.
 * Read server-side (via the trusted SDK) to quote eShip from the seller's location.
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
export const ShippingOriginPageComponent = props => {
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
  const shippingOrigin = user.attributes?.profile?.protectedData?.shippingOrigin || {};

  // The form uses the granular checkout fields (recipient*); compose them into the
  // stored origin on submit and seed the form from the stored origin on load.
  const handleSubmit = values => onSubmit(shippingOriginFromValues(values));

  const form = user.id ? (
    <ShippingOriginForm
      className={css.form}
      initialValues={valuesFromShippingOrigin(shippingOrigin)}
      inProgress={saveInProgress}
      ready={saveSuccess}
      saveError={saveError}
      onSubmit={handleSubmit}
      onChange={onChange}
    />
  ) : null;

  const title = intl.formatMessage({ id: 'ShippingOriginPage.title' });

  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);
  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'ShippingOriginPage',
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
              currentPage="ShippingOriginPage"
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
            <FormattedMessage id="ShippingOriginPage.heading" />
          </H3>
          <p className={css.intro}>
            <FormattedMessage id="ShippingOriginPage.intro" />
          </p>
          {form}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const { saveInProgress, saveError, saveSuccess } = state.ShippingOriginPage;
  return {
    currentUser,
    scrollingDisabled: isScrollingDisabled(state),
    saveInProgress,
    saveError,
    saveSuccess,
  };
};

const mapDispatchToProps = dispatch => ({
  onSubmit: shippingOrigin => dispatch(saveShippingOrigin(shippingOrigin)),
  onChange: () => dispatch(saveShippingOriginClear()),
});

const ShippingOriginPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  ShippingOriginPageComponent
);

export default ShippingOriginPage;
