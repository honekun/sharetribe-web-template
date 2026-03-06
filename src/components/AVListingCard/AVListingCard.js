import React from 'react';
import classNames from 'classnames';

import { useConfiguration } from '../../context/configurationContext';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { displayPrice } from '../../util/configHelpers';
import { lazyLoadWithDimensions } from '../../util/uiHelpers';
import { formatMoney } from '../../util/currency';
import { ensureListing, ensureUser } from '../../util/data';
import { richText } from '../../util/richText';
import { createSlug } from '../../util/urlHelpers';
import { isBookingProcessAlias } from '../../transactions/transaction';

import { AspectRatioWrapper, NamedLink, ResponsiveImage, AvatarSmall } from '../../components';

import css from './AVListingCard.module.css';

const MIN_LENGTH_FOR_LONG_WORDS = 10;
const LazyImage = lazyLoadWithDimensions(ResponsiveImage, { loadAfterInitialRendering: 3000 });

const PriceMaybe = props => {
  const { price, publicData, config, intl } = props;
  const { listingType } = publicData || {};
  const validListingTypes = config.listing.listingTypes;
  const foundListingTypeConfig = validListingTypes.find(conf => conf.listingType === listingType);
  const showPrice = displayPrice(foundListingTypeConfig);
  if (!showPrice && price) {
    return null;
  }

  const isBookable = isBookingProcessAlias(publicData?.transactionProcessAlias);
  if (!price) {
    return null;
  }

  const customFormatPrice = money => {
    const { amount, currency } = money || {};
    if (currency === 'MXN') {
      const decimal = (amount / 100).toFixed(2);
      return `$${decimal.replace(',', '.')}`;
    }

    return formatMoney(intl, money);
  };
  const fixedPrice = customFormatPrice(price);
  const priceTitle = fixedPrice;
  const priceValue = <span className={css.priceValue}>{fixedPrice}</span>;
  const pricePerUnit = isBookable ? (
    <span className={css.perUnit}>
      <FormattedMessage id="ListingCard.perUnit" values={{ unitType: publicData?.unitType }} />
    </span>
  ) : (
    ''
  );

  return (
    <div className={css.price} title={priceTitle}>
      <FormattedMessage id="ListingCard.price" values={{ priceValue, pricePerUnit }} />
    </div>
  );
};

/**
 * ListingCard
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to component's own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {Object} props.listing API entity: listing or ownListing
 * @param {string?} props.renderSizes for img/srcset
 * @param {Function?} props.setActiveListing
 * @param {boolean?} props.showAuthorInfo
 * @returns {JSX.Element} listing card to be used in search result panel etc.
 */
export const AVListingCard = props => {
  const config = useConfiguration();
  const intl = props.intl || useIntl();
  const {
    className,
    rootClassName,
    listing,
    renderSizes,
    setActiveListing,
    showAuthorInfo = true,
    showTallCards = true,
    showListingTitle = false
  } = props;
  const classes = classNames(rootClassName || css.root, className);
  const currentListing = ensureListing(listing);
  const id = currentListing.id.uuid;
  const { title = '', price, publicData } = currentListing.attributes;
  const slug = createSlug(title);
  const author = ensureUser(listing?.author);
  const authorName = author?.attributes?.profile?.displayName || '';
  const authorId = author?.id?.uuid;
  const firstImage =
    currentListing.images && currentListing.images.length > 0 ? currentListing.images[0] : null;

  const {
    aspectWidth = 1,
    aspectHeight = 1,
    variantPrefix = 'listing-card',
  } = config.layout.listingImage;
  const variants = firstImage
    ? Object.keys(firstImage?.attributes?.variants).filter(k => k.startsWith(variantPrefix))
    : [];

  const setActivePropsMaybe = setActiveListing
    ? {
        onMouseEnter: () => setActiveListing(currentListing.id),
        onMouseLeave: () => setActiveListing(null),
      }
    : null;

    const aspectWidthTall = 3,
          aspectHeightTall = 4.85;

  return (
    <div className={classes}>
      <NamedLink className={css.cardLink} name="ListingPage" params={{ id, slug }}>
        <AspectRatioWrapper
          className={css.aspectRatioWrapper}
          width={showTallCards ? aspectWidthTall : aspectWidth}
          height={showTallCards ? aspectHeightTall : aspectHeight}
          {...setActivePropsMaybe}
        >
          <LazyImage
            rootClassName={css.rootForImage}
            alt={title}
            image={firstImage}
            variants={variants}
            sizes={renderSizes}
          />
        </AspectRatioWrapper>
      </NamedLink>
      <div className={css.info}>
        {publicData?.brand ? (
          <NamedLink
            name="SearchPage"
            to={{ search: `?pub_brand=${publicData?.brand}` }}
            className={css.brand}
          >
            {
              (config.listing.listingFields.find(f => f.key === 'brand')?.enumOptions || [])
                .find(opt => opt.option === publicData?.brand)?.label || publicData?.brand
            }
          </NamedLink>
        ) : null}

        {showListingTitle && title ? (
          <div className={css.title}>
            {richText(title, {
              longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
              longWordClass: css.longWord,
            })}
          </div>
        ) : null}

        {publicData?.talla ? (
          <div className={css.sizes}>
            <FormattedMessage id="AVListingCard.sizeLabel" />{' '}
            {
              (config.listing.listingFields.find(f => f.key === 'talla')?.enumOptions || [])
                .find(opt => opt.option === publicData?.talla)?.label || publicData?.talla
            }
          </div>
        ) : null}
        <PriceMaybe price={price} publicData={publicData} config={config} intl={intl} />
        <div className={css.mainInfo}>
          {showAuthorInfo ? (
            <div className={css.authorInfo}>
              <AvatarSmall user={author} className={css.providerAvatar} />
              {authorId ? (
                <NamedLink title={authorName} name="ProfilePage" params={{ id: authorId }}>
                  <FormattedMessage id="ListingCard.author" values={{ authorName }} />
                </NamedLink>
              ) : (
                <span>
                  <FormattedMessage id="ListingCard.author" values={{ authorName }} />
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AVListingCard;
