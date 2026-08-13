import React, { useState, useEffect } from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { ACCOUNT_SETTINGS_PAGES } from '../../../../routing/routeConfiguration';
import {
  Avatar,
  InlineTextButton,
  LinkedLogo,
  Menu,
  MenuLabel,
  MenuContent,
  MenuItem,
  NamedLink,
  BagLink,
} from '../../../../components';

import TopbarSearchForm from '../TopbarSearchForm/TopbarSearchForm';
// AV: forked links menu (AV dropdowns) — upstream's CustomLinksMenu/ is left untouched.
import CustomLinksMenu from './AVLinksMenu/AVCustomLinksMenu';

import css from './TopbarDesktop.module.css';
import { AV_PROFILE_LINKS } from '../../../../extensions/topbar/links';

import { CreateListingMenuLink } from './AVLinksMenu/AVPriorityLinks';

const SignupLink = () => {
  return (
    <NamedLink id="signup-link" name="SignupPage" className={css.topbarLink}>
      <span className={css.topbarLinkLabel}>
        <FormattedMessage id="TopbarDesktop.signup" />
      </span>
    </NamedLink>
  );
};

const LoginLink = () => {
  return (
    <NamedLink id="login-link" name="LoginPage" className={css.topbarLink}>
      <span className={css.topbarLinkLabel}>
        <FormattedMessage id="TopbarDesktop.login" />
      </span>
    </NamedLink>
  );
};

