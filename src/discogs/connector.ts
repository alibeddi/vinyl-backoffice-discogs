import type {
  DiscogsMode,
  DiscogsRelease,
  DiscogsSearchResult,
  ListingPayload,
  PublishedListing,
} from './types';

/**
 * Every method here crosses the marketplace boundary. Listing completeness is
 * deliberately absent: it is a local rule, and putting it here would force each
 * implementation to duplicate it.
 */
export interface DiscogsConnector {
  readonly mode: DiscogsMode;
  searchReleases(query: string): Promise<DiscogsSearchResult[]>;
  getRelease(releaseId: string): Promise<DiscogsRelease | null>;
  publishListing(payload: ListingPayload): Promise<PublishedListing>;
  removeListing(externalListingId: string): Promise<void>;
}

/** Lets the workflow distinguish a marketplace failure from a validation failure. */
export class DiscogsApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = 'DiscogsApiError';
  }
}
