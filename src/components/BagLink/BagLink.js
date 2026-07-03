import React from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import { useIntl } from '../../util/reactIntl';
import { bagPopupClosed, bagPopupOpened, selectBagCount } from '../../ducks/bag.duck';
import { NamedLink } from '../../components';
import BagPopup from '../BagPopup/BagPopup';

import css from './BagLink.module.css';

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
 */
const BagLink = ({ className }) => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const count = useSelector(selectBagCount);

  // Open the bag dropdown on hover (only when the bag has items). Leaving the
  // whole wrapper — icon or dropdown — closes it; moving between them does not,
  // since the dropdown is a DOM child of the wrapper.
  const onMouseEnter = () => {
    if (count > 0) {
      dispatch(bagPopupOpened());
    }
  };
  const onMouseLeave = () => dispatch(bagPopupClosed());

  return (
    <div
      className={classNames(css.wrapper, className)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NamedLink
        name="BagPage"
        className={css.root}
        title={intl.formatMessage({ id: 'BagLink.label' })}
      >
        <IconBag />
        {count > 0 ? <span className={css.badge}>{count}</span> : null}
        <span className={css.srOnly}>{intl.formatMessage({ id: 'BagLink.label' })}</span>
      </NamedLink>
      <BagPopup />
    </div>
  );
};

export default BagLink;
