import type { Core } from '@strapi/strapi';
import { SKU_SEQUENCE } from './utils/sku';

/**
 * Strapi validates `unique: true` in the application layer only, so concurrent
 * inserts can still produce duplicate SKUs. The sequence makes generation atomic
 * and the partial index turns uniqueness into a database guarantee.
 * Both statements run after Strapi has synced its own schema.
 */
async function ensureSkuConstraints(strapi: Core.Strapi): Promise<void> {
  await strapi.db.connection.raw(`CREATE SEQUENCE IF NOT EXISTS ${SKU_SEQUENCE} START 1`);
  await strapi.db.connection.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS sellable_units_sku_unique
       ON sellable_units (sku)
       WHERE sku IS NOT NULL`
  );
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureSkuConstraints(strapi);
  },
};
