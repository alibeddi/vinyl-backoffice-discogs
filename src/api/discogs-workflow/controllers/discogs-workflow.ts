import type { Core } from '@strapi/strapi';
import { DiscogsApiError } from '../../../discogs';

type WorkflowContext = {
  params: { id?: string };
  query: Record<string, unknown>;
  request: { body?: Record<string, unknown> };
  status: number;
};

type WorkflowService = {
  searchReleases(input: { tenantId: unknown; query: unknown }): Promise<unknown>;
  attachRelease(input: {
    tenantId: unknown;
    productId: unknown;
    releaseId: unknown;
  }): Promise<unknown>;
  checkCompleteness(input: { tenantId: unknown; unitId: unknown }): Promise<unknown>;
  publishListing(input: { tenantId: unknown; unitId: unknown }): Promise<unknown>;
  simulateSale(input: {
    tenantId: unknown;
    unitId: unknown;
    quantitySold?: unknown;
  }): Promise<unknown>;
};

/**
 * A marketplace outage is not the caller's fault: it must not be reported as a
 * 500, which would suggest a bug in this application.
 */
async function asGateway<T>(ctx: WorkflowContext, run: () => Promise<T>): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DiscogsApiError) {
      ctx.status = 502;
      return { error: { status: 502, name: 'DiscogsApiError', message: error.message } };
    }
    throw error;
  }
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const workflow = () =>
    strapi.service('api::discogs-workflow.discogs-workflow') as unknown as WorkflowService;

  const body = (ctx: WorkflowContext): Record<string, unknown> => ctx.request.body ?? {};

  return {
    async search(ctx: WorkflowContext) {
      return asGateway(ctx, async () => ({
        data: await workflow().searchReleases({
          tenantId: ctx.query.tenantId,
          query: ctx.query.q,
        }),
      }));
    },

    async attachRelease(ctx: WorkflowContext) {
      return asGateway(ctx, async () => ({
        data: await workflow().attachRelease({
          tenantId: body(ctx).tenantId,
          productId: ctx.params.id,
          releaseId: body(ctx).releaseId,
        }),
      }));
    },

    async checkCompleteness(ctx: WorkflowContext) {
      return {
        data: await workflow().checkCompleteness({
          tenantId: body(ctx).tenantId,
          unitId: ctx.params.id,
        }),
      };
    },

    async publish(ctx: WorkflowContext) {
      return asGateway(ctx, async () => ({
        data: await workflow().publishListing({
          tenantId: body(ctx).tenantId,
          unitId: ctx.params.id,
        }),
      }));
    },

    async simulateSale(ctx: WorkflowContext) {
      return {
        data: await workflow().simulateSale({
          tenantId: body(ctx).tenantId,
          unitId: ctx.params.id,
          quantitySold: body(ctx).quantitySold,
        }),
      };
    },
  };
};
