import { useSelector } from 'react-redux';

import { isNavPageHiddenForUser } from '../../config/configAV';
import { AV_PROFILE_LINKS } from './links';

/**
 * Applies `configAV`'s nav-visibility gate to the AV nav consumers.
 *
 * The rule itself lives in `configAV.isNavPageHiddenForUser` and takes a user,
 * so anything already holding one calls that directly — TopbarDesktop's
 * ProfileMenu, TopbarMobileMenu, and the account side nav all do.
 *
 * The hooks here exist for the two consumers that hold no user and cannot
 * cheaply be given one: the topbar icon links, which are mounted from three
 * topbars of which only TopbarDesktop has `currentUser` in scope, and UserNav,
 * which is rendered by thirteen pages that would each have to drill the prop.
 * `BagLink` reads its own state from redux across the same three mount points.
 */

/**
 * `AV_PROFILE_LINKS` minus the entries hidden for this user.
 *
 * @param {Object} currentUser - CurrentUser API entity, or null when signed out
 * @returns {Array<Object>} the visible subset, in registry order
 */
export const filterAvProfileLinks = currentUser =>
  AV_PROFILE_LINKS.filter(({ pageName }) => !isNavPageHiddenForUser(currentUser, pageName));

/**
 * Whether the signed-in user's menus should omit `pageName`.
 *
 * @param {string} pageName - route name, e.g. 'FavoritesPage'
 * @returns {boolean}
 */
export const useIsNavPageHidden = pageName =>
  useSelector(state => isNavPageHiddenForUser(state.user.currentUser, pageName));

/**
 * `filterAvProfileLinks` for consumers with no `currentUser` prop.
 *
 * @returns {Array<Object>} the visible subset, in registry order
 */
export const useAvProfileLinks = () =>
  filterAvProfileLinks(useSelector(state => state.user.currentUser));
