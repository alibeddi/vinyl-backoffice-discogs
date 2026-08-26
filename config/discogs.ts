import type { Core } from '@strapi/strapi';
import type { DiscogsConfig } from '../src/discogs/types';

export default ({ env }: Core.Config.Shared.ConfigParams): DiscogsConfig => ({
  mode: env('DISCOGS_MODE', 'mock') === 'api' ? 'api' : 'mock',
  apiToken: env('DISCOGS_API_TOKEN', ''),
  baseUrl: env('DISCOGS_API_BASE_URL', 'https://api.discogs.com'),
  userAgent: env('DISCOGS_USER_AGENT', 'VinylBackoffice/0.1'),
});
