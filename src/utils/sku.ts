export const SKU_PREFIX = 'VIN';
export const SKU_SEQUENCE = 'sellable_unit_sku_seq';

const SKU_PADDING = 6;

/**
 * Numbers above 999999 keep their full length rather than being truncated:
 * a shortened SKU would collide with an existing one.
 */
export function formatSku(sequenceValue: number): string {
  if (!Number.isSafeInteger(sequenceValue) || sequenceValue < 1) {
    throw new Error(`Invalid SKU sequence value: ${sequenceValue}`);
  }

  return `${SKU_PREFIX}-${String(sequenceValue).padStart(SKU_PADDING, '0')}`;
}
