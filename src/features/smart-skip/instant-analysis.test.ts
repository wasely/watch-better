import { describe, expect, it } from 'vitest';

import type { TranscriptDocument } from '@/features/transcript/domain';

import { DEFAULT_SMART_SKIP_CONFIGURATION } from './domain';
import { buildInstantSmartSkipAnalysis } from './instant-analysis';

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
  it('preserves an information-bearing cold open', () => {
    const analysis = buildInstantSmartSkipAnalysis(
      document,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );

    expect(
      analysis.intervals.some(
        (interval) => interval.startSeconds < 3 && interval.endSeconds > 0,
      ),
    ).toBe(false);
  });

  it('finds local cuts without sacrificing the cold open', () => {
    const analysis = buildInstantSmartSkipAnalysis(
      document,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );

    expect(analysis.intervals[0]?.startSeconds).toBeGreaterThanOrEqual(8);
    expect(analysis.intervals.some((interval) => interval.category === 'sponsor')).toBe(
      true,
    );
    expect(analysis.intervals.some((interval) => interval.category === 'outro')).toBe(
      true,
    );
  });

  it('enables only the highest-confidence jumps within the 35 percent budget', () => {
    const safetyDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 100,
      segments: [
        { id: 's0', startSeconds: 0, endSeconds: 10, text: 'Useful opening.' },
        {
          id: 's1',
          startSeconds: 10,
          endSeconds: 30,
          text: 'This video is sponsored by Example. Use code TEST.',
        },
        { id: 's2', startSeconds: 30, endSeconds: 80, text: 'Useful explanation.' },
        {
          id: 's3',
          startSeconds: 80,
          endSeconds: 100,
          text: 'Thanks for watching and see you next time.',
        },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      safetyDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    const sponsor = analysis.intervals.find(
      (candidate) => candidate.category === 'sponsor',
    );
    const outro = analysis.intervals.find(
      (candidate) => candidate.category === 'outro',
    );
    const enabledJumpDuration = analysis.intervals.reduce(
      (total, candidate) =>
        candidate.enabled && (candidate.action ?? 'skip') === 'skip'
          ? total + candidate.endSeconds - candidate.startSeconds
          : total,
      0,
    );

    expect(analysis.reviewRequired).toBe(true);
    expect(sponsor?.enabled).toBe(true);
    expect(outro?.enabled).toBe(false);
    expect(enabledJumpDuration).toBeLessThanOrEqual(35);
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
    expect(analysis.intervals.some((cut) => cut.id.endsWith('gap-end'))).toBe(false);
  });

  it('does not treat the word again or a repeat with new facts as repetition', () => {
    const safeDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 40,
      segments: [
        {
          id: 's0',
          startSeconds: 0,
          endSeconds: 8,
          text: 'The cache stores compiled output between builds.',
        },
        {
          id: 's1',
          startSeconds: 8,
          endSeconds: 16,
          text: 'Again, configure invalidation before deploying the application.',
        },
        {
          id: 's2',
          startSeconds: 16,
          endSeconds: 26,
          text: 'As I said earlier, the cache stores compiled output between builds, but remote keys require encryption and weekly rotation.',
        },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      safeDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    expect(analysis.intervals.some((cut) => cut.category === 'repetition')).toBe(false);
  });

  it('preserves useful facts mixed into sponsor or filler language', () => {
    const mixedDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 50,
      segments: [
        {
          id: 's0',
          startSeconds: 0,
          endSeconds: 10,
          text: 'This video is sponsored by Example, and strict mode catches nullable values before deployment.',
        },
        {
          id: 's1',
          startSeconds: 10,
          endSeconds: 20,
          text: 'So yeah, configure noUncheckedIndexedAccess to detect unsafe array access.',
        },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      mixedDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    expect(analysis.intervals).toEqual([]);
  });

  it('leaves visually ambiguous and exceptionally long caption gaps unchanged', () => {
    const visualDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 30,
      segments: [
        {
          id: 's0',
          startSeconds: 0,
          endSeconds: 2,
          text: 'Look at the screen to see the transition.',
        },
        {
          id: 's1',
          startSeconds: 5,
          endSeconds: 7,
          text: 'The transition preserves temporal context.',
        },
        {
          id: 's2',
          startSeconds: 20,
          endSeconds: 22,
          text: 'Now inspect the final result.',
        },
      ],
      speechRanges: [
        { startSeconds: 0, endSeconds: 2 },
        { startSeconds: 5, endSeconds: 7 },
        { startSeconds: 20, endSeconds: 22 },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      visualDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    expect(analysis.intervals).toEqual([]);
  });

  it('ends an outro jump at the classified caption instead of the video tail', () => {
    const outroDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 100,
      segments: [
        { id: 's0', startSeconds: 0, endSeconds: 80, text: 'Useful explanation.' },
        {
          id: 's1',
          startSeconds: 80,
          endSeconds: 85,
          text: 'Thanks for watching and see you next time.',
        },
        {
          id: 's2',
          startSeconds: 85,
          endSeconds: 100,
          text: 'A final worked example proves the result.',
        },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      outroDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    const outro = analysis.intervals.find((cut) => cut.category === 'outro');
    expect(outro?.endSeconds).toBe(85);
  });

  it('cuts a brand-name sponsor read even when "sponsor" is never spoken', () => {
    const brandDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 120,
      segments: [
        { id: 'b0', startSeconds: 0, endSeconds: 10, text: 'Useful cold open.' },
        {
          id: 'b1',
          startSeconds: 10,
          endSeconds: 16,
          text: 'I have been using NordVPN on every device for months now.',
        },
        {
          id: 'b2',
          startSeconds: 16,
          endSeconds: 22,
          text: 'Get sixty nine percent off plus four extra months with my link below.',
        },
        {
          id: 'b3',
          startSeconds: 22,
          endSeconds: 28,
          text: 'Try it risk free with the thirty day money back guarantee.',
        },
        { id: 'b4', startSeconds: 28, endSeconds: 110, text: 'Useful explanation.' },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      brandDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    const sponsor = analysis.intervals.find((cut) => cut.category === 'sponsor');
    expect(sponsor).toBeDefined();
    expect(sponsor?.startSeconds).toBeLessThanOrEqual(10);
    expect(sponsor?.endSeconds).toBeGreaterThanOrEqual(28);
  });

  it('does not grow a sponsor jump into plain useful sentences', () => {
    const boundaryDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 120,
      segments: [
        { id: 'c0', startSeconds: 0, endSeconds: 10, text: 'Useful explanation.' },
        {
          id: 'c1',
          startSeconds: 10,
          endSeconds: 20,
          text: 'This video is sponsored by Example.',
        },
        {
          id: 'c2',
          startSeconds: 20,
          endSeconds: 30,
          text: 'The cache stores compiled project output between builds.',
        },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      boundaryDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    const sponsor = analysis.intervals.find((cut) => cut.category === 'sponsor');
    expect(sponsor?.endSeconds ?? 0).toBeLessThanOrEqual(20);
  });

  it('treats merch and course promotion as calls to action', () => {
    const merchDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 120,
      segments: [
        { id: 'm0', startSeconds: 0, endSeconds: 40, text: 'Useful explanation.' },
        {
          id: 'm1',
          startSeconds: 40,
          endSeconds: 50,
          text: 'Check out my course on shipping production agents.',
        },
        { id: 'm2', startSeconds: 50, endSeconds: 110, text: 'Useful explanation.' },
      ],
    };

    const analysis = buildInstantSmartSkipAnalysis(
      merchDocument,
      'en',
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    expect(analysis.intervals.some((cut) => cut.category === 'call-to-action')).toBe(
      true,
    );
  });

  it('jumps filler-dominated runs under Strict but keeps them under Safe', () => {
    const fillerSegments = [
      { id: 'f0', startSeconds: 0, endSeconds: 10, text: 'Useful explanation.' },
      {
        id: 'f1',
        startSeconds: 10,
        endSeconds: 20,
        text: 'So basically um you know like I was basically saying, um.',
      },
      {
        id: 'f2',
        startSeconds: 20,
        endSeconds: 30,
        text: 'You know, basically, um, anyway, you know what I mean, so yeah.',
      },
      { id: 'f3', startSeconds: 30, endSeconds: 60, text: 'Useful explanation.' },
    ];
    const fillerDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 60,
      segments: fillerSegments,
    };

    const strict = buildInstantSmartSkipAnalysis(fillerDocument, 'en', {
      ...DEFAULT_SMART_SKIP_CONFIGURATION,
      strictness: 'balanced',
    });
    const safe = buildInstantSmartSkipAnalysis(fillerDocument, 'en', {
      ...DEFAULT_SMART_SKIP_CONFIGURATION,
      strictness: 'conservative',
    });

    expect(strict.intervals.some((cut) => cut.reason === 'Low-value filler')).toBe(
      true,
    );
    expect(safe.intervals.every((cut) => cut.reason !== 'Low-value filler')).toBe(true);
  });

  it('cuts announced tangents under Strict but preserves them under Safe', () => {
    const tangentDocument: TranscriptDocument = {
      ...document,
      durationSeconds: 120,
      segments: [
        { id: 't0', startSeconds: 0, endSeconds: 40, text: 'Useful explanation.' },
        {
          id: 't1',
          startSeconds: 40,
          endSeconds: 50,
          text: 'Okay, quick story time before we continue.',
        },
        { id: 't2', startSeconds: 50, endSeconds: 110, text: 'Useful explanation.' },
      ],
    };

    const balanced = buildInstantSmartSkipAnalysis(tangentDocument, 'en', {
      ...DEFAULT_SMART_SKIP_CONFIGURATION,
      strictness: 'balanced',
    });
    const safe = buildInstantSmartSkipAnalysis(tangentDocument, 'en', {
      ...DEFAULT_SMART_SKIP_CONFIGURATION,
      strictness: 'conservative',
    });

    expect(balanced.intervals.some((cut) => cut.reason === 'Tangent')).toBe(true);
    expect(safe.intervals.every((cut) => cut.reason !== 'Tangent')).toBe(true);
  });
});
