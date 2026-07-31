import { describe, expect, it } from 'vitest';

import { TranscriptPromptProvider } from '@/features/ask/transcript-prompt-provider';
import { podcastTranscript, tutorialTranscript } from '@/test/fixtures/transcripts';

const provider = new TranscriptPromptProvider();

describe('TranscriptPromptProvider', () => {
  it('builds a complete timestamped prompt for a short video', () => {
    const result = provider.buildPrompt({
      transcript: tutorialTranscript,
      scope: 'entire-video',
      currentTimeSeconds: 0,
      selectedSegmentIds: new Set(),
      question: 'Summarize the main argument and evidence.',
    });

    expect(result.text).toContain(tutorialTranscript.videoTitle);
    expect(result.text).toContain(
      `https://www.youtube.com/watch?v=${tutorialTranscript.videoId}`,
    );
    expect(result.text).toContain('[0:00]');
    expect(result.text).toContain('[4:48]');
    expect(result.includedSegmentCount).toBe(tutorialTranscript.segments.length);
    expect(result.omittedSegmentCount).toBe(0);
    expect(result.wasTruncated).toBe(false);
  });

  it('limits selected scope to explicit rows', () => {
    const selected = new Set([
      tutorialTranscript.segments[2]?.id ?? '',
      tutorialTranscript.segments[4]?.id ?? '',
    ]);
    const result = provider.buildPrompt({
      transcript: tutorialTranscript,
      scope: 'selection',
      currentTimeSeconds: null,
      selectedSegmentIds: selected,
      question: 'Explain these selected claims.',
    });

    expect(result.includedSegmentCount).toBe(2);
    expect(result.text).toContain('[0:24]');
    expect(result.text).toContain('[0:48]');
    expect(result.text).not.toContain('[0:36]');
  });

  it('builds a bounded current section around playback time', () => {
    const result = provider.buildPrompt({
      transcript: tutorialTranscript,
      scope: 'current-section',
      currentTimeSeconds: 144,
      selectedSegmentIds: new Set(),
      question: 'Explain this section.',
    });

    expect(result.includedSegmentCount).toBeGreaterThan(1);
    expect(result.includedSegmentCount).toBeLessThan(
      tutorialTranscript.segments.length,
    );
    expect(result.text).toContain('Context scope: Current section');
    expect(result.text).toContain('[2:24]');
  });

  it('anchors current-section context near playback gaps and the video end', () => {
    const gapResult = provider.buildPrompt({
      transcript: tutorialTranscript,
      scope: 'current-section',
      currentTimeSeconds: 143.8,
      selectedSegmentIds: new Set(),
      question: 'Explain what is happening here.',
    });
    const endResult = provider.buildPrompt({
      transcript: tutorialTranscript,
      scope: 'current-section',
      currentTimeSeconds: 400,
      selectedSegmentIds: new Set(),
      question: 'Explain the ending.',
    });

    expect(gapResult.text).toContain('[2:12]');
    expect(gapResult.text).not.toContain('[0:00]');
    expect(endResult.text).toContain('[4:48]');
    expect(endResult.text).not.toContain('[0:00]');
  });

  it('samples an oversized full transcript and discloses omissions', () => {
    const constrained = new TranscriptPromptProvider(4_000);
    const result = constrained.buildPrompt({
      transcript: podcastTranscript,
      scope: 'entire-video',
      currentTimeSeconds: null,
      selectedSegmentIds: new Set(),
      question: 'Summarize this video.',
    });

    expect(result.characterCount).toBeLessThan(6_000);
    expect(result.includedSegmentCount).toBeGreaterThan(2);
    expect(result.omittedSegmentCount).toBeGreaterThan(0);
    expect(result.wasTruncated).toBe(true);
    expect(result.text).toContain('CONTEXT LIMITATION');
    expect(result.text).toContain('Do not imply that missing context was checked');
  });

  it('prefers topic-relevant rows when the question provides useful terms', () => {
    const constrained = new TranscriptPromptProvider(4_000);
    const result = constrained.buildPrompt({
      transcript: podcastTranscript,
      scope: 'entire-video',
      currentTimeSeconds: null,
      selectedSegmentIds: new Set(),
      question: 'Where do they discuss technical tradeoffs?',
    });

    expect(result.text).toContain('technical tradeoffs');
    expect(result.omittedSegmentCount).toBeGreaterThan(0);
    expect(result.wasTruncated).toBe(true);
  });
});
