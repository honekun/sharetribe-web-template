import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { createSlug } from '../../util/urlHelpers';
import { createResourceLocatorString, findRouteByRouteName } from '../../util/routes';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { removeFromBag, selectBagCount } from '../../ducks/bag.duck';
// Checkout state is seeded exactly like ListingPageCarousel: callSetInitialValues
// dispatches CheckoutPage's OWN setInitialValues (resolved via
// findRouteByRouteName), so do NOT import CheckoutPage.duck directly.
import { initializeCardPaymentData } from '../../ducks/stripe.duck.js';

import {
  AspectRatioWrapper,
  H2,
  IconSpinner,
  NamedLink,
  Page,
  LayoutSingleColumn,
  PrimaryButton,
  ResponsiveImage,
} from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import { loadBagThunk, listingRefRemoved } from './BagPage.duck';
import css from './BagPage.module.css';

// Navigate into the normal buy flow for one bag item. Mirrors handleSubmit in
// ListingPage.shared.js: when the delivery method is unambiguous we go straight
// to CheckoutPage; otherwise the user picks it on the listing page OrderPanel.
export const checkoutBagItem = ({
  listing,
  history,
  routes,
  currentUser,
  callSetInitialValues,
  onInitializeCardPaymentData,
}) => {
  const { shippingEnabled, pickupEnabled } = listing.attributes.publicData || {};
  const onlyMethod =
    shippingEnabled && !pickupEnabled
      ? 'shipping'
      : pickupEnabled && !shippingEnabled
      ? 'pickup'
      : null;

  const slug = createSlug(listing.attributes.title);

  if (!onlyMethod) {
    history.push(
      createResourceLocatorString('ListingPage', routes, { id: listing.id.uuid, slug }, {})
    );
    return;
  }

  const initialValues = {
    listing,
    orderData: { quantity: 1, deliveryMethod: onlyMethod },
    confirmPaymentError: null,
  };
  // Match ListingPage.shared.js: only persist to sessionStorage for logged-out users.
  const saveToSessionStorage = !currentUser;
  const { setInitialValues } = findRouteByRouteName('CheckoutPage', routes);
  callSetInitialValues(setInitialValues, initialValues, saveToSessionStorage);
  onInitializeCardPaymentData();
  history.push(
    createResourceLocatorString('CheckoutPage', routes, { id: listing.id.uuid, slug }, {})
  );
};

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
              {listings.map(l => {
                const firstImage = l.images?.[0];
                const slug = createSlug(l.attributes.title);
                return (
                  <li key={l.id.uuid} className={css.item}>
                    <NamedLink
                      name="ListingPage"
                      params={{ id: l.id.uuid, slug }}
                      className={css.itemImageLink}
                    >
                      <AspectRatioWrapper width={1} height={1} className={css.itemImageWrapper}>
                        <ResponsiveImage
                          rootClassName={css.itemImage}
                          alt={l.attributes.title}
                          image={firstImage}
                          variants={['listing-card', 'listing-card-2x']}
                          sizes="96px"
                        />
                      </AspectRatioWrapper>
                    </NamedLink>
                    <div className={css.itemInfo}>
                      <NamedLink
                        name="ListingPage"
                        params={{ id: l.id.uuid, slug }}
                        className={css.itemTitle}
                      >
                        {l.attributes.title}
                      </NamedLink>
                      <span className={css.itemPrice}>{formatMoney(intl, l.attributes.price)}</span>
                    </div>
                    <div className={css.itemActions}>
                      <PrimaryButton
                        type="button"
                        className={css.checkoutButton}
                        onClick={() =>
                          checkoutBagItem({
                            listing: l,
                            history,
                            routes,
                            currentUser,
                            callSetInitialValues,
                            onInitializeCardPaymentData,
                          })
                        }
                      >
                        <FormattedMessage id="BagPage.checkout" />
                      </PrimaryButton>
                      <button
                        type="button"
                        className={css.removeButton}
                        onClick={() => handleRemove(l.id.uuid)}
                      >
                        <FormattedMessage id="BagPage.remove" />
                      </button>
                    </div>
                  </li>
                );
              })}
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

const BagPage = compose(connect(mapStateToProps, mapDispatchToProps))(BagPageComponent);
export default BagPage;
