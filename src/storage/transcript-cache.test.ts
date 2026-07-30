import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranscriptDocument } from '@/features/transcript/domain';

const session = vi.hoisted(() => {
  const values: Record<string, unknown> = {};
  return {
    values,
    get: vi.fn((key: string) => Promise.resolve({ [key]: session.values[key] })),
    set: vi.fn((next: Record<string, unknown>) => {
      Object.assign(session.values, next);
      return Promise.resolve();
    }),
  };
});

vi.mock('wxt/browser', () => ({
  browser: { storage: { session } },
}));

import { TranscriptCache } from './transcript-cache';

const transcript: TranscriptDocument = {
  videoId: 'video',
  videoTitle: 'Video',
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: false,
  durationSeconds: 10,
  segments: [{ id: 'a', startSeconds: 0, endSeconds: 1, text: 'Evidence.' }],
};

describe('TranscriptCache', () => {
  beforeEach(() => {
    for (const key of Object.keys(session.values)) delete session.values[key];
    session.get.mockClear();
    session.set.mockClear();
  });

  it('keeps the default policy in memory only', async () => {
    const cache = new TranscriptCache();
    await cache.set('video', 'en', transcript, 'memory-only');
    await expect(cache.get('video', 'en', 'memory-only')).resolves.toEqual(transcript);
    expect(session.set).not.toHaveBeenCalled();
  });

  it('stores only explicit session-policy entries in browser session storage', async () => {
    const cache = new TranscriptCache();
    await cache.set('video', 'en', transcript, 'session');
    expect(session.set).toHaveBeenCalledOnce();
    cache.clearMemory();
    await expect(cache.get('video', 'en', 'session')).resolves.toEqual(transcript);
  });
});
