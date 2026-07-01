import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { manageDisableScrolling } from '../../ducks/ui.duck';
import {
  bagPopupClosed,
  fetchBagListings,
  removeFromBag,
  selectBagIds,
} from '../../ducks/bag.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { Modal, NamedLink, ResponsiveImage } from '../../components';

import css from './BagPopup.module.css';

/**
 * Small modal shown when an item is added to the bag. Lists current bag
 * contents with remove buttons and a "Go to bag" CTA. Rendered globally by
 * TopbarContainer (same pattern as AVWelcomePopup).
 */
const BagPopup = () => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const isOpen = useSelector(state => state.bag.isPopupOpen);
  const bagIds = useSelector(selectBagIds);
  const [refs, setRefs] = useState([]);
  const listings = useSelector(state => getMarketplaceEntities(state, refs));

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

  const onClose = () => dispatch(bagPopupClosed());

  return (
    <Modal
      id="BagPopup"
      isOpen={isOpen}
      onClose={onClose}
      usePortal
      onManageDisableScrolling={(componentId, disableScrolling) =>
        dispatch(manageDisableScrolling(componentId, disableScrolling))
      }
    >
      <h3 className={css.heading}>
        <FormattedMessage id="BagPopup.addedToBag" />
      </h3>
      <ul className={css.itemList}>
        {listings.map(l => (
          <li key={l.id.uuid} className={css.item}>
            <ResponsiveImage
              rootClassName={css.itemImage}
              alt={l.attributes.title}
              image={l.images?.[0]}
              variants={['listing-card']}
              sizes="56px"
            />
            <div className={css.itemInfo}>
              <span className={css.itemTitle}>{l.attributes.title}</span>
              <span className={css.itemPrice}>{formatMoney(intl, l.attributes.price)}</span>
            </div>
            <button
              type="button"
              className={css.removeButton}
              onClick={() => dispatch(removeFromBag(l.id.uuid))}
              aria-label={intl.formatMessage({ id: 'BagPopup.remove' })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className={css.actions}>
        <NamedLink name="BagPage" className={css.goToBag} onClick={onClose}>
          <FormattedMessage id="BagPopup.goToBag" />
        </NamedLink>
        <button type="button" className={css.keepBrowsing} onClick={onClose}>
          <FormattedMessage id="BagPopup.keepBrowsing" />
        </button>
      </div>
    </Modal>
  );
};

export default BagPopup;
