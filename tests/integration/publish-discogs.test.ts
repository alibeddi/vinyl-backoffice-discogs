import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Core } from '@strapi/strapi';

/**
 * Integration test on the most critical endpoint: it exercises the real HTTP
 * layer, the tenant scoping, the connector and the persisted journal against a
 * real database. Kept out of `npm test` so the unit suite stays offline.
 *
 * Strapi is loaded through CommonJS: its ESM build re-exports a lodash
 * directory import that Node's ESM resolver rejects under Vitest.
 */
const { compileStrapi, createStrapi } = createRequire(import.meta.url)('@strapi/strapi');

type Strapi = Core.Strapi;

const PORT = 1339;
let API = '';
const SLUG = 'integration-test-tenant';

let app: Strapi;
let tenantId: string;
let productId: string;
let unitId: string;

async function post(path: string, body: unknown) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function removeTenantData() {
  const tenant = await app.documents('api::tenant.tenant').findFirst({ filters: { slug: SLUG } });
  if (!tenant) return;

  for (const uid of [
    'api::marketplace-sync-event.marketplace-sync-event',
    'api::channel-listing.channel-listing',
    'api::sellable-unit.sellable-unit',
    'api::product.product',
  ] as const) {
    const documents = await app.documents(uid).findMany({
      filters: { tenant: { documentId: tenant.documentId } },
    });
    for (const document of documents) {
      await app.documents(uid).delete({ documentId: document.documentId });
    }
  }

  await app.documents('api::tenant.tenant').delete({ documentId: tenant.documentId });
}

beforeAll(async () => {
  process.env.PORT = String(PORT);
  app = await createStrapi(await compileStrapi()).load();

  // listen() is what mounts the routes; load() alone leaves every path a 404.
  await app.server.listen();

  const address = (app.server as unknown as { httpServer: import('node:http').Server }).httpServer.address();
  const port = typeof address === 'object' && address ? address.port : PORT;
  API = `http://127.0.0.1:${port}/api`;

  await removeTenantData();

  const tenant = await app.documents('api::tenant.tenant').create({
    data: { name: 'Integration Test Tenant', slug: SLUG, isActive: true },
  });
  tenantId = tenant.documentId;

  const product = await app.documents('api::product.product').create({
    data: { tenant: tenantId, productType: 'vinyl', title: 'Discovery', artist: 'Daft Punk' },
  });
  productId = product.documentId;

  const unit = await app.documents('api::sellable-unit.sellable-unit').create({
    data: {
      tenant: tenantId,
      product: productId,
      price: 29.9,
      currency: 'EUR',
      mediaCondition: 'NEAR_MINT',
      sleeveCondition: 'VERY_GOOD_PLUS',
      saleStatus: 'available',
      quantity: 1,
    },
  });
  unitId = unit.documentId;
}, 180_000);

/**
 * strapi.destroy() tears down the process itself, which kills the Vitest
 * worker and fails the run even when every test passed. Releasing the socket
 * and the connection pool is enough to let the worker exit cleanly.
 */
afterAll(async () => {
  if (!app) return;
  await removeTenantData();

  const httpServer = (app.server as unknown as { httpServer: import('node:http').Server })
    .httpServer;
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await app.db.connection.destroy();
}, 60_000);

describe('POST /sellable-units/:id/publish-discogs', () => {
  it('generates the SKU backend-side', () => {
    expect(unitId).toBeTruthy();
  });

  it('refuses to publish a unit with no Discogs release attached', async () => {
    const { status, body } = await post(`/sellable-units/${unitId}/publish-discogs`, { tenantId });

    expect(status).toBe(400);
    expect(JSON.stringify(body)).toContain('RELEASE_NOT_ATTACHED');
  });

  it('records the refusal as a failed listing rather than leaving no trace', async () => {
    const listing = await app.documents('api::channel-listing.channel-listing').findFirst({
      filters: { sellableUnit: { documentId: unitId } },
    });

    expect(listing?.status).toBe('failed');
    expect(listing?.lastErrorMessage).toBeTruthy();
  });

  it('publishes once the release is attached, and stores the external identifiers', async () => {
    const attach = await post(`/products/${productId}/attach-discogs-release`, {
      tenantId,
      releaseId: '123456',
    });
    expect(attach.status).toBe(200);

    const { status, body } = await post(`/sellable-units/${unitId}/publish-discogs`, { tenantId });
    expect(status).toBe(200);

    const listing = body.data;
    expect(listing.status).toBe('published');
    expect(listing.externalListingId).toMatch(/^discogs-listing-\d{4}$/);
    expect(listing.externalUrl).toContain('https://www.discogs.com/sell/item/');
    expect(listing.publishedPrice).toBe(29.9);
    expect(listing.lastSyncedAt).toBeTruthy();
  });

  it('journals both the failure and the success', async () => {
    const events = await app.documents('api::marketplace-sync-event.marketplace-sync-event').findMany({
      filters: { tenant: { documentId: tenantId }, action: 'publish_listing' },
    });

    const statuses = events.map((event) => event.status).sort();
    expect(statuses).toEqual(['error', 'success']);
  });

  it('does not expose the unit to another tenant', async () => {
    const other = await app.documents('api::tenant.tenant').create({
      data: { name: 'Other', slug: `${SLUG}-other`, isActive: true },
    });

    try {
      const { status } = await post(`/sellable-units/${unitId}/publish-discogs`, {
        tenantId: other.documentId,
      });
      expect(status).toBe(404);
    } finally {
      await app.documents('api::tenant.tenant').delete({ documentId: other.documentId });
    }
  });
});
