import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import { syncFavoritesFromUser } from '../../ducks/favorites.duck';
import { hydrateBag } from '../../ducks/bag.duck';
import { canShowWelcomePopup, welcomePopupSuppressedPaths } from '../../config/configAV';
import AVWelcomePopup from '../../components/AVWelcomePopup';

/**
 * The AV side-effects and overlay that ride along with the Topbar.
 *
 * TopbarContainer is on every page, which makes it the natural home for
 * session-wide hydration — but all of it lived inline there, so upstream's
 * ~25-line container carried ~80 lines of AV code. It renders this instead.
 *
 * Takes TopbarContainer's own props (it is rendered as `<AVTopbarExtras {...props} />`).
 *
 * @component
 * @param {Object} props
 * @param {Object?} props.currentUser
 * @param {boolean?} props.isAuthenticated
 * @param {Object?} props.location - react-router location
 * @param {Function} props.onManageDisableScrolling
 * @param {Function} props.onMarkVendedorOnboarded - persists publicData.onboardingCompleted
 * @returns {JSX.Element}
 */
const AVTopbarExtras = props => {
  const {
    currentUser,
    isAuthenticated,
    location,
    onManageDisableScrolling,
    onMarkVendedorOnboarded,
  } = props;

  const dispatch = useDispatch();
  const [popupDismissed, setPopupDismissed] = useState(false);

  // Hydrate the global favorites list from the fetched currentUser's privateData
  // so hearts reflect saved state on every page. Runs on login, on a favorite
  // persisted elsewhere, and when the signed-in user changes.
  const savedFavoriteIds = currentUser?.attributes?.profile?.privateData?.favoriteListingIds;
  const currentUserId = currentUser?.id?.uuid || null;
  // Primitive keys, so the effect re-runs when the identity or the saved list
  // actually changes rather than on every new currentUser object.
  const savedFavoritesKey = Array.isArray(savedFavoriteIds) ? savedFavoriteIds.join(',') : '';
  // An authenticated session whose currentUser has not arrived yet says nothing
  // about the saved list; syncing then would blank the hearts on every load.
  const isUserSessionKnown = !isAuthenticated || !!currentUser;
  useEffect(() => {
    if (!isUserSessionKnown) {
      return;
    }
    // Sync even when there is nothing saved: a user who has favorited nothing,
    // and a logged-out one, both have to drop the previous session's list.
    dispatch(syncFavoritesFromUser(currentUser));
    // currentUser is read through the primitive keys above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isUserSessionKnown, currentUserId, savedFavoritesKey]);

  // Hydrate the shopping bag from localStorage once on mount (client-only).
  useEffect(() => {
    dispatch(hydrateBag());
  }, [dispatch]);

  const publicData = currentUser?.attributes?.profile?.publicData || {};
  // Suppressed on the signup page, where it would cover the "check your email"
  // confirmation message shown right after registration.
  const onSuppressedPath = welcomePopupSuppressedPaths.includes(location?.pathname);
  const showWelcomePopup = !popupDismissed && !onSuppressedPath && canShowWelcomePopup(currentUser);

  // Returns the persistence promise so CTA clicks can wait for onboarding to be
  // saved before navigating away (otherwise the request is cancelled by the
  // navigation and the popup re-appears).
  const handlePopupClose = () => {
    setPopupDismissed(true);
    return onMarkVendedorOnboarded();
  };

  return (
    <AVWelcomePopup
      userType={publicData.userType}
      isOpen={showWelcomePopup}
      onClose={handlePopupClose}
      onManageDisableScrolling={onManageDisableScrolling}
    />
  );
};

export default AVTopbarExtras;
