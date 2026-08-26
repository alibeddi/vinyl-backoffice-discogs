import { DiscogsApiError, type DiscogsConnector } from './connector';
import { FORCE_ERROR_SENTINEL, MOCK_RELEASES } from './fixtures';
import type { DiscogsRelease, DiscogsSearchResult, ListingPayload, PublishedListing } from './types';

const LISTING_URL_PREFIX = 'https://www.discogs.com/sell/item/';

function matches(release: DiscogsRelease, query: string): boolean {
  const haystack = `${release.artist} ${release.title} ${release.label ?? ''}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/**
 * Deterministic on purpose: no latency, no randomness, so tests and the
 * documented walkthrough always produce the same identifiers.
 */
export function createMockDiscogsConnector(): DiscogsConnector {
  let publishedCount = 0;

  return {
    mode: 'mock',

    async searchReleases(query: string): Promise<DiscogsSearchResult[]> {
      if (query.includes(FORCE_ERROR_SENTINEL)) {
        throw new DiscogsApiError('Mock Discogs search failure requested by the caller.');
      }

      const trimmed = query.trim();
      if (trimmed === '') {
        return [];
      }

      return MOCK_RELEASES.filter((release) => matches(release, trimmed));
    },

    async getRelease(releaseId: string): Promise<DiscogsRelease | null> {
      return MOCK_RELEASES.find((release) => release.releaseId === releaseId) ?? null;
    },

    async publishListing(payload: ListingPayload): Promise<PublishedListing> {
      if (payload.comments?.includes(FORCE_ERROR_SENTINEL)) {
        throw new DiscogsApiError('Mock Discogs publication failure requested by the caller.');
      }

      publishedCount += 1;
      const externalListingId = `discogs-listing-${String(publishedCount).padStart(4, '0')}`;

      return {
        externalListingId,
        externalUrl: `${LISTING_URL_PREFIX}${externalListingId}`,
      };
    },
  };
}
