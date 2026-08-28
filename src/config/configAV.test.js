import {
  canShowOriginalPrice,
  canShowWelcomePopup,
  defaultCountry,
  getStoreTypeTags,
  isNavPageHiddenForUser,
  isNavPageHiddenForUserType,
  moveListingFieldToEnd,
  sellerUserTypes,
  storeSellerHiddenNavPages,
  storeSellerUserType,
  storeTypeFieldKey,
  welcomePopupUserTypes,
} from './configAV';

const userWith = userType => ({
  attributes: { profile: { publicData: { userType } } },
});

describe('configAV', () => {
  it('defaults country to MX', () => {
    expect(defaultCountry).toBe('MX');
  });

  it('lists vendedor user types', () => {
    expect(sellerUserTypes).toEqual(['vendedor', 'vendedor-stock']);
  });

  describe('getStoreTypeTags', () => {
    const storeAuthor = (tipoTienda, userType = 'vendedor-tienda') => ({
      attributes: { profile: { publicData: { userType, tipoTienda } } },
    });
    const config = {
      user: {
        userFields: [
          {
            key: 'tipoTienda',
            schemaType: 'multi-enum',
            enumOptions: [
              { option: 'trending', label: 'Trending' },
              { option: 'holiday', label: 'Holiday' },
            ],
          },
        ],
      },
    };

    it('exposes the store seller userType', () => {
      expect(storeSellerUserType).toBe('vendedor-tienda');
    });

    it('exposes the store type field key', () => {
      expect(storeTypeFieldKey).toBe('tipoTienda');
    });

    it('returns tags when called without a config argument', () => {
      expect(getStoreTypeTags(storeAuthor(['x']))).toEqual([{ key: 'x', label: 'x' }]);
    });

    it('maps tipoTienda values to configured labels', () => {
      expect(getStoreTypeTags(storeAuthor(['trending', 'holiday']), config)).toEqual([
        { key: 'trending', label: 'Trending' },
        { key: 'holiday', label: 'Holiday' },
      ]);
    });

    it('normalizes a single string value to one tag', () => {
      expect(getStoreTypeTags(storeAuthor('trending'), config)).toEqual([
        { key: 'trending', label: 'Trending' },
      ]);
    });

    it('falls back to the raw value when the field is not configured', () => {
      expect(getStoreTypeTags(storeAuthor(['x']), { user: { userFields: [] } })).toEqual([
        { key: 'x', label: 'x' },
      ]);
    });

    it('returns [] for non-store user types', () => {
      expect(getStoreTypeTags(storeAuthor(['trending'], 'comprador'), config)).toEqual([]);
    });

    it('returns [] when there is no tipoTienda or no author', () => {
      expect(getStoreTypeTags(storeAuthor(undefined), config)).toEqual([]);
      expect(getStoreTypeTags(null, config)).toEqual([]);
    });
  });

  describe('canShowOriginalPrice', () => {
    it('returns true for vendedor', () => {
      expect(canShowOriginalPrice(userWith('vendedor'))).toBe(true);
    });
    it('returns true for vendedor-stock', () => {
      expect(canShowOriginalPrice(userWith('vendedor-stock'))).toBe(true);
    });
    it('returns false for other user types', () => {
      expect(canShowOriginalPrice(userWith('comprador'))).toBe(false);
    });
    it('returns false when currentUser is null or has no userType', () => {
      expect(canShowOriginalPrice(null)).toBe(false);
      expect(canShowOriginalPrice({})).toBe(false);
      expect(canShowOriginalPrice(userWith(undefined))).toBe(false);
    });
  });

  describe('canShowWelcomePopup', () => {
    const seller = (userType, extra = {}) => ({
      attributes: { profile: { publicData: { userType, ...extra } } },
    });

    it('lists the welcome popup user types', () => {
      expect(welcomePopupUserTypes).toEqual(['vendedor', 'vendedor-tienda']);
    });
    it('returns true for a seller who has not completed onboarding', () => {
      expect(canShowWelcomePopup(seller('vendedor'))).toBe(true);
      expect(canShowWelcomePopup(seller('vendedor-tienda'))).toBe(true);
    });
    it('returns false once onboarding is completed', () => {
      expect(canShowWelcomePopup(seller('vendedor', { onboardingCompleted: true }))).toBe(false);
    });
    it('returns false for non-popup user types', () => {
      expect(canShowWelcomePopup(seller('vendedor-stock'))).toBe(false);
      expect(canShowWelcomePopup(seller('comprador'))).toBe(false);
    });
    it('returns false when currentUser is null or has no userType', () => {
      expect(canShowWelcomePopup(null)).toBe(false);
      expect(canShowWelcomePopup({})).toBe(false);
      expect(canShowWelcomePopup(seller(undefined))).toBe(false);
    });
  });

  describe('nav visibility', () => {
    it('hides the buyer-side entries from store sellers', () => {
      expect(storeSellerHiddenNavPages).toEqual([
        'MyAddressesPage',
        'FavoritesPage',
        'InboxPage:orders',
      ]);
      storeSellerHiddenNavPages.forEach(page => {
        expect(isNavPageHiddenForUser(userWith(storeSellerUserType), page)).toBe(true);
      });
    });

    // Only the orders tab goes. The inbox itself is where a store seller reads
    // messages about their sales, so the envelope and the sales tab stay.
    it('hides the inbox orders tab but not the inbox itself', () => {
      const store = userWith(storeSellerUserType);
      expect(isNavPageHiddenForUser(store, 'InboxPage:orders')).toBe(true);
      expect(isNavPageHiddenForUser(store, 'InboxPage')).toBe(false);
      expect(isNavPageHiddenForUser(store, 'InboxPage:sales')).toBe(false);
    });

    it('leaves every other page visible to store sellers', () => {
      const store = userWith(storeSellerUserType);
      expect(isNavPageHiddenForUser(store, 'MyPurchasesPage')).toBe(false);
      expect(isNavPageHiddenForUser(store, 'MySalesPage')).toBe(false);
      expect(isNavPageHiddenForUser(store, 'MyBalancePage')).toBe(false);
      expect(isNavPageHiddenForUser(store, 'ManageListingsPage')).toBe(false);
    });

    // The gate is per userType, not per role: other sellers still buy on the
    // marketplace, so nothing is hidden from them.
    it('hides nothing from other user types', () => {
      ['vendedor', 'vendedor-stock', 'comprador', undefined].forEach(userType => {
        storeSellerHiddenNavPages.forEach(page => {
          expect(isNavPageHiddenForUser(userWith(userType), page)).toBe(false);
        });
      });
    });

    it('hides nothing when there is no signed-in user', () => {
      storeSellerHiddenNavPages.forEach(page => {
        expect(isNavPageHiddenForUser(null, page)).toBe(false);
        expect(isNavPageHiddenForUser(undefined, page)).toBe(false);
        expect(isNavPageHiddenForUser({}, page)).toBe(false);
      });
    });

    it('takes a bare userType as well as a user', () => {
      expect(isNavPageHiddenForUserType(storeSellerUserType, 'FavoritesPage')).toBe(true);
      expect(isNavPageHiddenForUserType('vendedor', 'FavoritesPage')).toBe(false);
      expect(isNavPageHiddenForUserType(storeSellerUserType, 'MySalesPage')).toBe(false);
    });
  });
});

describe('moveListingFieldToEnd', () => {
  it('moves the requested field to the end while preserving other order', () => {
    const fields = [{ key: 'color' }, { key: 'tags' }, { key: 'all_sizes' }, { key: 'brand' }];

    const reordered = moveListingFieldToEnd(fields, 'tags');

    expect(reordered.map(field => field.key)).toEqual(['color', 'all_sizes', 'brand', 'tags']);
  });

  it('returns the original array when the target key is missing', () => {
    const fields = [{ key: 'color' }, { key: 'all_sizes' }];

    expect(moveListingFieldToEnd(fields, 'tags')).toEqual(fields);
  });
});
