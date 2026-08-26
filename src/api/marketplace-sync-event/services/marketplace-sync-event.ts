import { factories } from '@strapi/strapi';

export type SyncAction =
  | 'search_release'
  | 'attach_release'
  | 'check_completeness'
  | 'publish_listing'
  | 'mark_out_of_stock';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type RecordEventInput = {
  tenantId: string;
  action: SyncAction;
  status: 'success' | 'error';
  message: string;
  payload?: Record<string, JsonValue>;
  productId?: string;
  sellableUnitId?: string;
  channelListingId?: string;
};

export default factories.createCoreService(
  'api::marketplace-sync-event.marketplace-sync-event',
  ({ strapi }) => ({
    /**
     * Failures are recorded as well as successes: a journal that only contains
     * what worked cannot be used to diagnose anything.
     */
    async record(input: RecordEventInput): Promise<void> {
      await strapi.documents('api::marketplace-sync-event.marketplace-sync-event').create({
        data: {
          tenant: input.tenantId,
          channel: 'discogs',
          action: input.action,
          status: input.status,
          message: input.message,
          payload: input.payload ?? null,
          product: input.productId ?? null,
          sellableUnit: input.sellableUnitId ?? null,
          channelListing: input.channelListingId ?? null,
          occurredAt: new Date().toISOString(),
        },
      });
    },
  })
);
