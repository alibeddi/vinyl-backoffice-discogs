/**
 * Discogs rejects a listing whose condition is not one of its exact labels.
 * This map is the single source of truth: the domain stores the keys, the
 * marketplace receives the values.
 */
export const DISCOGS_CONDITION_LABELS = {
  MINT: 'Mint (M)',
  NEAR_MINT: 'Near Mint (NM or M-)',
  VERY_GOOD_PLUS: 'Very Good Plus (VG+)',
  VERY_GOOD: 'Very Good (VG)',
  GOOD_PLUS: 'Good Plus (G+)',
  GOOD: 'Good (G)',
  FAIR: 'Fair (F)',
  POOR: 'Poor (P)',
  GENERIC: 'Generic',
  NO_COVER: 'No Cover',
  NOT_GRADED: 'Not Graded',
} as const;

export type ConditionCode = keyof typeof DISCOGS_CONDITION_LABELS;

/** A record itself cannot be "Generic" or "No Cover" — those grade the sleeve only. */
export const MEDIA_CONDITIONS: readonly ConditionCode[] = [
  'MINT',
  'NEAR_MINT',
  'VERY_GOOD_PLUS',
  'VERY_GOOD',
  'GOOD_PLUS',
  'GOOD',
  'FAIR',
  'POOR',
];

export const SLEEVE_CONDITIONS: readonly ConditionCode[] = [
  ...MEDIA_CONDITIONS,
  'GENERIC',
  'NO_COVER',
  'NOT_GRADED',
];

export type DiscogsSearchResult = {
  releaseId: string;
  title: string;
  artist: string;
  year?: number;
  country?: string;
  format?: string;
  label?: string;
};

export type DiscogsRelease = DiscogsSearchResult & {
  masterId?: string;
};

export type ListingPayload = {
  releaseId: string;
  price: number;
  currency: string;
  mediaCondition: ConditionCode;
  sleeveCondition: ConditionCode;
  quantity: number;
  comments?: string;
};

export type PublishedListing = {
  externalListingId: string;
  externalUrl: string;
};

export type DiscogsMode = 'mock' | 'api';

export type DiscogsConfig = {
  mode: DiscogsMode;
  apiToken: string;
  baseUrl: string;
  userAgent: string;
};
