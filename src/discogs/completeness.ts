import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS, type ConditionCode } from './types';

export type CompletenessIssue = {
  field: string;
  code: string;
  message: string;
};

export type CompletenessResult = {
  valid: boolean;
  issues: CompletenessIssue[];
};

/**
 * Narrow shape rather than the Strapi entity: keeps the rule testable without
 * a database and independent of the generated content-type types.
 */
export type ListingCandidate = {
  saleStatus?: string | null;
  price?: number | null;
  currency?: string | null;
  quantity?: number | null;
  mediaCondition?: string | null;
  sleeveCondition?: string | null;
  product?: {
    discogsReleaseId?: string | null;
  } | null;
};

/**
 * Reports every problem at once: fixing a listing field by field across as many
 * round-trips as it has errors is not workable for the seller.
 */
export function validateListingPayload(unit: ListingCandidate): CompletenessResult {
  const issues: CompletenessIssue[] = [];

  const add = (field: string, code: string, message: string) =>
    issues.push({ field, code, message });

  if (!unit.product) {
    add('product', 'PRODUCT_MISSING', 'The unit is not linked to a catalogue product.');
  } else if (!unit.product.discogsReleaseId) {
    add(
      'product.discogsReleaseId',
      'RELEASE_NOT_ATTACHED',
      'The product has no Discogs release attached.'
    );
  }

  if (unit.price === null || unit.price === undefined) {
    add('price', 'PRICE_MISSING', 'A price is required.');
  } else if (!(unit.price > 0)) {
    add('price', 'PRICE_NOT_POSITIVE', 'The price must be greater than zero.');
  }

  if (!unit.currency) {
    add('currency', 'CURRENCY_MISSING', 'A currency is required.');
  }

  if (unit.quantity === null || unit.quantity === undefined) {
    add('quantity', 'QUANTITY_MISSING', 'A quantity is required.');
  } else if (unit.quantity < 1) {
    add('quantity', 'QUANTITY_NOT_AVAILABLE', 'The quantity must be at least 1.');
  }

  validateCondition(unit.mediaCondition, 'mediaCondition', MEDIA_CONDITIONS, add);
  validateCondition(unit.sleeveCondition, 'sleeveCondition', SLEEVE_CONDITIONS, add);

  if (unit.saleStatus !== 'available') {
    add(
      'saleStatus',
      'NOT_AVAILABLE',
      `Only an available unit can be published (current status: ${unit.saleStatus ?? 'unknown'}).`
    );
  }

  return { valid: issues.length === 0, issues };
}

function validateCondition(
  value: string | null | undefined,
  field: string,
  allowed: readonly ConditionCode[],
  add: (field: string, code: string, message: string) => void
): void {
  if (!value) {
    add(field, 'CONDITION_MISSING', `${field} is required to publish on Discogs.`);
    return;
  }

  if (!allowed.includes(value as ConditionCode)) {
    add(field, 'CONDITION_INVALID', `"${value}" is not a valid ${field} for Discogs.`);
  }
}
