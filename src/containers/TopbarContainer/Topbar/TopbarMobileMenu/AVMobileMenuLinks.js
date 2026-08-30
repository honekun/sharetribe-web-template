import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../../util/reactIntl';
import { filterAvProfileLinks } from '../../../../extensions/topbar/avNavVisibility';

import { NamedLink } from '../../../../components';

import css from './TopbarMobileMenu.module.css';

/**
 * The AV entries in the mobile menu, kept out of `TopbarMobileMenu.js` so that
 * file keeps upstream's structure.
 */

/**
 * Bag link for the signed-out menu, where there is no account-links list to join.
 *
 * @component
 * @returns {JSX.Element}
 */
export const AVMobileBagSection = () => (
  <ul className={css.accountLinksWrapper}>
    <li className={css.navigationLink}>
      <NamedLink name="BagPage">
        <FormattedMessage id="TopbarMobileMenu.bagLink" />
      </NamedLink>
    </li>
  </ul>
);

/**
 * The AV rows in the signed-in account list: bag, then favorites/purchases/
 * sales/balance.
 *
 * Returns an array of `<li>` rather than a component so the rows stay direct
 * children of upstream's `<ul>`.
 *
 * Entries hidden for the user's type are dropped, matching the desktop profile
 * menu. `currentUser` is an argument rather than a hook for the same reason it
 * is there: this returns an array of `<li>`, not a component.
 *
 * @param {Function} currentPageClass - TopbarMobileMenu's own active-page helper
 * @param {Object} [currentUser] - CurrentUser API entity, for the visibility gate
 * @returns {Array<JSX.Element>}
 */
export const renderAvMobileMenuLinks = (currentPageClass, currentUser) => [
  <li key="BagPage" className={classNames(css.navigationLink, currentPageClass('BagPage'))}>
    <NamedLink name="BagPage">
      <FormattedMessage id="TopbarMobileMenu.bagLink" />
    </NamedLink>
  </li>,
  ...filterAvProfileLinks(currentUser).map(({ pageName, labels }) => (
    <li key={pageName} className={classNames(css.navigationLink, currentPageClass(pageName))}>
      <NamedLink name={pageName}>
        <FormattedMessage id={labels.mobile} />
      </NamedLink>
    </li>
  )),
];
