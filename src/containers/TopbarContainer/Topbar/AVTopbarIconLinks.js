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
 * @component
 * @param {Object} props
 * @param {string} [props.className] - layout class from the consuming topbar
 * @param {boolean} props.isAuthenticated
 * @param {number} [props.notificationCount]
 * @param {string} props.inboxTab
 * @returns {JSX.Element}
 */
const AVTopbarIconLinks = props => {
  const { className, isAuthenticated, notificationCount = 0, inboxTab } = props;
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
      <BagLink />
    </div>
  );
};

export default AVTopbarIconLinks;