// Purple pill link to the favorites page, sits between the create-listing button
// and the inbox link. Heart icon + label.
const FavoritesLink = () => {
  const intl = useIntl();
  const label = intl.formatMessage({ id: 'TopbarDesktop.favoritesLink' });
  return (
    <NamedLink
      id="favorites-link"
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

const InboxLink = ({ notificationCount, inboxTab }) => {
  const intl = useIntl();
  const label = intl.formatMessage({ id: 'TopbarDesktop.inbox' });
  const notificationDot = notificationCount > 0 ? <div className={css.notificationDot} /> : null;
  return (
    <NamedLink
      id="inbox-link"
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

const ProfileMenu = ({ currentPage, currentUser, onLogout, showManageListingsLink, intl }) => {
  const currentPageClass = page => {
    const isAccountSettingsPage =
      page === 'AccountSettingsPage' && ACCOUNT_SETTINGS_PAGES.includes(currentPage);
    return currentPage === page || isAccountSettingsPage ? css.currentPage : null;
  };

  return (
    <Menu skipFocusOnNavigation={true}>
      <MenuLabel
        id="profile-menu-label"
        className={css.profileMenuLabel}
        isOpenClassName={css.profileMenuIsOpen}
        ariaLabel={intl.formatMessage({ id: 'TopbarDesktop.screenreader.profileMenu' })}
      >
        <Avatar className={css.avatar} user={currentUser} disableProfileLink />
      </MenuLabel>
      <MenuContent className={css.profileMenuContent}>
        {showManageListingsLink ? (
          <MenuItem key="ManageListingsPage">
            <NamedLink
              className={classNames(css.menuLink, currentPageClass('ManageListingsPage'))}
              name="ManageListingsPage"
            >
              <span className={css.menuItemBorder} />
              <FormattedMessage id="TopbarDesktop.yourListingsLink" />
            </NamedLink>
          </MenuItem>
        ) : null}
        {AV_PROFILE_LINKS.map(({ pageName, labels }) => (
          <MenuItem key={pageName}>
            <NamedLink
              className={classNames(css.menuLink, currentPageClass(pageName))}
              name={pageName}
            >
              <span className={css.menuItemBorder} />
              <FormattedMessage id={labels.desktop} />
            </NamedLink>
          </MenuItem>
        ))}
        <MenuItem key="ProfileSettingsPage">
          <NamedLink
            className={classNames(css.menuLink, currentPageClass('ProfileSettingsPage'))}
            name="ProfileSettingsPage"
          >
            <span className={css.menuItemBorder} />
            <FormattedMessage id="TopbarDesktop.profileSettingsLink" />
          </NamedLink>
        </MenuItem>
        <MenuItem key="logout">
          <InlineTextButton rootClassName={css.logoutButton} onClick={onLogout}>
            <span className={css.menuItemBorder} />
            <FormattedMessage id="TopbarDesktop.logout" />
          </InlineTextButton>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
};

/**
 * Topbar for desktop layout
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {CurrentUser} props.currentUser API entity
 * @param {string?} props.currentPage
 * @param {boolean} props.isAuthenticated
 * @param {number} props.notificationCount
 * @param {Function} props.onLogout
 * @param {Function} props.onSearchSubmit
 * @param {Object?} props.initialSearchFormValues
 * @param {Object} props.intl
 * @param {Object} props.config
 * @param {boolean} props.showSearchForm
 * @param {boolean} props.showCreateListingsLink
 * @param {string} props.inboxTab
 * @returns {JSX.Element} search icon
 */
const TopbarDesktop = props => {
  const {
    className,
    config,
    customLinks,
    currentUser,
    currentPage,
    rootClassName,
    notificationCount = 0,
    intl,
    isAuthenticated,
    onLogout,
    onSearchSubmit,
    initialSearchFormValues = {},
    showSearchForm,
    showCreateListingsLink,
    inboxTab,
  } = props;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const marketplaceName = config.marketplaceName;
  const authenticatedOnClientSide = mounted && isAuthenticated;
  const isAuthenticatedOrJustHydrated = isAuthenticated || !mounted;

  const giveSpaceForSearch = customLinks == null || customLinks?.length === 0;
  const classes = classNames(rootClassName || css.root, className);

  const favoritesLinkMaybe = authenticatedOnClientSide ? <FavoritesLink /> : null;

  const inboxLinkMaybe = authenticatedOnClientSide ? (
    <InboxLink notificationCount={notificationCount} inboxTab={inboxTab} />
  ) : null;

  const profileMenuMaybe = authenticatedOnClientSide ? (
    <ProfileMenu
      currentPage={currentPage}
      currentUser={currentUser}
      onLogout={onLogout}
      showManageListingsLink={showCreateListingsLink}
      intl={intl}
    />
  ) : null;

  const signupLinkMaybe = isAuthenticatedOrJustHydrated ? null : <SignupLink />;
  const loginLinkMaybe = isAuthenticatedOrJustHydrated ? null : <LoginLink />;

  const searchFormMaybe = showSearchForm ? (
    <TopbarSearchForm
      className={classNames(css.searchLink, { [css.takeAvailableSpace]: giveSpaceForSearch })}
      desktopInputRoot={css.topbarSearchWithLeftPadding}
      onSubmit={onSearchSubmit}
      initialValues={initialSearchFormValues}
      appConfig={config}
    />
  ) : (
    <div
      className={classNames(css.spacer, css.topbarSearchWithLeftPadding, {
        [css.takeAvailableSpace]: giveSpaceForSearch,
      })}
    />
  );

  const createListingMaybe = authenticatedOnClientSide ? (
    <CreateListingMenuLink customLinksMenuClass={css.createListingLinkOnly} />
  ) : null;

  return (
    <nav
      className={classes}
      aria-label={intl.formatMessage({ id: 'TopbarDesktop.screenreader.topbarNavigation' })}
    >
      <div className={css.topRow}>
        <LinkedLogo
          id="logo-topbar-desktop"
          className={css.logoLink}
          layout="desktop"
          alt={intl.formatMessage({ id: 'TopbarDesktop.logo' }, { marketplaceName })}
          linkToExternalSite={config?.topbar?.logoLink}
        />

        {searchFormMaybe}

        <div className={css.rightGroup}>
          {createListingMaybe}
          {inboxLinkMaybe}
          {favoritesLinkMaybe}
          <BagLink />
          {profileMenuMaybe}
          {signupLinkMaybe}
          {loginLinkMaybe}
        </div>
      </div>

      <div className={css.bottomRow}>
        <CustomLinksMenu
          currentPage={currentPage}
          customLinks={customLinks}
          intl={intl}
          hasClientSideContentReady={authenticatedOnClientSide || !isAuthenticatedOrJustHydrated}
          showCreateListingsLink={showCreateListingsLink}
        />
      </div>
    </nav>
  );
};

export default TopbarDesktop;
