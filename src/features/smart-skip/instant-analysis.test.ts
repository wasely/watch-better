import { describe, expect, it } from 'vitest';

import type { TranscriptDocument } from '@/features/transcript/domain';

import { DEFAULT_SMART_SKIP_CONFIGURATION } from './domain';
import {
  buildInstantSmartSkipAnalysis,
  createInstantOpeningInterval,
} from './instant-analysis';

const document: TranscriptDocument = {
  videoId: 'instant-video',
  videoTitle: 'Instant video',
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: true,
  durationSeconds: 120,
  segments: [
    { id: 'a', startSeconds: 0, endSeconds: 3, text: 'Useful cold open.' },
    {
      id: 'b',
      startSeconds: 3,
      endSeconds: 8,
      text: 'Welcome back. In this video we are learning TypeScript.',
    },
    {
      id: 'c',
      startSeconds: 8,
      endSeconds: 13,
      text: 'This video is sponsored by Example. Use code TEST.',
    },
    { id: 'd', startSeconds: 13, endSeconds: 100, text: 'Useful explanation.' },
    {
      id: 'e',
      startSeconds: 100,
      endSeconds: 110,
      text: 'Thanks for watching and see you next time.',
    },
  ],
};

describe('instant Smart Skip analysis', () => {
  it('creates an opening cut without waiting for captions or AI', () => {
    expect(
      createInstantOpeningInterval(
        document.videoId,
        document.durationSeconds,
        DEFAULT_SMART_SKIP_CONFIGURATION,
      ),
    ).toMatchObject({ startSeconds: 0, endSeconds: 12, reason: 'Fast start' });
  });

  it('keeps the opening cut even when it contains useful content and finds local cuts', () => {
    const analysis = buildInstantSmartSkipAnalysis(
      document,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );

    expect(analysis.intervals[0]).toMatchObject({
      startSeconds: 0,
      endSeconds: 13,
    });
    expect(analysis.intervals.some((interval) => interval.category === 'sponsor')).toBe(
      true,
    );
    expect(analysis.intervals.some((interval) => interval.category === 'outro')).toBe(
      true,
    );
  });

  it('strictly removes dead air, verbal filler, and repeated points without AI', () => {
    const strictDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 90,
      segments: [
        {
          id: 's0',
          startSeconds: 0,
          endSeconds: 18,
          text: 'Caching makes repeated builds faster.',
        },
        {
          id: 's1',
          startSeconds: 18,
          endSeconds: 29,
          text: 'The cache stores compiled project output between builds.',
        },
        {
          id: 's2',
          startSeconds: 29,
          endSeconds: 32,
          text: 'Um, you know, so yeah.',
        },
        {
          id: 's3',
          startSeconds: 32,
          endSeconds: 38,
          text: 'Now configure the cache directory in settings.',
        },
        {
          id: 's4',
          startSeconds: 40.5,
          endSeconds: 46,
          text: 'The project cache stores compiled output between builds.',
        },
        {
          id: 's5',
          startSeconds: 46,
          endSeconds: 82,
          text: 'Use a unique key to avoid stale cache entries.',
        },
      ],
    };
    const analysis = buildInstantSmartSkipAnalysis(strictDocument, 'en', {
      ...DEFAULT_SMART_SKIP_CONFIGURATION,
      strictness: 'balanced',
    });

    expect(analysis.intervals.some((cut) => cut.reason === 'Dead air')).toBe(true);
    expect(analysis.intervals.some((cut) => cut.reason === 'Low-value filler')).toBe(
      true,
    );
    expect(analysis.intervals.some((cut) => cut.reason === 'Repeated point')).toBe(
      true,
    );
    expect(
      analysis.intervals.reduce(
        (seconds, cut) => seconds + cut.endSeconds - cut.startSeconds,
        0,
      ),
    ).toBeGreaterThan(20);
  });
});
