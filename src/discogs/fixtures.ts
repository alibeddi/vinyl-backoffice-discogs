import type { DiscogsRelease } from './types';

/** Query that makes the mock fail on purpose, to exercise the error paths. */
export const FORCE_ERROR_SENTINEL = 'FORCE_DISCOGS_ERROR';

export const MOCK_RELEASES: readonly DiscogsRelease[] = [
  {
    releaseId: '123456',
    masterId: '654321',
    title: 'Discovery',
    artist: 'Daft Punk',
    year: 2001,
    country: 'France',
    format: '2xLP',
    label: 'Virgin',
  },
  {
    releaseId: '234567',
    masterId: '765432',
    title: 'Homework',
    artist: 'Daft Punk',
    year: 1997,
    country: 'France',
    format: '2xLP',
    label: 'Virgin',
  },
  {
    releaseId: '345678',
    masterId: '876543',
    title: 'Random Access Memories',
    artist: 'Daft Punk',
    year: 2013,
    country: 'Europe',
    format: '2xLP',
    label: 'Columbia',
  },
];
