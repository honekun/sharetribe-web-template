import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';

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

// Same sizes the search results grid passes to AVListingCard (non-map variant).
const cardRenderSizes = [
  '(max-width: 549px) 100vw',
  '(max-width: 767px) 50vw',
  '(max-width: 1439px) 26vw',
  '(max-width: 1920px) 18vw',
  '14vw',
].join(', ');

export const FavoritesPageComponent = props => {
  const { listings, queryInProgress, queryError, scrollingDisabled } = props;
  const intl = useIntl();
  const title = intl.formatMessage({ id: 'FavoritesPage.title' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <>
            <TopbarContainer />
            <UserNav currentPage="FavoritesPage" />
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
  return {
    listings: getMarketplaceEntities(state, listingRefs),
    queryInProgress,
    queryError,
    scrollingDisabled: isScrollingDisabled(state),
  };
};

const FavoritesPage = compose(connect(mapStateToProps))(FavoritesPageComponent);
export default FavoritesPage;
