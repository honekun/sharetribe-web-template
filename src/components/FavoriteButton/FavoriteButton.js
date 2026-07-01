import React from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { useIntl } from '../../util/reactIntl';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { selectIsFavorite, toggleFavorite } from '../../ducks/favorites.duck';

import css from './FavoriteButton.module.css';

const IconHeart = ({ filled }) => (
  <svg
    className={classNames(css.icon, { [css.iconFilled]: filled })}
    width="20"
    height="18"
    viewBox="0 0 24 22"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12 21S2 14.6 2 7.9C2 4.6 4.6 2 7.8 2c1.7 0 3.3.8 4.2 2.1C12.9 2.8 14.5 2 16.2 2 19.4 2 22 4.6 22 7.9 22 14.6 12 21 12 21z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Heart toggle for favoriting a listing. Self-connected so it can be dropped
 * anywhere (listing cards, gallery) without prop drilling through upstream
 * files. Stops click propagation so a wrapping NamedLink does not navigate.
 *
 * @param {Object} props
 * @param {string} props.listingId listing UUID string
 * @param {string} [props.className]
 */
const FavoriteButton = ({ listingId, className }) => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const history = useHistory();
  const routeConfiguration = useRouteConfiguration();
  const isAuthenticated = useSelector(state => state.auth?.isAuthenticated);
  const isFavorite = useSelector(state => selectIsFavorite(state, listingId));

  const handleClick = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      history.push(createResourceLocatorString('SignupPage', routeConfiguration, {}, {}));
      return;
    }
    dispatch(toggleFavorite(listingId));
  };

  const label = intl.formatMessage({
    id: isFavorite ? 'FavoriteButton.removeFromFavorites' : 'FavoriteButton.addToFavorites',
  });

  return (
    <button
      type="button"
      className={classNames(css.root, className, { [css.active]: isFavorite })}
      onClick={handleClick}
      aria-pressed={isFavorite}
      aria-label={label}
      title={label}
    >
      <IconHeart filled={isFavorite} />
    </button>
  );
};

export default FavoriteButton;
