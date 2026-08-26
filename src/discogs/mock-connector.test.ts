import { describe, expect, it } from 'vitest';
import { DiscogsApiError } from './connector';
import { FORCE_ERROR_SENTINEL } from './fixtures';
import { createMockDiscogsConnector } from './mock-connector';
import type { ListingPayload } from './types';

const payload: ListingPayload = {
  releaseId: '123456',
  price: 29.9,
  currency: 'EUR',
  mediaCondition: 'NEAR_MINT',
  sleeveCondition: 'VERY_GOOD_PLUS',
  quantity: 1,
};

describe('mock Discogs connector', () => {
  it('finds the reference release by artist and by title', async () => {
    const connector = createMockDiscogsConnector();

    const [byArtist] = await connector.searchReleases('Daft Punk');
    const [byTitle] = await connector.searchReleases('discovery');

    expect(byTitle).toMatchObject({
      releaseId: '123456',
      title: 'Discovery',
      artist: 'Daft Punk',
      year: 2001,
      country: 'France',
      format: '2xLP',
      label: 'Virgin',
    });
    expect(byArtist.artist).toBe('Daft Punk');
  });

  it('returns nothing for an unknown or empty query', async () => {
    const connector = createMockDiscogsConnector();

    expect(await connector.searchReleases('Nirvana')).toEqual([]);
    expect(await connector.searchReleases('   ')).toEqual([]);
  });

  it('returns null for an unknown release rather than throwing', async () => {
    const connector = createMockDiscogsConnector();

    expect(await connector.getRelease('123456')).not.toBeNull();
    expect(await connector.getRelease('000000')).toBeNull();
  });

  it('publishes with the documented identifier and increments it', async () => {
    const connector = createMockDiscogsConnector();

    expect(await connector.publishListing(payload)).toEqual({
      externalListingId: 'discogs-listing-0001',
      externalUrl: 'https://www.discogs.com/sell/item/discogs-listing-0001',
    });
    expect((await connector.publishListing(payload)).externalListingId).toBe(
      'discogs-listing-0002'
    );
  });

  it('surfaces a marketplace failure when the caller asks for one', async () => {
    const connector = createMockDiscogsConnector();

    await expect(connector.searchReleases(FORCE_ERROR_SENTINEL)).rejects.toBeInstanceOf(
      DiscogsApiError
    );
    await expect(
      connector.publishListing({ ...payload, comments: FORCE_ERROR_SENTINEL })
    ).rejects.toBeInstanceOf(DiscogsApiError);
  });
});
