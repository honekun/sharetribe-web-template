'use strict';

const {
  buildCampaignEmail,
  buildSellerWelcomeEmail,
  isSellerUserType,
  stableVariant,
  templateNameForCampaign,
} = require('./marketingCampaigns');

describe('marketing campaign configuration', () => {
  beforeEach(() => {
    process.env.BREVO_TEMPLATE_SELLER_WELCOME = '101';
    process.env.REACT_APP_MARKETPLACE_ROOT_URL = 'https://example.com/';
  });

  test('uses only the approved seller user types', () => {
    expect(isSellerUserType('vendedor')).toBe(true);
    expect(isSellerUserType('vendedor-tienda')).toBe(true);
    expect(isSellerUserType('vendedor-stock')).toBe(false);
    expect(isSellerUserType('comprador')).toBe(false);
  });

  test('assigns deterministic A/B variants', () => {
    expect(stableVariant('user-1')).toBe(stableVariant('user-1'));
    expect(templateNameForCampaign('viewed_listing', 'user-1')).toMatch(/^viewed_listing_[ab]$/);
    expect(templateNameForCampaign('matching_listings', 'user-1')).toMatch(
      /^matching_listings_[ab]$/
    );
  });

  test('seller welcome uses the hosted template and approved static guide', () => {
    expect(
      buildSellerWelcomeEmail({
        email: 'seller@example.com',
        firstName: 'Sofía',
        lastName: 'López',
      })
    ).toEqual(
      expect.objectContaining({
        email: 'seller@example.com',
        templateId: '101',
        params: expect.objectContaining({
          NOMBRE: 'Sofía',
          CREATE_LISTING_URL: 'https://example.com/l/new',
          GUIDE_URL: 'https://example.com/static/files/HowTo-AV_low.pdf',
        }),
        attachments: [
          {
            path: 'public/static/files/HowTo-AV_low.pdf',
            name: 'ArchivoVintach-how-to.pdf',
          },
        ],
      })
    );
  });

  test('campaigns link the same seller guide as the welcome', () => {
    expect(
      buildCampaignEmail({
        campaign: 'signup_no_listing',
        recipientKey: 'user-1',
        email: 'seller@example.com',
        firstName: 'Sofía',
      }).params.GUIDE_URL
    ).toBe('https://example.com/static/files/HowTo-AV_low.pdf');
  });

  test('the attached seller guide is committed', () => {
    const fs = require('fs');
    const path = require('path');
    const [guide] = buildSellerWelcomeEmail({ email: 'seller@example.com' }).attachments;
    expect(fs.existsSync(path.resolve(__dirname, '../..', guide.path))).toBe(true);
  });
});
