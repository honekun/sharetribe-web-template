import React from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../../../util/reactIntl';
import { MenuItem, NamedLink } from '../../../../../components';
import { AV_PROFILE_LINKS } from '../../../../../extensions/topbar/links';

import css from '../TopbarDesktop.module.css';

/**
 * The AV-specific links in the desktop topbar, kept out of `TopbarDesktop.js` so
 * that file holds only upstream's structure plus AV's two-row layout.
 */

/**
 * Purple pill link to the favorites page. Sits between the create-listing button
 * and the inbox link.
 *
 * `id` is opt-in because this component is mounted three times — desktop
 * topbar, mobile topbar, mobile menu footer — and a hardcoded one would put
 * three copies of the same DOM id on every page. Only TopbarDesktop passes it,
 * which is where upstream's single `inbox-link` has always lived.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.id]
 * @returns {JSX.Element}
 */
export const FavoritesLink = ({ id }) => {
  const intl = useIntl();
  const label = intl.formatMessage({ id: 'TopbarDesktop.favoritesLink' });
  return (
    <NamedLink
      id={id}
      className={css.favoritesButton}
      name="FavoritesPage"
      title={label}
      aria-label={label}
    >
      {/* 25px-tall box; extra viewBox space above the path renders the heart
          itself 24px tall, bottom-aligned. */}
      <svg
        className={css.favoritesHeart}
        height="25"
        viewBox="2 1.21 20 19.79"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 21S2 14.6 2 7.9C2 4.6 4.6 2 7.8 2c1.7 0 3.3.8 4.2 2.1C12.9 2.8 14.5 2 16.2 2 19.4 2 22 4.6 22 7.9 22 14.6 12 21 12 21z"
          fill="currentColor"
        />
      </svg>
      <span className={css.srOnly}>{label}</span>
    </NamedLink>
  );
};

/**
 * AV replacement for upstream's `InboxLink`: an envelope icon rather than a text
 * label, so it sits in the icon row beside favorites and the bag.
 *
 * `id` is opt-in for the same reason as FavoritesLink above: three copies of
 * this component are mounted, and upstream's `inbox-link` is meant to be one
 * element, not three.
 *
 * @component
 * @param {Object} props
 * @param {number} props.notificationCount
 * @param {string} props.inboxTab
 * @param {string} [props.id]
 * @returns {JSX.Element}
 */
export const AVInboxLink = ({ notificationCount, inboxTab, id }) => {
  const intl = useIntl();
  const label = intl.formatMessage({ id: 'TopbarDesktop.inbox' });
  const notificationDot = notificationCount > 0 ? <div className={css.notificationDot} /> : null;
  return (
    <NamedLink
      id={id}
      className={css.inboxLink}
      name="InboxPage"
      params={{ tab: inboxTab }}
      title={label}
      aria-label={label}
    >
      <span className={css.inboxIcon}>
        {/* 25px-tall box; extra viewBox space above the path renders the
            envelope itself 22px tall, bottom-aligned. */}
        <svg height="25" viewBox="2 3.09 20 15.91" aria-hidden="true">
          <path
            d="M3 5a1 1 0 0 0-1 1v1.2l10 5.8 10-5.8V6a1 1 0 0 0-1-1H3zM2 9.5V18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V9.5l-9.5 5.5a1 1 0 0 1-1 0L2 9.5z"
            fill="currentColor"
          />
        </svg>
        {notificationDot}
      </span>
      <span className={css.srOnly}>{label}</span>
    </NamedLink>
  );
};

/**
 * The AV entries in the profile dropdown (favorites, purchases, sales, balance).
 *
 * Returns an **array of MenuItems**, not a component: `MenuContent` walks its
 * children with `React.Children.forEach` and throws unless every one of them is
 * a keyed MenuItem, so a wrapper component would break the menu.
 *
 * @param {string} currentPage - route name of the page being rendered
 * @returns {Array<JSX.Element>}
 */
export const renderAvProfileMenuItems = currentPage =>
  AV_PROFILE_LINKS.map(({ pageName, labels }) => (
    <MenuItem key={pageName}>
      <NamedLink
        className={classNames(css.menuLink, currentPage === pageName ? css.currentPage : null)}
        name={pageName}
      >
        <span className={css.menuItemBorder} />
        <FormattedMessage id={labels.desktop} />
      </NamedLink>
    </MenuItem>
  ));
