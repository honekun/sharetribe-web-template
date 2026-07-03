import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { checkoutBagItem } from '../../util/bagCheckout';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { initializeCardPaymentData } from '../../ducks/stripe.duck.js';
import {
  bagPopupClosed,
  fetchBagListings,
  removeFromBag,
  selectBagCount,
  selectBagIds,
} from '../../ducks/bag.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { AVBagItemCard, NamedLink } from '../../components';

import css from './BagPopup.module.css';

/**
 * Bag dropdown anchored under the topbar bag icon (rendered inside BagLink).
 * Opens when an item is added to the bag; lists current bag contents as
 * AVBagItemCards with remove + per-item checkout, plus a "Go to bag" CTA.
 * No overlay — closes on outside click, Escape, or navigation.
 */
const BagPopup = () => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();
  const routes = useRouteConfiguration();
  const isOpen = useSelector(state => state.bag.isPopupOpen);
  const bagIds = useSelector(selectBagIds);
  const count = useSelector(selectBagCount);
  const currentUser = useSelector(state => state.user.currentUser);
  const [refs, setRefs] = useState([]);
  const listings = useSelector(state => getMarketplaceEntities(state, refs));
  const rootRef = useRef(null);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (isOpen && bagIds.length > 0) {
      // Deferred + caught so a fetch error (or a missing SDK in tests) can never
      // crash the popup — it just shows the heading/actions without thumbnails.
      Promise.resolve()
        .then(() => dispatch(fetchBagListings()))
        .then(listingRefs => setRefs(listingRefs || []))
        .catch(() => {});
    }
  }, [isOpen, bagIds.length, dispatch]);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onDocMouseDown = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        dispatch(bagPopupClosed());
      }
    };
    const onKeyDown = e => {
      if (e.key === 'Escape') {
        dispatch(bagPopupClosed());
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, dispatch]);

  // Close when the user navigates away (e.g. taps a listing/author link).
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      dispatch(bagPopupClosed());
    }
  }, [location.pathname, dispatch]);

  const onClose = () => dispatch(bagPopupClosed());

  const handleCheckout = listing => {
    onClose();
    checkoutBagItem({
      listing,
      history,
      routes,
      currentUser,
      callSetInitialValues: (setInitialValuesFn, values, saveToSessionStorage) =>
        dispatch(setInitialValuesFn(values, saveToSessionStorage)),
      onInitializeCardPaymentData: () => dispatch(initializeCardPaymentData()),
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={css.dropdown}
      ref={rootRef}
      role="dialog"
      aria-label={intl.formatMessage({ id: 'BagPopup.title' }, { count })}
    >
      <div className={css.header}>
        <h3 className={css.heading}>
          <FormattedMessage id="BagPopup.title" values={{ count }} />
        </h3>
        <button
          type="button"
          className={css.closeButton}
          onClick={onClose}
          aria-label={intl.formatMessage({ id: 'BagPopup.close' })}
        >
          ×
        </button>
      </div>

      <ul className={css.itemList}>
        {listings.map(l => (
          <AVBagItemCard
            key={l.id.uuid}
            listing={l}
            variant="popup"
            onRemove={listingId => dispatch(removeFromBag(listingId))}
            onCheckout={handleCheckout}
          />
        ))}
      </ul>

      <div className={css.actions}>
        <NamedLink name="BagPage" className={css.goToBag} onClick={onClose}>
          <FormattedMessage id="BagPopup.goToBag" />
        </NamedLink>
      </div>
    </div>
  );
};

export default BagPopup;
