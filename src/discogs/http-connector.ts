import { DiscogsApiError, type DiscogsConnector } from './connector';
import type {
  DiscogsConfig,
  DiscogsRelease,
  DiscogsSearchResult,
  PublishedListing,
} from './types';

type SearchApiItem = {
  id: number;
  title: string;
  year?: string | number;
  country?: string;
  format?: string[];
  label?: string[];
  master_id?: number;
};

type ReleaseApiItem = {
  id: number;
  title: string;
  artists?: { name: string }[];
  year?: number;
  country?: string;
  formats?: { name: string; qty?: string }[];
  labels?: { name: string }[];
  master_id?: number;
};

/** Discogs search returns "Artist - Title" in a single field. */
function splitSearchTitle(value: string): { artist: string; title: string } {
  const separator = value.indexOf(' - ');
  if (separator === -1) {
    return { artist: '', title: value };
  }
  return {
    artist: value.slice(0, separator).trim(),
    title: value.slice(separator + 3).trim(),
  };
}

function toYear(value: string | number | undefined): number | undefined {
  const year = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return Number.isFinite(year) ? year : undefined;
}

export function createHttpDiscogsConnector(config: DiscogsConfig): DiscogsConnector {
  async function request<T>(path: string): Promise<T | null> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      headers: {
        Authorization: `Discogs token=${config.apiToken}`,
        'User-Agent': config.userAgent,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new DiscogsApiError(
        `Discogs API responded with ${response.status}`,
        response.status
      );
    }

    return (await response.json()) as T;
  }

  return {
    mode: 'api',

    async searchReleases(query: string): Promise<DiscogsSearchResult[]> {
      const payload = await request<{ results?: SearchApiItem[] }>(
        `/database/search?type=release&q=${encodeURIComponent(query)}`
      );

      return (payload?.results ?? []).map((item) => ({
        releaseId: String(item.id),
        ...splitSearchTitle(item.title),
        year: toYear(item.year),
        country: item.country,
        format: item.format?.join(', '),
        label: item.label?.[0],
      }));
    },

    async getRelease(releaseId: string): Promise<DiscogsRelease | null> {
      const item = await request<ReleaseApiItem>(`/releases/${encodeURIComponent(releaseId)}`);
      if (!item) {
        return null;
      }

      return {
        releaseId: String(item.id),
        masterId: item.master_id ? String(item.master_id) : undefined,
        title: item.title,
        artist: item.artists?.map((a) => a.name).join(', ') ?? '',
        year: toYear(item.year),
        country: item.country,
        format: item.formats?.map((f) => `${f.qty && f.qty !== '1' ? f.qty + 'x' : ''}${f.name}`).join(', '),
        label: item.labels?.[0]?.name,
      };
    },

    /**
     * Creating and deleting Marketplace listings requires OAuth 1.0a user
     * authorisation, which a personal access token does not provide. Failing
     * loudly is the only honest option: a silent no-op would record a
     * published listing that does not exist.
     */
    async publishListing(): Promise<PublishedListing> {
      throw new DiscogsApiError(
        'Publishing to the real Discogs Marketplace requires OAuth 1.0a. Use DISCOGS_MODE=mock.'
      );
    },
  };
}
