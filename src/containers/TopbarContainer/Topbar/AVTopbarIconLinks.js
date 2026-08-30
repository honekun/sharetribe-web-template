import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { BagLink } from '../../../components';
import { AVInboxLink, FavoritesLink } from './TopbarDesktop/AVLinksMenu/AVTopbarLinks';

/**
 * AV: the bag / favorites / inbox icon trio, shared by the mobile topbar (beside
 * the search button, from --viewportSmall up) and the mobile menu footer.
 *
 * TopbarDesktop composes the same three links itself rather than through this
 * component — it interleaves them with the create-listing button and profile
 * menu in its own right group, so there is no trio to share there.
 *
 * Auth gating matches TopbarDesktop: favorites and inbox need a signed-in user,
 * the bag does not (it lives in localStorage). The `mounted` guard mirrors
 * TopbarDesktop's `authenticatedOnClientSide` — `isAuthenticated` is false
 * during SSR, so rendering the auth-only icons before mount would produce a
 * hydration mismatch.
 *
 * `bagPopupLayout` is forwarded to BagLink and decides whether this trio's bag
 * icon owns the (globally stateful) dropdown — see BagLink. The mobile topbar
 * passes 'mobile'; the mobile menu's footer copy passes nothing, because a
 * dropdown anchored inside an open modal is not a place to put one.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - layout class from the consuming topbar
 * @param {boolean} props.isAuthenticated
 * @param {number} [props.notificationCount]
 * @param {string} props.inboxTab
 * @param {'desktop'|'mobile'} [props.bagPopupLayout]
 * @returns {JSX.Element}
 */
const AVTopbarIconLinks = props => {
  const { className, isAuthenticated, notificationCount = 0, inboxTab, bagPopupLayout } = props;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const authenticatedOnClientSide = mounted && isAuthenticated;

  return (
    <div className={classNames(className)}>
      {authenticatedOnClientSide ? (
        <AVInboxLink notificationCount={notificationCount} inboxTab={inboxTab} />
      ) : null}
      {authenticatedOnClientSide ? <FavoritesLink /> : null}
      <BagLink popupLayout={bagPopupLayout} />
    </div>
  );
};

export default AVTopbarIconLinks;
