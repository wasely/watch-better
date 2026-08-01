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
    remove: vi.fn((keys: string | readonly string[]) => {
      for (const key of typeof keys === 'string' ? [keys] : keys)
        delete session.values[key];
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
    session.remove.mockClear();
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

  it('evicts the oldest session transcript after three documents', async () => {
    const cache = new TranscriptCache();
    for (const videoId of ['one', 'two', 'three', 'four'])
      await cache.set(videoId, 'en', { ...transcript, videoId }, 'session');

    const transcriptKeys = Object.keys(session.values).filter((key) =>
      key.startsWith('watchbetter:transcript-cache:'),
    );
    expect(transcriptKeys).toHaveLength(3);
    expect(transcriptKeys.some((key) => key.includes('one'))).toBe(false);
    expect(session.remove).toHaveBeenCalledWith([
      'watchbetter:transcript-cache:one:en',
    ]);
  });
});
