const { findListingAuthor, resolveProviderCommission } = require('./providerCommission');

const author = (id, metadata, type = 'user') => ({
  id: { uuid: id },
  type,
  attributes: { profile: { metadata } },
});

const listing = (authorId, authorType = 'user') => ({
  id: { uuid: 'listing-1' },
  type: authorType === 'currentUser' ? 'ownListing' : 'listing',
  relationships: authorId ? { author: { data: { id: { uuid: authorId }, type: authorType } } } : {},
});

const hosted = { percentage: 22, minimum_amount: 0 };

describe('findListingAuthor', () => {
  it('finds the author among the included entities', () => {
    const seller = author('seller-1', {});
    const included = [{ id: { uuid: 'image-1' }, type: 'image' }, seller];
    expect(findListingAuthor(listing('seller-1'), included)).toBe(seller);
  });

  it('finds a currentUser author included with an own listing', () => {
    const seller = author('seller-1', {}, 'currentUser');
    expect(findListingAuthor(listing('seller-1', 'currentUser'), [seller])).toBe(seller);
  });

  it('does not take an image or another entity that shares the id', () => {
    const included = [{ id: { uuid: 'seller-1' }, type: 'image' }];
    expect(findListingAuthor(listing('seller-1'), included)).toBeNull();
  });

  it('returns null without an author relationship or included entities', () => {
    expect(findListingAuthor(listing(null), [author('seller-1', {})])).toBeNull();
    expect(findListingAuthor(listing('seller-1'), undefined)).toBeNull();
    expect(findListingAuthor(null, [])).toBeNull();
  });
});

describe('resolveProviderCommission', () => {
  let warn;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('returns the hosted commission for a seller without an override', () => {
    expect(resolveProviderCommission(hosted, author('seller-1', {}))).toBe(hosted);
    expect(warn).not.toHaveBeenCalled();
  });

  it("applies the seller's override", () => {
    const seller = author('seller-1', { avCommissionPercentage: 15 });
    expect(resolveProviderCommission(hosted, seller)).toEqual({ percentage: 15 });
  });

  it('applies an override of zero', () => {
    const seller = author('seller-1', { avCommissionPercentage: 0 });
    expect(resolveProviderCommission(hosted, seller)).toEqual({ percentage: 0 });
  });

  it('falls back to the hosted commission for an invalid value and warns with the user id', () => {
    const seller = author('seller-1', { avCommissionPercentage: 30 });
    expect(resolveProviderCommission(hosted, seller)).toBe(hosted);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(' ')).toMatch(/seller-1/);
  });

  it('throws when the author is unknown, instead of guessing the rate', () => {
    expect(() => resolveProviderCommission(hosted, null)).toThrow(
      'Listing author unavailable: provider commission cannot be resolved'
    );
  });
});
