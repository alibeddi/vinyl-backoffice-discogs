import { describe, expect, it } from 'vitest';
import { createDiscogsConnector } from './index';
import type { DiscogsConfig } from './types';

const config: DiscogsConfig = {
  mode: 'mock',
  apiToken: '',
  baseUrl: 'https://api.discogs.com',
  userAgent: 'test',
};

describe('createDiscogsConnector', () => {
  it('defaults to the mock connector so no test path needs the network', () => {
    expect(createDiscogsConnector(config).mode).toBe('mock');
  });

  it('returns the HTTP connector when a token is configured', () => {
    expect(createDiscogsConnector({ ...config, mode: 'api', apiToken: 'x' }).mode).toBe('api');
  });

  it('refuses api mode without a token instead of silently using the mock', () => {
    expect(() => createDiscogsConnector({ ...config, mode: 'api' })).toThrow(/DISCOGS_API_TOKEN/);
  });
});
