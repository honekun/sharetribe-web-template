'use strict';

const { createHash } = require('crypto');

const SELLER_USER_TYPES = new Set(['vendedor', 'vendedor-tienda']);
const PROMOTIONAL_CAMPAIGNS = new Set([
  'viewed_listing',
  'abandoned_checkout',
  'matching_listings',
  'signup_no_listing',
  'listing_no_activity',
]);

const TEMPLATE_ENV = {
  seller_welcome: 'BREVO_TEMPLATE_SELLER_WELCOME',
  viewed_listing_a: 'BREVO_TEMPLATE_VIEWED_LISTING_A',
  viewed_listing_b: 'BREVO_TEMPLATE_VIEWED_LISTING_B',
  abandoned_checkout: 'BREVO_TEMPLATE_ABANDONED_CHECKOUT',
  matching_listings_a: 'BREVO_TEMPLATE_MATCHING_LISTINGS_A',
  matching_listings_b: 'BREVO_TEMPLATE_MATCHING_LISTINGS_B',
  signup_no_listing: 'BREVO_TEMPLATE_SIGNUP_NO_LISTING',
  listing_no_activity: 'BREVO_TEMPLATE_LISTING_NO_ACTIVITY',
};

function isSellerUserType(userType) {
  return SELLER_USER_TYPES.has(userType);
}

function isPromotionalCampaign(campaign) {
  return PROMOTIONAL_CAMPAIGNS.has(campaign);
}

function stableVariant(value) {
  const digest = createHash('sha256')
    .update(String(value || 'anonymous'))
    .digest();
  return digest[0] % 2 === 0 ? 'a' : 'b';
}

function templateNameForCampaign(campaign, recipientKey) {
  const variant = stableVariant(recipientKey);
  if (campaign === 'viewed_listing') return `viewed_listing_${variant}`;
  if (campaign === 'matching_listings') return `matching_listings_${variant}`;
  return campaign;
}

function templateIdForName(templateName) {
  const envName = TEMPLATE_ENV[templateName];
  return envName ? process.env[envName] : null;
}

function missingCampaignTemplateVariables() {
  return Object.values(TEMPLATE_ENV).filter(name => {
    const value = process.env[name];
    return !Number.isInteger(Number(value)) || Number(value) <= 0;
  });
}

function marketplaceUrl(pathname = '') {
  const root = (process.env.REACT_APP_MARKETPLACE_ROOT_URL || 'https://archivovintach.com').replace(
    /\/$/,
    ''
  );
  return `${root}${pathname}`;
}

function buildCampaignEmail({ campaign, recipientKey, email, firstName, payload = {} }) {
  const templateName = templateNameForCampaign(campaign, recipientKey);
  const listing = payload.listing || {};
  const listings = Array.isArray(payload.listings) ? payload.listings.slice(0, 3) : [];
  const listingPath =
    listing.path || (listing.id ? `/l/${listing.slug || 'listing'}/${listing.id}` : '');

  return {
    email,
    name: firstName || undefined,
    templateId: templateIdForName(templateName),
    tags: ['archivo-vintach', campaign, templateName],
    params: {
      NOMBRE: firstName || 'Usuario',
      MARKETPLACE_URL: marketplaceUrl(),
      LISTING_URL: marketplaceUrl(listingPath),
      LISTING: listing,
      LISTINGS: listings,
      CREATE_LISTING_URL: marketplaceUrl('/l/new'),
      SEARCH_URL: marketplaceUrl('/s'),
      GUIDE_URL: marketplaceUrl('/static/files/ArchivoVintach-how-to.pdf'),
    },
    templateName,
  };
}

function buildSellerWelcomeEmail({ email, firstName, lastName }) {
  return {
    email,
    name: `${firstName || ''} ${lastName || ''}`.trim() || undefined,
    templateId: templateIdForName('seller_welcome'),
    tags: ['archivo-vintach', 'seller_welcome'],
    params: {
      NOMBRE: firstName || 'Usuario',
      MARKETPLACE_URL: marketplaceUrl(),
      CREATE_LISTING_URL: marketplaceUrl('/l/new'),
      GUIDE_URL: marketplaceUrl('/static/files/ArchivoVintach-how-to.pdf'),
    },
    attachments: [
      {
        path: 'public/static/files/ArchivoVintach-how-to.pdf',
        name: 'ArchivoVintach-how-to.pdf',
      },
    ],
  };
}

module.exports = {
  PROMOTIONAL_CAMPAIGNS,
  SELLER_USER_TYPES,
  TEMPLATE_ENV,
  buildCampaignEmail,
  buildSellerWelcomeEmail,
  isPromotionalCampaign,
  isSellerUserType,
  missingCampaignTemplateVariables,
  stableVariant,
  templateIdForName,
  templateNameForCampaign,
};
