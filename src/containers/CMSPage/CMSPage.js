import React from 'react';
import loadable from '@loadable/component';

import { bool, object } from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import { avHeroSecionId, avPriceSelectorSecionId } from './CMSPage.duck';
import { fetchFeaturedListings } from '../../ducks/featuredListings.duck';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { getFeaturedListingsProps } from '../../util/data';

import NotFoundPage from '../../containers/NotFoundPage/NotFoundPage';
const PageBuilder = loadable(() =>
  import(/* webpackChunkName: "PageBuilder" */ '../PageBuilder/PageBuilder')
);

// To load Marketplace texts (used as fallback when hosted asset is not available).
import { useIntl } from '../../util/reactIntl';

// Import custom sections.
import SectionHeroCustom from '../PageBuilder/SectionBuilder/SectionHeroCustom';
import SectionPriceSelector from '../PageBuilder/SectionBuilder/SectionPriceSelector';

// Define custom section types. (Based on what default section type?)
const avHeroSectionType = 'hero';
const avPriceSelectorSectionType = 'price-columns';

// Feature delimiter used in hosted translation strings (fallback mode only).
const FEATURE_DELIMITER = '#!#';

// --- Pricing data from hosted asset (preferred) ---

// Read pricing plans from the hosted asset JSON.
// Expected schema: { toggles: { cta1, cta2 }, plans: { set1: [...], set2: [...] } }
// Each plan: { title, description, price, priceText, cta: { link, text }, features: [string] }
const buildPricingSectionFromAsset = (assetData, baseSection) => ({
  ...baseSection,
  sectionId: avPriceSelectorSecionId,
  sectionType: avPriceSelectorSectionType,
  classWrap: '',
  plans: assetData.plans,
  toggles: assetData.toggles,
});

// --- Pricing data from intl translations (fallback) ---

const buildPlanFromIntl = (intl, setKey, planIdx) => ({
  title: intl.formatMessage({ id: `PricingToggle.${setKey}.title${planIdx}`, defaultMessage: '' }),
  description: intl.formatMessage({ id: `PricingToggle.${setKey}.description${planIdx}`, defaultMessage: '' }),
  price: intl.formatMessage({ id: `PricingToggle.${setKey}.price${planIdx}`, defaultMessage: '' }),
  priceText: intl.formatMessage({ id: `PricingToggle.${setKey}.priceText${planIdx}`, defaultMessage: '' }),
  cta: {
    link: intl.formatMessage({ id: `PricingToggle.${setKey}.cta${planIdx}Link`, defaultMessage: '' }),
    text: intl.formatMessage({ id: `PricingToggle.${setKey}.cta${planIdx}Text`, defaultMessage: '' }),
  },
  features: intl.formatMessage({ id: `PricingToggle.${setKey}.features${planIdx}`, defaultMessage: '' }).split(FEATURE_DELIMITER),
});

const buildPricingSectionFromIntl = (intl, baseSection) => ({
  ...baseSection,
  sectionId: avPriceSelectorSecionId,
  sectionType: avPriceSelectorSectionType,
  classWrap: '',
  plans: {
    set1: [buildPlanFromIntl(intl, 'set1', 1), buildPlanFromIntl(intl, 'set1', 2)],
    set2: [buildPlanFromIntl(intl, 'set2', 1), buildPlanFromIntl(intl, 'set2', 2)],
  },
  toggles: {
    cta1: intl.formatMessage({ id: 'PricingToggle.toggleSet1', defaultMessage: '' }),
    cta2: intl.formatMessage({ id: 'PricingToggle.toggleSet2', defaultMessage: '' }),
  },
});

// --- Hero section ---

const buildHeroSectionData = (intl, baseSection) => ({
  ...baseSection,
  sectionId: avHeroSecionId,
  sectionType: avHeroSectionType,
  classWrap: 'contentLeft',
  callToAction: {
    fieldType: 'internalButtonLink',
    href: intl.formatMessage({ id: 'AVHero.ctaFirstLink' }),
    content: intl.formatMessage({ id: 'AVHero.ctaFirstText' }),
  },
  callToAction2: {
    fieldType: 'internalButtonLink',
    href: intl.formatMessage({ id: 'AVHero.ctaSecondLink' }),
    content: intl.formatMessage({ id: 'AVHero.ctaSecondText' }),
  },
});

export const CMSPageComponent = props => {
  const intl = useIntl();
  const { params, pageAssetsData, inProgress, error, pricingPlansData } = props;
  const pageId = params.pageId || props.pageId;

  if (!inProgress && error?.status === 404) {
    return <NotFoundPage staticContext={props.staticContext} />;
  }

  const pageData = pageAssetsData?.[pageId]?.data;

  // Pricing plans from hosted asset (null if asset doesn't exist yet)
  const pricingAssetData = pricingPlansData;

  const avHeroSectionIdx = pageData?.sections?.findIndex(
    s => s.sectionId === avHeroSecionId
  );
  const avPriceSelectorSectionIdx = pageData?.sections?.findIndex(
    s => s.sectionId === avPriceSelectorSecionId
  );

  const customSections = pageData
    ? pageData.sections.map((s, idx) => {
        if (idx === avHeroSectionIdx) {
          return buildHeroSectionData(intl, s);
        }
        if (idx === avPriceSelectorSectionIdx) {
          // Prefer hosted asset data; fall back to intl translations
          return pricingAssetData
            ? buildPricingSectionFromAsset(pricingAssetData, s)
            : buildPricingSectionFromIntl(intl, s);
        }
        return s;
      })
    : null;

  const customPageData = pageData
    ? { ...pageData, sections: customSections }
    : pageData;

  return (
    <PageBuilder
      pageAssetsData={customPageData}
      options={{
        sectionComponents: {
          [avHeroSectionType]: { component: SectionHeroCustom },
          [avPriceSelectorSectionType]: { component: SectionPriceSelector },
        },
      }}
      inProgress={inProgress}
      schemaType="Article"
      featuredListings={getFeaturedListingsProps(pageId, props)}
    />
  );
};

CMSPageComponent.propTypes = {
  pageAssetsData: object,
  inProgress: bool,
};

const mapStateToProps = state => {
  const { pageAssetsData, inProgress, error } = state.hostedAssets || {};
  const { pricingPlansData } = state.CMSPage || {};
  const featuredListingData = state.featuredListings || {};
  const getListingEntitiesById = listingIds => getListingsById(state, listingIds);

  return { pageAssetsData, inProgress, error, pricingPlansData, featuredListingData, getListingEntitiesById };
};

const mapDispatchToProps = dispatch => ({
  onFetchFeaturedListings: (sectionId, parentPage, listingImageConfig, allSections) =>
    dispatch(fetchFeaturedListings({ sectionId, parentPage, listingImageConfig, allSections })),
});

// Note: it is important that the withRouter HOC is **outside** the
// connect HOC, otherwise React Router won't rerender any Route
// components since connect implements a shouldComponentUpdate
// lifecycle hook.
//
// See: https://github.com/ReactTraining/react-router/issues/4671
const CMSPage = compose(
  withRouter,
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(CMSPageComponent);

export default CMSPage;
