import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import {
  createDiscogsConnector,
  validateListingPayload,
  DISCOGS_CONDITION_LABELS,
  type CompletenessResult,
  type DiscogsConfig,
  type ListingCandidate,
} from '../../../discogs';
import type { ConditionCode } from '../../../discogs/types';
import type { RecordEventInput, SyncAction } from '../../marketplace-sync-event/services/marketplace-sync-event';

const { NotFoundError, ApplicationError, ValidationError } = errors;

type ListingStatus = 'not_published' | 'pending' | 'published' | 'failed' | 'removed' | 'sync_error';

type JournalContext = {
  tenantId: string;
  action: SyncAction;
  productId?: string;
  sellableUnitId?: string;
  channelListingId?: string;
};

/**
 * Strapi resolves services by string uid, which loses their type. These two
 * shapes describe what this workflow actually calls.
 */
type TenantService = { resolveActive(tenantId: unknown): Promise<{ documentId: string }> };
type JournalService = { record(input: RecordEventInput): Promise<void> };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function conditionLabel(code: ConditionCode): string {
  return DISCOGS_CONDITION_LABELS[code];
}

/** Strapi returns null when a document vanished between read and write. */
function mustExist<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new ApplicationError(message);
  }
  return value;
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const connector = createDiscogsConnector(strapi.config.get('discogs') as DiscogsConfig);

  const tenantService = () => strapi.service('api::tenant.tenant') as unknown as TenantService;
  const journal = () =>
    strapi.service(
      'api::marketplace-sync-event.marketplace-sync-event'
    ) as unknown as JournalService;

  const record = (context: JournalContext, rest: Omit<RecordEventInput, keyof JournalContext>) =>
    journal().record({ ...context, ...rest });

  const recordFailure = (context: JournalContext, error: unknown) =>
    record(context, { status: 'error', message: describeError(error) });

  /**
   * Filtering by tenant inside the query means another tenant's record is not
   * found rather than found-then-rejected: it is never read in the first place.
   */
  async function requireProduct(productId: unknown, tenantId: string) {
    if (typeof productId !== 'string' || productId.trim() === '') {
      throw new ValidationError('A product id is required.');
    }

    const product = await strapi.documents('api::product.product').findFirst({
      filters: { documentId: productId, tenant: { documentId: tenantId } },
    });

    if (!product) {
      throw new NotFoundError(`Product ${productId} not found for this tenant.`);
    }

    return product;
  }

  async function requireUnit(unitId: unknown, tenantId: string) {
    if (typeof unitId !== 'string' || unitId.trim() === '') {
      throw new ValidationError('A sellable unit id is required.');
    }

    const unit = await strapi.documents('api::sellable-unit.sellable-unit').findFirst({
      filters: { documentId: unitId, tenant: { documentId: tenantId } },
      populate: { product: true, channelListing: true },
    });

    if (!unit) {
      throw new NotFoundError(`Sellable unit ${unitId} not found for this tenant.`);
    }

    return unit;
  }

  /** Explicit mapping rather than a cast: it documents what the rule reads. */
  function toCandidate(unit: {
    saleStatus?: string | null;
    price?: number | null;
    currency?: string | null;
    quantity?: number | null;
    mediaCondition?: string | null;
    sleeveCondition?: string | null;
    sellerComment?: string | null;
    product?: { discogsReleaseId?: string | null } | null;
  }): ListingCandidate {
    return {
      saleStatus: unit.saleStatus,
      price: unit.price,
      currency: unit.currency,
      quantity: unit.quantity,
      mediaCondition: unit.mediaCondition,
      sleeveCondition: unit.sleeveCondition,
      sellerComment: unit.sellerComment,
      product: unit.product ? { discogsReleaseId: unit.product.discogsReleaseId } : null,
    };
  }

  async function upsertListing(
    tenantId: string,
    sellableUnitId: string,
    status: ListingStatus,
    data: { lastErrorMessage?: string } = {}
  ) {
    const existing = await strapi.documents('api::channel-listing.channel-listing').findFirst({
      filters: { sellableUnit: { documentId: sellableUnitId }, tenant: { documentId: tenantId } },
    });

    if (existing) {
      return mustExist(
        await strapi.documents('api::channel-listing.channel-listing').update({
          documentId: existing.documentId,
          data: { status, ...data },
        }),
        `Channel listing ${existing.documentId} vanished while being updated.`
      );
    }

    return strapi.documents('api::channel-listing.channel-listing').create({
      data: { tenant: tenantId, sellableUnit: sellableUnitId, channel: 'discogs', status, ...data },
    });
  }

  return {
    async searchReleases(input: { tenantId: unknown; query: unknown }) {
      const tenant = await tenantService().resolveActive(input.tenantId);

      if (typeof input.query !== 'string' || input.query.trim() === '') {
        throw new ValidationError('The search query "q" is required.');
      }

      const query = input.query.trim();
      const context: JournalContext = { tenantId: tenant.documentId, action: 'search_release' };

      try {
        const results = await connector.searchReleases(query);
        await record(context, {
          status: 'success',
          message: `Discogs search for "${query}" returned ${results.length} release(s).`,
          payload: { query, resultCount: results.length, mode: connector.mode },
        });
        return results;
      } catch (error) {
        await recordFailure(context, error);
        throw error;
      }
    },

    async attachRelease(input: { tenantId: unknown; productId: unknown; releaseId: unknown }) {
      const tenant = await tenantService().resolveActive(input.tenantId);

      if (typeof input.releaseId !== 'string' || input.releaseId.trim() === '') {
        throw new ValidationError('A releaseId is required.');
      }

      const releaseId = input.releaseId.trim();
      const product = await requireProduct(input.productId, tenant.documentId);
      const context: JournalContext = {
        tenantId: tenant.documentId,
        action: 'attach_release',
        productId: product.documentId,
      };

      try {
        const release = await connector.getRelease(releaseId);
        if (!release) {
          throw new NotFoundError(`Discogs release ${releaseId} not found.`);
        }

        // Catalogue data already entered by the seller wins over Discogs data.
        const updated = await strapi.documents('api::product.product').update({
          documentId: product.documentId,
          data: {
            discogsReleaseId: release.releaseId,
            discogsMasterId: release.masterId ?? product.discogsMasterId ?? undefined,
            label: product.label || release.label || undefined,
            year: product.year ?? release.year ?? undefined,
            country: product.country || release.country || undefined,
            format: product.format || release.format || undefined,
          },
        });

        await record(context, {
          status: 'success',
          message: `Discogs release ${release.releaseId} (${release.artist} - ${release.title}) attached.`,
          payload: { releaseId: release.releaseId, masterId: release.masterId ?? null },
        });

        return updated;
      } catch (error) {
        await recordFailure(context, error);
        throw error;
      }
    },

    async checkCompleteness(input: {
      tenantId: unknown;
      unitId: unknown;
    }): Promise<CompletenessResult> {
      const tenant = await tenantService().resolveActive(input.tenantId);
      const unit = await requireUnit(input.unitId, tenant.documentId);
      const result = validateListingPayload(toCandidate(unit));

      /**
       * An incomplete unit is recorded as an error: the journal is scanned to
       * find what is blocking, so a negative outcome must stand out.
       */
      await record(
        {
          tenantId: tenant.documentId,
          action: 'check_completeness',
          sellableUnitId: unit.documentId,
          productId: unit.product?.documentId,
        },
        {
          status: result.valid ? 'success' : 'error',
          message: result.valid
            ? `Unit ${unit.sku} is ready to be published on Discogs.`
            : `Unit ${unit.sku} is not publishable: ${result.issues.map((i) => i.code).join(', ')}.`,
          payload: { issues: result.issues },
        }
      );

      return result;
    },

    async publishListing(input: { tenantId: unknown; unitId: unknown }) {
      const tenant = await tenantService().resolveActive(input.tenantId);
      const unit = await requireUnit(input.unitId, tenant.documentId);
      const completeness = validateListingPayload(toCandidate(unit));

      const context: JournalContext = {
        tenantId: tenant.documentId,
        action: 'publish_listing',
        sellableUnitId: unit.documentId,
        productId: unit.product?.documentId,
      };

      if (!completeness.valid) {
        const listing = await upsertListing(tenant.documentId, unit.documentId, 'failed', {
          lastErrorMessage: completeness.issues.map((i) => i.message).join(' '),
        });

        await record(
          { ...context, channelListingId: listing.documentId },
          {
            status: 'error',
            message: `Publication refused: ${completeness.issues.map((i) => i.code).join(', ')}.`,
            payload: { issues: completeness.issues },
          }
        );

        throw new ApplicationError('The unit is not ready to be published on Discogs.', {
          issues: completeness.issues,
        });
      }

      const { payload } = completeness;
      const pending = await upsertListing(tenant.documentId, unit.documentId, 'pending', {
        lastErrorMessage: '',
      });

      try {
        const published = await connector.publishListing(payload);

        const listing = mustExist(
          await strapi.documents('api::channel-listing.channel-listing').update({
            documentId: pending.documentId,
            data: {
              status: 'published',
              externalListingId: published.externalListingId,
              externalUrl: published.externalUrl,
              publishedPrice: payload.price,
              lastSyncedAt: new Date().toISOString(),
              lastErrorMessage: '',
            },
          }),
          `Channel listing ${pending.documentId} vanished while being published.`
        );

        await record(
          { ...context, channelListingId: listing.documentId },
          {
            status: 'success',
            message: `Unit ${unit.sku} published on Discogs as ${published.externalListingId}.`,
            payload: {
              mode: connector.mode,
              externalListingId: published.externalListingId,
              price: payload.price,
              currency: payload.currency,
              mediaCondition: conditionLabel(payload.mediaCondition),
              sleeveCondition: conditionLabel(payload.sleeveCondition),
            },
          }
        );

        return listing;
      } catch (error) {
        // A marketplace outage is a sync_error, not a validation failure.
        const listing = mustExist(
          await strapi.documents('api::channel-listing.channel-listing').update({
            documentId: pending.documentId,
            data: {
              status: 'sync_error',
              lastErrorMessage: describeError(error),
              lastSyncedAt: new Date().toISOString(),
            },
          }),
          `Channel listing ${pending.documentId} vanished while recording a failure.`
        );

        await recordFailure({ ...context, channelListingId: listing.documentId }, error);
        throw error;
      }
    },

    async simulateSale(input: { tenantId: unknown; unitId: unknown; quantitySold?: unknown }) {
      const tenant = await tenantService().resolveActive(input.tenantId);
      const unit = await requireUnit(input.unitId, tenant.documentId);

      const quantitySold = input.quantitySold === undefined ? 1 : Number(input.quantitySold);
      if (!Number.isInteger(quantitySold) || quantitySold < 1) {
        throw new ValidationError('quantitySold must be a positive integer.');
      }

      if (unit.saleStatus !== 'available') {
        throw new ApplicationError(
          `Unit ${unit.sku} cannot be sold while its status is "${unit.saleStatus}".`
        );
      }

      const inStock = unit.quantity ?? 0;
      if (quantitySold > inStock) {
        throw new ValidationError(`Cannot sell ${quantitySold} item(s): only ${inStock} in stock.`);
      }

      const remaining = inStock - quantitySold;
      const saleStatus = remaining === 0 ? 'sold' : 'available';

      const updatedUnit = await strapi.documents('api::sellable-unit.sellable-unit').update({
        documentId: unit.documentId,
        data: { quantity: remaining, saleStatus },
      });

      // Nothing is left to buy, so the listing must no longer be offered.
      let listing = unit.channelListing ?? null;
      if (listing && remaining === 0) {
        listing = mustExist(
          await strapi.documents('api::channel-listing.channel-listing').update({
            documentId: listing.documentId,
            data: { status: 'removed', lastSyncedAt: new Date().toISOString() },
          }),
          `Channel listing ${listing.documentId} vanished while being removed.`
        );
      }

      await record(
        {
          tenantId: tenant.documentId,
          action: 'mark_out_of_stock',
          sellableUnitId: unit.documentId,
          productId: unit.product?.documentId,
          channelListingId: listing?.documentId,
        },
        {
          status: 'success',
          message: `Sale of ${quantitySold} item(s) for unit ${unit.sku}: ${remaining} left, status "${saleStatus}".`,
          payload: { quantitySold, remaining, saleStatus },
        }
      );

      return { unit: updatedUnit, listing };
    },
  };
};
