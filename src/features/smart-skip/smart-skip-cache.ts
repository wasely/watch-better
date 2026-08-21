import { browser } from 'wxt/browser';

import { isWebChatProviderId } from '@/services/web-chat';

import {
  SMART_SKIP_CATEGORIES,
  type SmartSkipAnalysis,
  type SmartSkipCategory,
  type SmartSkipInterval,
} from './domain';

const STORAGE_KEY = 'watchbetter:smart-skip-cache:v1';
const MAX_ENTRIES = 20;
const MAX_ENTRY_CHARACTERS = 256_000;
const categorySet = new Set<string>(SMART_SKIP_CATEGORIES);

interface CacheEntry {
  readonly key: string;
  readonly analysis: SmartSkipAnalysis;
  readonly accessedAt: number;
}

interface SmartSkipCacheData {
  readonly entries: readonly CacheEntry[];
}

const isInterval = (value: unknown): value is SmartSkipInterval => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const interval = value as Record<string, unknown>;
  return (
    typeof interval.id === 'string' &&
    Number.isInteger(interval.startSegmentIndex) &&
    Number.isInteger(interval.endSegmentIndex) &&
    typeof interval.startSeconds === 'number' &&
    Number.isFinite(interval.startSeconds) &&
    typeof interval.endSeconds === 'number' &&
    Number.isFinite(interval.endSeconds) &&
    interval.endSeconds > interval.startSeconds &&
    typeof interval.category === 'string' &&
    categorySet.has(interval.category) &&
    typeof interval.reason === 'string' &&
    typeof interval.confidence === 'number' &&
    interval.confidence >= 0 &&
    interval.confidence <= 1 &&
    typeof interval.enabled === 'boolean' &&
    (interval.source === undefined ||
      interval.source === 'instant' ||
      interval.source === 'deep')
  );
};

const isAnalysis = (value: unknown): value is SmartSkipAnalysis => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const analysis = value as Record<string, unknown>;
  return (
    analysis.schemaVersion === 1 &&
    typeof analysis.videoId === 'string' &&
    typeof analysis.trackId === 'string' &&
    typeof analysis.transcriptFingerprint === 'string' &&
    isWebChatProviderId(analysis.provider) &&
    (analysis.strictness === 'conservative' ||
      analysis.strictness === 'balanced' ||
      analysis.strictness === 'aggressive') &&
    Array.isArray(analysis.categories) &&
    analysis.categories.every(
      (category): category is SmartSkipCategory =>
        typeof category === 'string' && categorySet.has(category),
    ) &&
    Array.isArray(analysis.intervals) &&
    analysis.intervals.every(isInterval) &&
    typeof analysis.analyzedAt === 'number' &&
    Number.isFinite(analysis.analyzedAt) &&
    typeof analysis.reviewRequired === 'boolean'
  );
};

export interface SmartSkipStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

const cacheDataFrom = (value: unknown): SmartSkipCacheData => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return { entries: [] };
  const entries = (value as { readonly entries?: unknown }).entries;
  if (!Array.isArray(entries)) return { entries: [] };
  return {
    entries: entries.filter(
      (entry): entry is CacheEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        typeof (entry as CacheEntry).key === 'string' &&
        typeof (entry as CacheEntry).accessedAt === 'number' &&
        isAnalysis((entry as CacheEntry).analysis),
    ),
  };
};

export class SmartSkipCache {
  public constructor(
    private readonly area: SmartSkipStorageArea = browser.storage.session,
  ) {}

  public async get(key: string): Promise<SmartSkipAnalysis | null> {
    const stored = await this.area.get(STORAGE_KEY);
    const data = cacheDataFrom(stored[STORAGE_KEY]);
    const entry = data.entries.find((candidate) => candidate.key === key);
    if (!entry) return null;
    await this.saveEntries([
      { ...entry, accessedAt: Date.now() },
      ...data.entries.filter((candidate) => candidate.key !== key),
    ]);
    return entry.analysis;
  }

  public async set(key: string, analysis: SmartSkipAnalysis): Promise<void> {
    if (!isAnalysis(analysis)) throw new Error('Smart Skip analysis is invalid.');
    if (JSON.stringify(analysis).length > MAX_ENTRY_CHARACTERS)
      throw new Error('Smart Skip analysis is too large to cache.');
    const stored = await this.area.get(STORAGE_KEY);
    const data = cacheDataFrom(stored[STORAGE_KEY]);
    await this.saveEntries([
      { key, analysis, accessedAt: Date.now() },
      ...data.entries.filter((candidate) => candidate.key !== key),
    ]);
  }

  async saveEntries(entries: readonly CacheEntry[]): Promise<void> {
    const bounded = [...entries]
      .sort((left, right) => right.accessedAt - left.accessedAt)
      .slice(0, MAX_ENTRIES);
    await this.area.set({ [STORAGE_KEY]: { entries: bounded } });
  }
}
