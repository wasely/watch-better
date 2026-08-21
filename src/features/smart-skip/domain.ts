import type { WebChatProviderId } from '@/services/web-chat';

export const SMART_SKIP_CATEGORIES = [
  'sponsor',
  'intro',
  'outro',
  'call-to-action',
  'repetition',
  'ramble',
] as const;

export type SmartSkipCategory = (typeof SMART_SKIP_CATEGORIES)[number];
export type SmartSkipStrictness = 'conservative' | 'balanced' | 'aggressive';

export interface SmartSkipConfiguration {
  readonly provider: WebChatProviderId;
  readonly strictness: SmartSkipStrictness;
  readonly categories: readonly SmartSkipCategory[];
  readonly autoSkip: boolean;
}

export interface SmartSkipInterval {
  readonly id: string;
  readonly startSegmentIndex: number;
  readonly endSegmentIndex: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly category: SmartSkipCategory;
  readonly reason: string;
  readonly confidence: number;
  readonly enabled: boolean;
  /** Local rules are immediate; deep cuts arrive later without blocking playback. */
  readonly source?: 'instant' | 'deep';
}

export interface SmartSkipAnalysis {
  readonly schemaVersion: 1;
  readonly videoId: string;
  readonly trackId: string;
  readonly transcriptFingerprint: string;
  readonly provider: WebChatProviderId;
  readonly strictness: SmartSkipStrictness;
  readonly categories: readonly SmartSkipCategory[];
  readonly intervals: readonly SmartSkipInterval[];
  readonly analyzedAt: number;
  readonly reviewRequired: boolean;
}

export type SmartSkipAnalysisState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'analyzing'; readonly completed: number; readonly total: number }
  | {
      readonly kind: 'ready';
      readonly analysis: SmartSkipAnalysis;
      readonly cached: boolean;
    }
  | { readonly kind: 'error'; readonly message: string };

export type SmartSkipRefinementState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'analyzing'; readonly completed: number; readonly total: number }
  | { readonly kind: 'complete'; readonly addedCuts: number }
  | { readonly kind: 'unavailable'; readonly message: string };

export const DEFAULT_SMART_SKIP_CONFIGURATION: SmartSkipConfiguration = Object.freeze({
  provider: 'gemini',
  strictness: 'balanced',
  categories: SMART_SKIP_CATEGORIES,
  autoSkip: true,
});

export const SMART_SKIP_CATEGORY_LABELS: Readonly<Record<SmartSkipCategory, string>> =
  Object.freeze({
    sponsor: 'Sponsors',
    intro: 'Introductions',
    outro: 'Outros',
    'call-to-action': 'Calls to action',
    repetition: 'Repetition',
    ramble: 'Rambling',
  });
