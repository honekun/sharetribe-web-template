import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../../util/reactIntl';
import { AV_PROFILE_LINKS } from '../../../../extensions/topbar/links';

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
 * @param {Function} currentPageClass - TopbarMobileMenu's own active-page helper
 * @returns {Array<JSX.Element>}
 */
export const renderAvMobileMenuLinks = currentPageClass => [
  <li key="BagPage" className={classNames(css.navigationLink, currentPageClass('BagPage'))}>
    <NamedLink name="BagPage">
      <FormattedMessage id="TopbarMobileMenu.bagLink" />
    </NamedLink>
  </li>,
  ...AV_PROFILE_LINKS.map(({ pageName, labels }) => (
    <li key={pageName} className={classNames(css.navigationLink, currentPageClass(pageName))}>
      <NamedLink name={pageName}>
        <FormattedMessage id={labels.mobile} />
      </NamedLink>
    </li>
  )),
];
