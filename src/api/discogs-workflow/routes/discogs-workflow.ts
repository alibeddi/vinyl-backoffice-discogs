/**
 * `auth: false` is a deliberate test-scope shortcut, documented in the README:
 * the specification asks for no authentication layer, and tenant isolation is
 * carried by the explicit tenantId. This is not production-ready.
 */
const publicRoute = { auth: false, policies: [], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/discogs/search',
      handler: 'discogs-workflow.search',
      config: publicRoute,
    },
    {
      method: 'POST',
      path: '/products/:id/attach-discogs-release',
      handler: 'discogs-workflow.attachRelease',
      config: publicRoute,
    },
    {
      method: 'POST',
      path: '/sellable-units/:id/check-discogs-completeness',
      handler: 'discogs-workflow.checkCompleteness',
      config: publicRoute,
    },
    {
      method: 'POST',
      path: '/sellable-units/:id/publish-discogs',
      handler: 'discogs-workflow.publish',
      config: publicRoute,
    },
    {
      method: 'POST',
      path: '/sellable-units/:id/simulate-discogs-sale',
      handler: 'discogs-workflow.simulateSale',
      config: publicRoute,
    },
  ],
};
