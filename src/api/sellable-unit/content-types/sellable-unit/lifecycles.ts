type BeforeCreateEvent = {
  params: { data: { sku?: string } };
};

export default {
  /**
   * The SKU is a backend responsibility: any client-supplied value is discarded.
   */
  async beforeCreate(event: BeforeCreateEvent) {
    event.params.data.sku = await strapi
      .service('api::sellable-unit.sellable-unit')
      .generateSku();
  },
};
