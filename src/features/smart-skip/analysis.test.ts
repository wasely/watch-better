import { describe, expect, it } from 'vitest';

import type { TranscriptDocument } from '@/features/transcript/domain';

import {
  buildSmartSkipAnalysisChunks,
  mergeSmartSkipAnalyses,
  normalizeSmartSkipIntervals,
  parseSmartSkipAnalysisResponse,
  smartSkipAnalysisCacheKey,
  transcriptFingerprint,
} from './analysis';
import { DEFAULT_SMART_SKIP_CONFIGURATION } from './domain';

const document: TranscriptDocument = {
  videoId: 'video-1',
  videoTitle: 'A useful video',
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: false,
  durationSeconds: 100,
  segments: [
    { id: 'a', startSeconds: 0, endSeconds: 5, text: 'Welcome to the channel.' },
    { id: 'b', startSeconds: 5, endSeconds: 15, text: 'Our sponsor is Example.' },
    { id: 'c', startSeconds: 15, endSeconds: 25, text: 'Use code TEST.' },
    { id: 'd', startSeconds: 25, endSeconds: 60, text: 'The useful explanation.' },
    { id: 'e', startSeconds: 60, endSeconds: 99, text: 'A long repeated tangent.' },
  ],
};

describe('Smart Skip analysis', () => {
  it('chunks every segment into bounded, indexed prompts', () => {
    const longDocument: TranscriptDocument = {
      ...document,
      segments: Array.from({ length: 40 }, (_, index) => ({
        id: String(index),
        startSeconds: index * 5,
        endSeconds: index * 5 + 5,
        text: `Segment ${index} ${'useful context '.repeat(8)}`,
      })),
    };
    const chunks = buildSmartSkipAnalysisChunks(
      longDocument,
      DEFAULT_SMART_SKIP_CONFIGURATION,
      3_100,
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.prompt.length <= 3_100)).toBe(true);
    expect(chunks[0]?.prompt).toContain('0|0.00|5.00|Segment 0');
    expect(chunks[0]?.prompt).toContain('material buried in the middle');
    expect(chunks[0]?.prompt).toContain('disposable tangents or anecdotes');
    expect(chunks.at(-1)?.lastSegmentIndex).toBe(39);
  });

  it('extracts valid cuts from fenced provider output and rejects invented indexes', () => {
    const [chunk] = buildSmartSkipAnalysisChunks(
      document,
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    if (!chunk) throw new Error('Expected one chunk.');
    const cuts = parseSmartSkipAnalysisResponse(
      '```json\n{"cuts":[{"start":1,"end":2,"category":"sponsor","reason":"Paid promotion","confidence":0.96},{"start":99,"end":100,"category":"ramble","reason":"Invented","confidence":1}]}\n```',
      chunk,
    );
    expect(cuts).toEqual([
      {
        start: 1,
        end: 2,
        category: 'sponsor',
        reason: 'Paid promotion',
        confidence: 0.96,
      },
    ]);
  });

  it('rejects valid JSON that is not a Smart Skip response', () => {
    const [chunk] = buildSmartSkipAnalysisChunks(
      document,
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    if (!chunk) throw new Error('Expected one chunk.');
    expect(() => parseSmartSkipAnalysisResponse('{"message":"done"}', chunk)).toThrow(
      'action list',
    );
  });

  it('filters low-confidence subjective cuts and requires review above 35 percent', () => {
    const result = normalizeSmartSkipIntervals(
      [
        {
          start: 1,
          end: 2,
          category: 'sponsor',
          reason: 'Paid promotion',
          confidence: 0.96,
        },
        {
          start: 4,
          end: 4,
          category: 'ramble',
          reason: 'Low-value tangent',
          confidence: 0.9,
        },
        {
          start: 0,
          end: 0,
          category: 'repetition',
          reason: 'Uncertain repeat',
          confidence: 0.7,
        },
      ],
      document,
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    expect(result.intervals).toHaveLength(2);
    expect(result.reviewRequired).toBe(true);
  });

  it('fingerprints transcript content and builds configuration-specific cache keys', () => {
    expect(transcriptFingerprint(document)).toMatch(/^[a-f0-9]{8}$/);
    expect(
      smartSkipAnalysisCacheKey(document, 'en', DEFAULT_SMART_SKIP_CONFIGURATION),
    ).toContain('video-1:en:');
    expect(
      smartSkipAnalysisCacheKey(document, 'en', DEFAULT_SMART_SKIP_CONFIGURATION),
    ).not.toBe(
      smartSkipAnalysisCacheKey(document, 'en', {
        ...DEFAULT_SMART_SKIP_CONFIGURATION,
        provider: 'chatgpt',
      }),
    );
  });

  it('invalidates skip caches when duration or raw cue timing changes', () => {
    const withSpeechRanges: TranscriptDocument = {
      ...document,
      speechRanges: [
        { startSeconds: 0, endSeconds: 4.5 },
        { startSeconds: 5.2, endSeconds: 14.8 },
      ],
    };
    const changedRange: TranscriptDocument = {
      ...withSpeechRanges,
      speechRanges: [
        { startSeconds: 0, endSeconds: 4.5 },
        { startSeconds: 6.2, endSeconds: 14.8 },
      ],
    };

    expect(transcriptFingerprint(withSpeechRanges)).not.toBe(
      transcriptFingerprint(changedRange),
    );
    expect(transcriptFingerprint(document)).not.toBe(
      transcriptFingerprint({ ...document, durationSeconds: 101 }),
    );
    expect(
      smartSkipAnalysisCacheKey(
        withSpeechRanges,
        'en',
        DEFAULT_SMART_SKIP_CONFIGURATION,
      ),
    ).toContain('skip-v9');
  });

  it('adds high-confidence semantic cuts without replacing instant cuts', () => {
    const instant = {
      schemaVersion: 1 as const,
      videoId: document.videoId,
      trackId: 'en',
      transcriptFingerprint: transcriptFingerprint(document),
      provider: 'gemini' as const,
      strictness: 'balanced' as const,
      categories: DEFAULT_SMART_SKIP_CONFIGURATION.categories,
      analyzedAt: 1,
      reviewRequired: false,
      intervals: [
        {
          id: 'video-1:instant-opening',
          startSegmentIndex: 0,
          endSegmentIndex: 0,
          startSeconds: 0,
          endSeconds: 5,
          category: 'intro' as const,
          reason: 'Fast start',
          confidence: 1,
          enabled: true,
          source: 'instant' as const,
        },
      ],
    };
    const deep = normalizeSmartSkipIntervals(
      [
        {
          start: 4,
          end: 4,
          category: 'ramble',
          reason: 'Disposable middle tangent',
          confidence: 0.96,
        },
      ],
      document,
      DEFAULT_SMART_SKIP_CONFIGURATION,
    );
    const merged = mergeSmartSkipAnalyses(instant, deep, 100);
    expect(merged.intervals).toHaveLength(2);
    expect(merged.intervals[0]?.id).toBe('video-1:instant-opening');
    expect(merged.intervals[1]).toMatchObject({
      source: 'deep',
      reason: 'Disposable middle tangent',
      startSeconds: 60,
      enabled: false,
    });
    expect(merged.reviewRequired).toBe(true);
  });

  it('keeps deep auto-cuts within the 35 percent safety budget', () => {
    const instant = {
      schemaVersion: 1 as const,
      videoId: document.videoId,
      trackId: 'en',
      transcriptFingerprint: transcriptFingerprint(document),
      provider: 'gemini' as const,
      strictness: 'aggressive' as const,
      categories: DEFAULT_SMART_SKIP_CONFIGURATION.categories,
      analyzedAt: 1,
      reviewRequired: false,
      intervals: [
        {
          id: 'video-1:instant-opening',
          startSegmentIndex: 0,
          endSegmentIndex: 0,
          startSeconds: 0,
          endSeconds: 7,
          category: 'intro' as const,
          reason: 'Fast start',
          confidence: 1,
          enabled: true,
          source: 'instant' as const,
        },
      ],
    };
    const deep = {
      intervals: [
        {
          id: 'deep-high',
          startSegmentIndex: 1,
          endSegmentIndex: 1,
          startSeconds: 20,
          endSeconds: 40,
          category: 'ramble' as const,
          reason: 'High-confidence tangent',
          confidence: 0.99,
          enabled: true,
          source: 'deep' as const,
        },
        {
          id: 'deep-low',
          startSegmentIndex: 2,
          endSegmentIndex: 2,
          startSeconds: 50,
          endSeconds: 70,
          category: 'repetition' as const,
          reason: 'Lower-confidence repeat',
          confidence: 0.95,
          enabled: true,
          source: 'deep' as const,
        },
      ],
      reviewRequired: false,
    };

    const merged = mergeSmartSkipAnalyses(instant, deep, 100);

    expect(merged.intervals.find((cut) => cut.id === 'deep-high')?.enabled).toBe(true);
    expect(merged.intervals.find((cut) => cut.id === 'deep-low')?.enabled).toBe(false);
    expect(merged.reviewRequired).toBe(true);
  });
});
