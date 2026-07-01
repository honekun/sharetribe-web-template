import React from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage } from '../../util/reactIntl';
import { addToBag, removeFromBag, selectIsInBag } from '../../ducks/bag.duck';

import css from './AddToBagButton.module.css';

const IconBag = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 8V6a6 6 0 0 1 12 0v2h3l-1 13a2 2 0 0 1-2 1.8H6A2 2 0 0 1 4 21L3 8h3zm2 0h8V6a4 4 0 0 0-8 0v2z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Secondary "add to bag" toggle, rendered next to the buy CTA in
 * ProductOrderForm. Self-connected to the bag duck so the upstream form only
 * needs a one-line insertion.
 *
 * @param {Object} props
 * @param {string} props.listingId listing UUID string
 * @param {string} [props.className]
 */
const AddToBagButton = ({ listingId, className }) => {
  const dispatch = useDispatch();
  const isInBag = useSelector(state => selectIsInBag(state, listingId));

  const handleClick = e => {
    e.preventDefault(); // do not submit the surrounding final-form
    dispatch(isInBag ? removeFromBag(listingId) : addToBag(listingId));
  };

  return (
    <button
      type="button"
      className={classNames(css.root, className, { [css.inBag]: isInBag })}
      onClick={handleClick}
      aria-pressed={isInBag}
    >
      <IconBag />
      <span className={css.label}>
        <FormattedMessage id={isInBag ? 'AddToBagButton.inBag' : 'AddToBagButton.addToBag'} />
      </span>
    </button>
  );
};

export default AddToBagButton;
