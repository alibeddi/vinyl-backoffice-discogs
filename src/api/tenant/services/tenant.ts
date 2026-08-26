import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ValidationError, NotFoundError, ForbiddenError } = errors;

export type ResolvedTenant = { documentId: string };

export default factories.createCoreService('api::tenant.tenant', ({ strapi }) => ({
  /**
   * Entry point of every tenant-scoped operation. An inactive tenant is rejected
   * here so no business endpoint has to re-check it.
   */
  async resolveActive(tenantId: unknown): Promise<ResolvedTenant> {
    if (typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new ValidationError('tenantId is required');
    }

    const tenant = await strapi.documents('api::tenant.tenant').findOne({ documentId: tenantId });

    if (!tenant) {
      throw new NotFoundError(`Tenant ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      throw new ForbiddenError(`Tenant ${tenantId} is inactive`);
    }

    return { documentId: tenant.documentId };
  },
}));
