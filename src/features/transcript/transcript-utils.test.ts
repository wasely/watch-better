import { describe, expect, it } from 'vitest';

import { tutorialTranscript } from '@/test/fixtures/transcripts';

import {
  findActiveSegmentIndex,
  findTranscriptMatches,
  formatTimestamp,
  formatTranscriptForClipboard,
} from './transcript-utils';

describe('transcript utilities', () => {
  it('formats short and hour timestamps', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(65.9)).toBe('1:05');
    expect(formatTimestamp(3661)).toBe('1:01:01');
    expect(formatTimestamp(Number.NaN)).toBe('0:00');
  });

  it('finds literal matches case-insensitively', () => {
    const matches = findTranscriptMatches(tutorialTranscript.segments, 'EVIDENCE');
    expect(matches.length).toBeGreaterThan(1);
    expect(matches.every((index) => index >= 0)).toBe(true);
    expect(findTranscriptMatches(tutorialTranscript.segments, 'not-present')).toEqual(
      [],
    );
    expect(findTranscriptMatches(tutorialTranscript.segments, '   ')).toEqual([]);
  });

  it('formats source metadata and selected rows for clipboard', () => {
    const selected = new Set([
      tutorialTranscript.segments[1]?.id ?? '',
      tutorialTranscript.segments[3]?.id ?? '',
    ]);
    const output = formatTranscriptForClipboard(tutorialTranscript, selected);

    expect(output).toContain(tutorialTranscript.videoTitle);
    expect(output).toContain(
      `https://www.youtube.com/watch?v=${tutorialTranscript.videoId}`,
    );
    expect(output).toContain('0:12 —');
    expect(output).toContain('0:36 —');
    expect(output).not.toContain('0:24 —');
  });

  it('finds the active segment with binary lookup and respects gaps', () => {
    const segments = tutorialTranscript.segments;
    expect(findActiveSegmentIndex(segments, 13)).toBe(1);
    expect(findActiveSegmentIndex(segments, 11.8)).toBe(-1);
    expect(findActiveSegmentIndex(segments, -1)).toBe(-1);
  });
});
