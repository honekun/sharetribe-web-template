import React from 'react';
import classNames from 'classnames';
import { NamedLink } from '../../components';
import css from './AVUserCard.module.css';

/**
 * AVUserCard
 *
 * Carousel card for a marketplace user.
 * Links to the user's public profile page (/u/:id).
 *
 * @param {Object} props.user  - denormalised user entity from marketplaceData
 * @param {string?} props.className
 */
const AVUserCard = props => {
  const { user, className } = props;

  const userId = user?.id?.uuid;
  const displayName = user?.attributes?.profile?.displayName || '';
  const profileImage = user?.profileImage;
  const variants = profileImage?.attributes?.variants || {};
  const imageUrl =
    variants['square-small2x']?.url ||
    variants['square-small']?.url ||
    null;

  if (!userId) return null;

  return (
    <NamedLink
      name="ProfilePage"
      params={{ id: userId }}
      className={classNames(css.root, className)}
    >
      <div className={css.imageWrapper}>
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className={css.image} />
        ) : (
          <div className={css.imagePlaceholder}>
            <span className={css.initials}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className={css.overlay}>
          <span className={css.name}>{displayName}</span>
        </div>
      </div>
    </NamedLink>
  );
};

export default AVUserCard;
