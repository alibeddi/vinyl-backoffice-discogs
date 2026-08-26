import {
  MEDIA_CONDITIONS,
  SLEEVE_CONDITIONS,
  type ConditionCode,
  type ListingPayload,
} from './types';

export type CompletenessIssue = {
  field: string;
  code: string;
  message: string;
};

/**
 * A valid result carries the payload it validated, so the caller never has to
 * re-check the same fields to satisfy the type system.
 */
export type CompletenessResult =
  | { valid: true; issues: CompletenessIssue[]; payload: ListingPayload }
  | { valid: false; issues: CompletenessIssue[]; payload?: undefined };

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
  sellerComment?: string | null;
  product?: {
    discogsReleaseId?: string | null;
  } | null;
};

type AddIssue = (field: string, code: string, message: string) => void;

/**
 * Reports every problem at once: fixing a listing field by field across as many
 * round-trips as it has errors is not workable for the seller.
 */
export function validateListingPayload(unit: ListingCandidate): CompletenessResult {
  const issues: CompletenessIssue[] = [];
  const add: AddIssue = (field, code, message) => issues.push({ field, code, message });

  const releaseId = unit.product?.discogsReleaseId ?? null;
  if (!unit.product) {
    add('product', 'PRODUCT_MISSING', 'The unit is not linked to a catalogue product.');
  } else if (!releaseId) {
    add(
      'product.discogsReleaseId',
      'RELEASE_NOT_ATTACHED',
      'The product has no Discogs release attached.'
    );
  }

  const price = unit.price ?? null;
  if (price === null) {
    add('price', 'PRICE_MISSING', 'A price is required.');
  } else if (!(price > 0)) {
    add('price', 'PRICE_NOT_POSITIVE', 'The price must be greater than zero.');
  }

  const currency = unit.currency ?? null;
  if (!currency) {
    add('currency', 'CURRENCY_MISSING', 'A currency is required.');
  }

  const quantity = unit.quantity ?? null;
  if (quantity === null) {
    add('quantity', 'QUANTITY_MISSING', 'A quantity is required.');
  } else if (quantity < 1) {
    add('quantity', 'QUANTITY_NOT_AVAILABLE', 'The quantity must be at least 1.');
  }

  const mediaCondition = readCondition(unit.mediaCondition, 'mediaCondition', MEDIA_CONDITIONS, add);
  const sleeveCondition = readCondition(
    unit.sleeveCondition,
    'sleeveCondition',
    SLEEVE_CONDITIONS,
    add
  );

  if (unit.saleStatus !== 'available') {
    add(
      'saleStatus',
      'NOT_AVAILABLE',
      `Only an available unit can be published (current status: ${unit.saleStatus ?? 'unknown'}).`
    );
  }

  // The value checks below are redundant at runtime but let the compiler build
  // the payload without assertions.
  if (
    issues.length > 0 ||
    !releaseId ||
    price === null ||
    !currency ||
    quantity === null ||
    !mediaCondition ||
    !sleeveCondition
  ) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    issues: [],
    payload: {
      releaseId,
      price,
      currency,
      quantity,
      mediaCondition,
      sleeveCondition,
      comments: unit.sellerComment ?? undefined,
    },
  };
}

function readCondition(
  value: string | null | undefined,
  field: string,
  allowed: readonly ConditionCode[],
  add: AddIssue
): ConditionCode | null {
  if (!value) {
    add(field, 'CONDITION_MISSING', `${field} is required to publish on Discogs.`);
    return null;
  }

  const code = allowed.find((candidate) => candidate === value);
  if (!code) {
    add(field, 'CONDITION_INVALID', `"${value}" is not a valid ${field} for Discogs.`);
    return null;
  }

  return code;
}
