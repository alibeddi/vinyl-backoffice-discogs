import { describe, expect, it } from 'vitest';
import { validateListingPayload, type ListingCandidate } from './completeness';

const publishable: ListingCandidate = {
  saleStatus: 'available',
  price: 29.9,
  currency: 'EUR',
  quantity: 1,
  mediaCondition: 'NEAR_MINT',
  sleeveCondition: 'VERY_GOOD_PLUS',
  product: { discogsReleaseId: '123456' },
};

const codesFor = (unit: ListingCandidate) =>
  validateListingPayload(unit).issues.map((issue) => issue.code);

describe('validateListingPayload', () => {
  it('accepts a complete unit and returns the payload it validated', () => {
    const result = validateListingPayload({ ...publishable, sellerComment: 'Sleeve slightly worn' });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.payload).toEqual({
      releaseId: '123456',
      price: 29.9,
      currency: 'EUR',
      quantity: 1,
      mediaCondition: 'NEAR_MINT',
      sleeveCondition: 'VERY_GOOD_PLUS',
      comments: 'Sleeve slightly worn',
    });
  });

  it('returns no payload when the unit is not publishable', () => {
    expect(validateListingPayload({ ...publishable, price: 0 }).payload).toBeUndefined();
  });

  it('rejects a unit with no product', () => {
    expect(codesFor({ ...publishable, product: null })).toContain('PRODUCT_MISSING');
  });

  it('rejects a product without a Discogs release', () => {
    expect(codesFor({ ...publishable, product: { discogsReleaseId: null } })).toContain(
      'RELEASE_NOT_ATTACHED'
    );
  });

  it('rejects a non-positive price but accepts a small one', () => {
    expect(codesFor({ ...publishable, price: 0 })).toContain('PRICE_NOT_POSITIVE');
    expect(codesFor({ ...publishable, price: -5 })).toContain('PRICE_NOT_POSITIVE');
    expect(codesFor({ ...publishable, price: null })).toContain('PRICE_MISSING');
    expect(validateListingPayload({ ...publishable, price: 0.01 }).valid).toBe(true);
  });

  it('rejects a unit that is out of stock', () => {
    expect(codesFor({ ...publishable, quantity: 0 })).toContain('QUANTITY_NOT_AVAILABLE');
  });

  it('requires both conditions', () => {
    expect(codesFor({ ...publishable, mediaCondition: null })).toContain('CONDITION_MISSING');
    expect(codesFor({ ...publishable, sleeveCondition: null })).toContain('CONDITION_MISSING');
  });

  it('rejects a sleeve-only grading applied to the record itself', () => {
    expect(codesFor({ ...publishable, mediaCondition: 'GENERIC' })).toContain('CONDITION_INVALID');
    expect(validateListingPayload({ ...publishable, sleeveCondition: 'GENERIC' }).valid).toBe(true);
  });

  it('refuses to publish a unit that is already sold', () => {
    expect(codesFor({ ...publishable, saleStatus: 'sold' })).toContain('NOT_AVAILABLE');
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const codes = codesFor({
      saleStatus: 'sold',
      price: 0,
      currency: null,
      quantity: 0,
      mediaCondition: null,
      sleeveCondition: null,
      product: null,
    });

    expect(codes).toEqual(
      expect.arrayContaining([
        'PRODUCT_MISSING',
        'PRICE_NOT_POSITIVE',
        'CURRENCY_MISSING',
        'QUANTITY_NOT_AVAILABLE',
        'CONDITION_MISSING',
        'NOT_AVAILABLE',
      ])
    );
  });
});
