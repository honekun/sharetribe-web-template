import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { H1, H2, LayoutSingleColumn, NamedLink, Page } from '../../components';

import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './CreateTypePage.module.css';

// Chooser the topbar VENDE button lands on: create a single listing
// (EditListingWizard) or upload many at once (bulk ZIP import).
export const CreateTypePageComponent = props => {
  const intl = useIntl();
  const { scrollingDisabled } = props;
  const title = intl.formatMessage({ id: 'CreateTypePage.title' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <main className={css.root}>
          <H1 as="h1" className={css.heading}>
            <FormattedMessage id="CreateTypePage.heading" />
          </H1>
          <div className={css.cards}>
            <div className={css.card}>
              <H2 as="h2" className={css.cardTitle}>
                <FormattedMessage id="CreateTypePage.singleTitle" />
              </H2>
              <p className={css.cardText}>
                <FormattedMessage id="CreateTypePage.singleText" />
              </p>
              <NamedLink name="NewListingPage" className={css.cta}>
                <FormattedMessage id="CreateTypePage.singleCta" />
              </NamedLink>
            </div>
            <div className={css.card}>
              <H2 as="h2" className={css.cardTitle}>
                <FormattedMessage id="CreateTypePage.bulkTitle" />
              </H2>
              <p className={css.cardText}>
                <FormattedMessage id="CreateTypePage.bulkText" />
              </p>
              <NamedLink name="BulkImportPage" className={css.cta}>
                <FormattedMessage id="CreateTypePage.bulkCta" />
              </NamedLink>
            </div>
          </div>
        </main>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => ({
  scrollingDisabled: isScrollingDisabled(state),
});

const CreateTypePage = compose(connect(mapStateToProps))(CreateTypePageComponent);

export default CreateTypePage;
