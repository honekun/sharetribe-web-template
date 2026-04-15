import React from 'react';
import classNames from 'classnames';
import { NamedLink } from '../../components';
import css from './AVCategoryCard.module.css';

const formatCategoryName = id =>
  (id || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

/**
 * AVCategoryCard
 *
 * Simple card showing a category image with the category name overlaid at the bottom.
 * Links to the search page filtered by categoryLevel1.
 *
 * @component
 * @param {Object} props
 * @param {string} props.categoryId  - e.g. "blazers" — used for the search link and fallback name
 * @param {string?} props.name       - display name override (from block title)
 * @param {Object?} props.media      - CMS image asset: { fieldType:'image', alt, image: { attributes: { variants } } }
 * @param {string?} props.className
 */
const AVCategoryCard = props => {
  const { categoryId, name, media, className } = props;

  const imageVariants = media?.image?.attributes?.variants || {};
  const imageUrl = (
    imageVariants['original400'] ||
    imageVariants['original800'] ||
    imageVariants['original1200'] ||
    imageVariants['original2400'] ||
    Object.values(imageVariants)[0]
  )?.url;
  const alt = media?.alt || name || formatCategoryName(categoryId);
  const displayName = name || formatCategoryName(categoryId);

  return (
    <NamedLink
      name="SearchPage"
      to={{ search: `?pub_categoryLevel1=${categoryId}` }}
      className={classNames(css.root, className)}
    >
      <div className={css.imageWrapper}>
        {imageUrl ? (
          <img src={imageUrl} alt={alt} className={css.image} />
        ) : (
          <div className={css.imagePlaceholder} />
        )}
        <div className={css.overlay}>
          <span className={css.name}>{displayName}</span>
        </div>
      </div>
    </NamedLink>
  );
};

export default AVCategoryCard;
