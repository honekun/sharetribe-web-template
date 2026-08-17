import React from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import { useIntl } from '../../util/reactIntl';
import useMediaQuery from '../../hooks/useMediaQuery';
import { AV_BREAKPOINTS } from '../../util/avGridSizes';
import { bagPopupClosed, bagPopupOpened, selectBagCount } from '../../ducks/bag.duck';
import { NamedLink } from '../../components';
import BagPopup from '../BagPopup/BagPopup';

import css from './BagLink.module.css';

// Mirrors Topbar.module.css `.desktop`, which swaps the mobile nav for
// TopbarDesktop at --viewportLarge.
const DESKTOP_TOPBAR_QUERY = `(min-width: ${AV_BREAKPOINTS.large}px)`;

const IconBag = () => (
  <svg height="25" viewBox="3 0 18 23" aria-hidden="true">
    <path
      d="M6 8V6a6 6 0 0 1 12 0v2h3l-1 13a2 2 0 0 1-2 1.8H6A2 2 0 0 1 4 21L3 8h3zm2 0h8V6a4 4 0 0 0-8 0v2z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Topbar bag icon with item-count badge. Links to BagPage.
 *
 * Three of these are mounted at once — the mobile topbar, TopbarDesktop, and
 * the mobile menu's footer, the last two of which are in the DOM even when
 * their layout is hidden. Only one may carry BagPopup: the popup's state is
 * global, so every extra copy would fetch the bag listings again and register
 * its own document `mousedown` handler, and a click inside the visible popup
 * lands *outside* the other roots — closing and unmounting it mid-mousedown,
 * before the click it belongs to ever fires.
 *
 * So ownership is declared, not assumed. `popupLayout` says which topbar this
 * icon lives in; the icon renders the popup only when that topbar is the one
 * currently on screen. Every other copy is passive — no popup, and no hover
 * handlers either, since opening a popup that renders elsewhere is worse than
 * not opening one at all.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className]
 * @param {'desktop'|'mobile'} [props.popupLayout] - which topbar hosts this
 *   icon. Omitted means passive: the icon links to the bag and shows its badge,
 *   but never owns the dropdown.
 * @returns {JSX.Element}
 */
const BagLink = ({ className, popupLayout }) => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const count = useSelector(selectBagCount);
  const isDesktopLayout = useMediaQuery(DESKTOP_TOPBAR_QUERY);
  const hasPopup = popupLayout === (isDesktopLayout ? 'desktop' : 'mobile');

  // Open the bag dropdown on hover (only when the bag has items). Leaving the
  // whole wrapper — icon or dropdown — closes it; moving between them does not,
  // since the dropdown is a DOM child of the wrapper.
  const onMouseEnter = () => {
    if (count > 0) {
      dispatch(bagPopupOpened());
    }
  };
  const onMouseLeave = () => dispatch(bagPopupClosed());
  const hoverProps = hasPopup ? { onMouseEnter, onMouseLeave } : {};

  return (
    <div className={classNames(css.wrapper, className)} {...hoverProps}>
      <NamedLink
        name="BagPage"
        className={css.root}
        title={intl.formatMessage({ id: 'BagLink.label' })}
      >
        <IconBag />
        {count > 0 ? <span className={css.badge}>{count}</span> : null}
        <span className={css.srOnly}>{intl.formatMessage({ id: 'BagLink.label' })}</span>
      </NamedLink>
      {hasPopup ? <BagPopup /> : null}
    </div>
  );
};

export default BagLink;
