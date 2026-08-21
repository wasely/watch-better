import { describe, expect, it } from 'vitest';

import type { SmartSkipAnalysis } from './domain';
import { SmartSkipCache, type SmartSkipStorageArea } from './smart-skip-cache';

class MemoryStorage implements SmartSkipStorageArea {
  readonly values: Record<string, unknown> = {};
  public get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ [key]: this.values[key] });
  }
  public set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, values);
    return Promise.resolve();
  }
}

const analysis: SmartSkipAnalysis = {
  schemaVersion: 1,
  videoId: 'v',
  trackId: 'en',
  transcriptFingerprint: '12345678',
  provider: 'gemini',
  strictness: 'balanced',
  categories: ['sponsor'],
  intervals: [],
  analyzedAt: 1,
  reviewRequired: false,
};

describe('SmartSkipCache', () => {
  it('round-trips a session result', async () => {
    const cache = new SmartSkipCache(new MemoryStorage());
    await cache.set('key', analysis);
    await expect(cache.get('key')).resolves.toEqual(analysis);
    await expect(cache.get('missing')).resolves.toBeNull();
  });

  it('ignores malformed session data', async () => {
    const storage = new MemoryStorage();
    storage.values['watchbetter:smart-skip-cache:v1'] = {
      entries: [{ key: 'bad', analysis: { videoId: 'v' }, accessedAt: 1 }],
    };
    const cache = new SmartSkipCache(storage);
    await expect(cache.get('bad')).resolves.toBeNull();
  });
});
