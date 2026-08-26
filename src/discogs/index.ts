import type { DiscogsConnector } from './connector';
import { createHttpDiscogsConnector } from './http-connector';
import { createMockDiscogsConnector } from './mock-connector';
import type { DiscogsConfig } from './types';

export { DiscogsApiError, type DiscogsConnector } from './connector';
export { validateListingPayload } from './completeness';
export type { CompletenessIssue, CompletenessResult, ListingCandidate } from './completeness';
export { DISCOGS_CONDITION_LABELS } from './types';
export type { DiscogsConfig, DiscogsRelease, ListingPayload } from './types';

/**
 * Mock is the default: the documented walkthrough must never depend on network
 * availability or on a token being provided.
 */
export function createDiscogsConnector(config: DiscogsConfig): DiscogsConnector {
  if (config.mode !== 'api') {
    return createMockDiscogsConnector();
  }

  if (!config.apiToken) {
    throw new Error('DISCOGS_API_TOKEN is required when DISCOGS_MODE=api.');
  }

  return createHttpDiscogsConnector(config);
}
