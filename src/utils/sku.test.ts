import { describe, expect, it } from 'vitest';
import { formatSku } from './sku';

describe('formatSku', () => {
  it('pads to the VIN-000001 format', () => {
    expect(formatSku(1)).toBe('VIN-000001');
    expect(formatSku(42)).toBe('VIN-000042');
    expect(formatSku(999999)).toBe('VIN-999999');
  });

  it('keeps the full number past the padding width instead of truncating', () => {
    expect(formatSku(1000000)).toBe('VIN-1000000');
  });

  it('never produces the same SKU for two different sequence values', () => {
    const generated = new Set([999999, 1000000, 1000001].map(formatSku));
    expect(generated.size).toBe(3);
  });

  it('rejects values a sequence can never return', () => {
    expect(() => formatSku(0)).toThrow();
    expect(() => formatSku(-1)).toThrow();
    expect(() => formatSku(1.5)).toThrow();
  });
});
