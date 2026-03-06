import React from 'react';
import loadable from '@loadable/component';

import { bool, object } from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { camelize } from '../../util/string';
import { propTypes } from '../../util/types';
import { useConfiguration } from '../../context/configurationContext';
import { useIntl } from '../../util/reactIntl';

import FallbackPage from './FallbackPage';
import { ASSET_NAME } from './LandingPage.duck';
import {
  getPageBuilderOptions,
  selectExtensionProps,
  transformPageData,
} from '../../extensions/landingPage';

const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

export const LandingPageComponent = props => {
  const { pageAssetsData, inProgress, error, extensionData } = props;

  const intl = useIntl();
  const config = useConfiguration();
  const pageData = pageAssetsData?.[camelize(ASSET_NAME)]?.data;
  const customPageData = transformPageData({ pageData, intl, config, extensionData });
  const pageBuilderOptions = getPageBuilderOptions({ intl, config, extensionData });

  return (
    <PageBuilder
      pageAssetsData={customPageData}
      options={pageBuilderOptions}
      inProgress={inProgress}
      error={error}
      fallbackPage={<FallbackPage error={error} />}
    />
  );
};

LandingPageComponent.propTypes = {
  pageAssetsData: object,
  inProgress: bool,
  error: propTypes.error,
  extensionData: object,
};

const mapStateToProps = state => {
  const { pageAssetsData, inProgress, error } = state.hostedAssets || {};
  const pageData = pageAssetsData?.[camelize(ASSET_NAME)]?.data;
  const extensionData = selectExtensionProps({ state, pageData });
  return {
    pageAssetsData,
    inProgress,
    error,
    extensionData,
  };
};

// Note: it is important that the withRouter HOC is **outside** the
// connect HOC, otherwise React Router won't rerender any Route
// components since connect implements a shouldComponentUpdate
// lifecycle hook.
//
// See: https://github.com/ReactTraining/react-router/issues/4671
const LandingPage = compose(connect(mapStateToProps))(LandingPageComponent);

export default LandingPage;
