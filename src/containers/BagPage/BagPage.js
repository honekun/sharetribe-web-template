import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { checkoutBagItem } from '../../util/bagCheckout';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { removeFromBag, selectBagCount } from '../../ducks/bag.duck';
// Checkout state is seeded exactly like ListingPageCarousel: callSetInitialValues
// dispatches CheckoutPage's OWN setInitialValues (resolved via
// findRouteByRouteName inside checkoutBagItem), so do NOT import CheckoutPage.duck.
import { initializeCardPaymentData } from '../../ducks/stripe.duck.js';

import { AVBagItemCard, H2, IconSpinner, Page, LayoutSingleColumn } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import { loadBagThunk, listingRefRemoved } from './BagPage.duck';
import css from './BagPage.module.css';

export const BagPageComponent = props => {
  const {
    listings,
    fetchInProgress,
    fetchError,
    scrollingDisabled,
    hydrated,
    bagCount,
    currentUser,
    callSetInitialValues,
    onInitializeCardPaymentData,
  } = props;
  const intl = useIntl();
  const dispatch = useDispatch();
  const history = useHistory();
  const routes = useRouteConfiguration();

  // Fetch listing data once the bag is hydrated and actually has items — an empty
  // bag needs no query (and avoids a needless in-progress flash).
  useEffect(() => {
    if (hydrated && bagCount > 0) {
      dispatch(loadBagThunk());
    }
  }, [hydrated, bagCount, dispatch]);

  const handleRemove = listingId => {
    dispatch(removeFromBag(listingId));
    dispatch(listingRefRemoved(listingId));
  };

  const title = intl.formatMessage({ id: 'BagPage.title' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <div className={css.content}>
          <H2 as="h1" className={css.heading}>
            <FormattedMessage id="BagPage.heading" />
          </H2>

          {fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="BagPage.fetchError" />
            </p>
          ) : null}

          {fetchInProgress ? (
            <IconSpinner />
          ) : listings.length === 0 && !fetchError ? (
            <p className={css.empty}>
              <FormattedMessage id="BagPage.empty" />
            </p>
          ) : (
            <ul className={css.itemList}>
              {listings.map(l => (
                <AVBagItemCard
                  key={l.id.uuid}
                  listing={l}
                  onRemove={handleRemove}
                  onCheckout={listing =>
                    checkoutBagItem({
                      listing,
                      history,
                      routes,
                      currentUser,
                      callSetInitialValues,
                      onInitializeCardPaymentData,
                    })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { listingRefs, fetchInProgress, fetchError } = state.BagPage;
  return {
    listings: getMarketplaceEntities(state, listingRefs),
    fetchInProgress,
    fetchError,
    hydrated: state.bag.hydrated,
    bagCount: selectBagCount(state),
    currentUser: state.user.currentUser,
    scrollingDisabled: isScrollingDisabled(state),
  };
};

// Mirrors ListingPageCarousel.js:425-427 — callSetInitialValues dispatches
// CheckoutPage's own setInitialValues fn (resolved via findRouteByRouteName in
// checkoutBagItem), seeding checkout state the same way the normal buy flow does.
const mapDispatchToProps = dispatch => ({
  callSetInitialValues: (setInitialValuesFn, values, saveToSessionStorage) =>
    dispatch(setInitialValuesFn(values, saveToSessionStorage)),
  onInitializeCardPaymentData: () => dispatch(initializeCardPaymentData()),
});

const BagPage = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(BagPageComponent);
export default BagPage;
