import { factories } from '@strapi/strapi';
import { formatSku, SKU_SEQUENCE } from '../../../utils/sku';

type SequenceRow = { nextval: string };

export default factories.createCoreService('api::sellable-unit.sellable-unit', ({ strapi }) => ({
  /**
   * `nextval` is atomic, so concurrent creations never receive the same number.
   * Postgres returns bigint as a string.
   */
  async generateSku(): Promise<string> {
    const result: { rows: SequenceRow[] } = await strapi.db.connection.raw(
      `SELECT nextval('${SKU_SEQUENCE}')`
    );

    return formatSku(Number(result.rows[0].nextval));
  },
}));
