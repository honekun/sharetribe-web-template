import React from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage } from '../../util/reactIntl';
import { addToBag, removeFromBag, selectIsInBag } from '../../ducks/bag.duck';

import css from './AddToBagButton.module.css';

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
      <span className={css.label}>
        <FormattedMessage id={isInBag ? 'AddToBagButton.inBag' : 'AddToBagButton.addToBag'} />
      </span>
    </button>
  );
};

export default AddToBagButton;
