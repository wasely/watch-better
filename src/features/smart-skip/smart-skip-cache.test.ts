import { describe, expect, it } from 'vitest';

import type { SmartSkipAnalysis } from './domain';
import { SmartSkipCache, type SmartSkipStorageArea } from './smart-skip-cache';

class MemoryStorage implements SmartSkipStorageArea {
  readonly values: Record<string, unknown> = {};
  public rejectSets = false;
  public get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ [key]: this.values[key] });
  }
  public set(values: Record<string, unknown>): Promise<void> {
    if (this.rejectSets) return Promise.reject(new Error('Storage unavailable'));
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

  it('returns a hit when its best-effort LRU touch fails', async () => {
    const storage = new MemoryStorage();
    const cache = new SmartSkipCache(storage);
    await cache.set('key', analysis);
    storage.rejectSets = true;

    await expect(cache.get('key')).resolves.toEqual(analysis);
  });

  it('ignores malformed session data', async () => {
    const storage = new MemoryStorage();
    storage.values['watchbetter:smart-skip-cache:v1'] = {
      entries: [{ key: 'bad', analysis: { videoId: 'v' }, accessedAt: 1 }],
    };
    const cache = new SmartSkipCache(storage);
    await expect(cache.get('bad')).resolves.toBeNull();
  });

  it('rejects cached playback actions outside the skip-only contract', async () => {
    const storage = new MemoryStorage();
    storage.values['watchbetter:smart-skip-cache:v1'] = {
      entries: [
        {
          key: 'bad-action',
          accessedAt: 1,
          analysis: {
            ...analysis,
            intervals: [
              {
                id: 'bad-action',
                startSegmentIndex: 0,
                endSegmentIndex: 0,
                startSeconds: 1,
                endSeconds: 2,
                category: 'ramble',
                reason: 'Invalid action',
                confidence: 1,
                enabled: true,
                action: 'teleport',
              },
            ],
          },
        },
      ],
    };

    await expect(new SmartSkipCache(storage).get('bad-action')).resolves.toBeNull();
  });
});
