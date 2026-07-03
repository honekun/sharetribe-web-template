import React, { useMemo } from 'react';
import classNames from 'classnames';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { createSlug } from '../../util/urlHelpers';
import { ensureListing, ensureUser } from '../../util/data';
import { types as sdkTypes } from '../../util/sdkLoader';

import { AspectRatioWrapper, AvatarSmall, NamedLink, ResponsiveImage } from '../../components';

import css from './AVBagItemCard.module.css';

const { Money } = sdkTypes;

// Build a `{ [fieldKey]: { [option]: label } }` lookup so we can turn stored
// enum option values (e.g. all_sizes) into their human labels — same approach
// as AVListingCard.
const buildEnumLookup = listingFields => {
  const out = {};
  for (const field of listingFields || []) {
    const opts = {};
    for (const opt of field?.enumOptions || []) {
      opts[opt.option] = opt.label;
    }
    out[field.key] = opts;
  }
  return out;
};

const getEnumLabel = (lookup, fieldKey, option) => lookup?.[fieldKey]?.[option] || option;

/**
 * Card row for a single bag listing, shared by BagPage and BagPopup. Shows the
 * author header on top, then three columns: image, details (title / price /
 * size / remove) and the per-item totals + checkout CTA. The three columns
 * collapse to a stacked layout on narrow viewports and, via `variant="popup"`,
 * always render stacked inside the (narrow) BagPopup regardless of width.
 *
 * @param {Object} props
 * @param {Object} props.listing marketplace listing entity (with author + images)
 * @param {Function} props.onRemove called with the listing id when remove is clicked
 * @param {Function} props.onCheckout called with the listing when checkout is clicked
 * @param {'page'|'popup'} [props.variant='page'] layout context
 * @param {string?} props.className extra class on the root <li>
 */
const AVBagItemCard = props => {
  const { listing, onRemove, onCheckout, variant = 'page', className } = props;
  const config = useConfiguration();
  const intl = useIntl();

  const currentListing = ensureListing(listing);
  const { title = '', price, publicData } = currentListing.attributes;
  const id = currentListing.id.uuid;
  const slug = createSlug(title);
  const firstImage = currentListing.images?.[0] || null;

  const author = ensureUser(currentListing.author);
  const authorName = author.attributes?.profile?.displayName || '';
  const authorId = author.id?.uuid;

  const enumLookup = useMemo(() => buildEnumLookup(config.listing.listingFields), [
    config.listing.listingFields,
  ]);
  const sizes = publicData?.all_sizes || [];

  const formattedPrice = price ? formatMoney(intl, price) : null;
  // Original ("was") price shown struck through only when higher than the
  // current price — mirrors AVListingCard / OrderPanel.
  const originalPriceRaw = publicData?.originalPrice;
  const originalPriceMoney =
    originalPriceRaw && price && originalPriceRaw.amount > price.amount
      ? new Money(originalPriceRaw.amount, originalPriceRaw.currency)
      : null;

  const authorLabel = <FormattedMessage id="ListingCard.author" values={{ authorName }} />;

  const rootClass = classNames(css.card, { [css.popup]: variant === 'popup' }, className);

  return (
    <li className={rootClass}>
      <div className={css.authorHeader}>
        <AvatarSmall user={author} className={css.authorAvatar} disableProfileLink />
        {authorId ? (
          <NamedLink
            className={css.authorName}
            name="ProfilePage"
            params={{ id: authorId }}
            title={authorName}
          >
            {authorLabel}
          </NamedLink>
        ) : (
          <span className={css.authorName}>{authorLabel}</span>
        )}
      </div>

      <div className={css.columns}>
        <NamedLink name="ListingPage" params={{ id, slug }} className={css.imageCol} title={title}>
          <AspectRatioWrapper width={1} height={1} className={css.imageWrapper}>
            <ResponsiveImage
              rootClassName={css.image}
              alt={title}
              image={firstImage}
              variants={['listing-card', 'listing-card-2x']}
              sizes="120px"
            />
          </AspectRatioWrapper>
        </NamedLink>

        <div className={css.detailCol}>
          <NamedLink name="ListingPage" params={{ id, slug }} className={css.title}>
            {title}
          </NamedLink>

          {formattedPrice ? (
            <div className={css.price}>
              <span className={css.priceValue}>{formattedPrice}</span>
              {originalPriceMoney ? (
                <s className={css.originalPrice}>{formatMoney(intl, originalPriceMoney)}</s>
              ) : null}
            </div>
          ) : null}

          {sizes.length > 0 ? (
            <div className={css.sizes}>
              {sizes.map(size => getEnumLabel(enumLookup, 'all_sizes', size)).join(', ')}
            </div>
          ) : null}

          <button type="button" className={css.removeButton} onClick={() => onRemove(id)}>
            <FormattedMessage id="BagPage.remove" />
          </button>
        </div>

        <div className={css.totalsCol}>
          <div className={css.totalsRow}>
            <span className={css.totalsLabel}>
              <FormattedMessage id="AVBagItemCard.items" />
            </span>
            <span className={css.totalsValue}>{formattedPrice}</span>
          </div>
          <div className={classNames(css.totalsRow, css.totalsRowTotal)}>
            <span className={css.totalsLabel}>
              <FormattedMessage id="AVBagItemCard.total" />
            </span>
            <span className={css.totalsValue}>{formattedPrice}</span>
          </div>
          <p className={css.shippingNote}>
            <FormattedMessage id="AVBagItemCard.shippingNote" />
          </p>
          <button
            type="button"
            className={css.checkoutButton}
            onClick={() => onCheckout(currentListing)}
          >
            <FormattedMessage id="AVBagItemCard.checkout" values={{ count: 1 }} />
          </button>
        </div>
      </div>
    </li>
  );
};

export default AVBagItemCard;
