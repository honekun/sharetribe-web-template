import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { selectFavoriteIds } from '../../ducks/favorites.duck';
import { showCreateListingLinkForUser } from '../../util/userHelpers';
import { AV_LISTING_GRID_RAMP, buildRenderSizes } from '../../util/avGridSizes';

import {
  AVListingCard,
  H2,
  Page,
  LayoutSingleColumn,
  UserNav,
  IconSpinner,
} from '../../components';

import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './FavoritesPage.module.css';

// Derived from the shared ramp so the hints cannot drift from the column counts
// in FavoritesPage.module.css — same grid as the search results (non-map).
const cardRenderSizes = buildRenderSizes(AV_LISTING_GRID_RAMP);

export const FavoritesPageComponent = props => {
  const { currentUser, listings, queryInProgress, queryError, scrollingDisabled } = props;
  const config = useConfiguration();
  const intl = useIntl();
  const title = intl.formatMessage({ id: 'FavoritesPage.title' });
  const showManageListingsLink = showCreateListingLinkForUser(config, currentUser);

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <>
            <TopbarContainer />
            <UserNav currentPage="FavoritesPage" showManageListingsLink={showManageListingsLink} />
          </>
        }
        footer={<FooterContainer />}
      >
        <div className={css.content}>
          <H2 as="h1" className={css.heading}>
            <FormattedMessage id="FavoritesPage.heading" />
          </H2>

          {queryError ? (
            <p className={css.error}>
              <FormattedMessage id="FavoritesPage.queryError" />
            </p>
          ) : null}

          {queryInProgress ? (
            <IconSpinner />
          ) : listings.length === 0 && !queryError ? (
            <p className={css.noResults}>
              <FormattedMessage id="FavoritesPage.noFavorites" />
            </p>
          ) : (
            <ul className={css.listingCards}>
              {listings.map(l => (
                <li key={l.id.uuid} className={css.resultItem}>
                  <AVListingCard
                    className={css.listingCard}
                    listing={l}
                    renderSizes={cardRenderSizes}
                    showListingTitle={true}
                    showTallCards={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { listingRefs, queryInProgress, queryError } = state.FavoritesPage;
  // Live-filter the loaded refs by the favorites duck so un-favoriting a card
  // removes it immediately without a refetch. toggleFavorite is optimistic and
  // rolls back on API failure, which makes the card reappear. The duck is
  // hydrated in this page's loadData, so the filter is a no-op on first render.
  const favoriteIds = selectFavoriteIds(state);
  const currentRefs = listingRefs.filter(ref => favoriteIds.includes(ref.id.uuid));
  const { currentUser } = state.user;
  return {
    currentUser,
    listings: getMarketplaceEntities(state, currentRefs),
    queryInProgress,
    queryError,
    scrollingDisabled: isScrollingDisabled(state),
  };
};

const FavoritesPage = compose(connect(mapStateToProps))(FavoritesPageComponent);
export default FavoritesPage;
