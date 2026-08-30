import React from 'react';
import classNames from 'classnames';

import { propTypes } from '../../../util/types';
import { AVListingCard, PaginationLinks } from '../../../components';

import {
  AV_LISTING_GRID_RAMP,
  AV_MAP_VARIANT_RAMP,
  buildRenderSizes,
} from '../../../util/avGridSizes';

import css from './SearchResultsPanel.module.css';

/**
 * SearchResultsPanel component
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that extends the default class for the root element
 * @param {Array<propTypes.listing>} props.listings - The listings
 * @param {propTypes.pagination} props.pagination - The pagination
 * @param {Object} props.search - The search
 * @param {Function} props.setActiveListing - The function to handle the active listing
 * @param {boolean} [props.isMapVariant] - Whether the map variant is enabled
 * @returns {JSX.Element}
 */
const SearchResultsPanel = props => {
  const {
    className,
    rootClassName,
    listings = [],
    pagination,
    search,
    setActiveListing,
    isMapVariant = true,
    listingTypeParam,
    intl,
  } = props;
  const classes = classNames(rootClassName || css.root, className);
  const pageName = listingTypeParam ? 'SearchPageWithListingType' : 'SearchPage';

  const paginationLinks =
    pagination && pagination.totalPages > 1 ? (
      <PaginationLinks
        className={css.pagination}
        pageName={pageName}
        pagePathParams={{ listingType: listingTypeParam }}
        pageSearchParams={search}
        pagination={pagination}
        aria-label={intl.formatMessage({ id: 'SearchResultsPanel.screenreader.pagination' })}
      />
    ) : null;

  // AV: both variants derive their hints from the shared ramps, so the `sizes`
  // and the column counts in avBrandOverrides.css move together. The map variant
  // stays 2-up until --viewportXLarge because it shares its width with the map.
  const cardRenderSizes = isMapVariant =>
    buildRenderSizes(isMapVariant ? AV_MAP_VARIANT_RAMP : AV_LISTING_GRID_RAMP);

  return (
    <div className={classes}>
      <ul className={isMapVariant ? css.listingCardsMapVariant : css.listingCards}>
        {listings.map(l => (
          <li key={l.id.uuid} className={css.resultItem}>
            <AVListingCard
              className={css.listingCard}
              listing={l}
              renderSizes={cardRenderSizes(isMapVariant)}
              setActiveListing={setActiveListing}
              showListingTitle={true}
              showTallCards={false}
            />
          </li>
        ))}
        {props.children}
      </ul>
      {paginationLinks}
    </div>
  );
};

export default SearchResultsPanel;
