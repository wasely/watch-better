import { describe, expect, it } from 'vitest';

import type { TranscriptDocument } from '@/features/transcript/domain';

import { buildQuickLearnPreview } from './quick-learn-preview';

const transcript: TranscriptDocument = {
  videoId: 'preview-video',
  videoTitle: 'How solar batteries keep a home running',
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: false,
  durationSeconds: 210,
  segments: [
    {
      id: '0',
      startSeconds: 0,
      endSeconds: 14,
      text: 'This guide explains how a solar battery stores daytime energy for your home.',
    },
    {
      id: '1',
      startSeconds: 14,
      endSeconds: 28,
      text: 'We will compare capacity, inverter limits, and backup circuits.',
    },
    {
      id: '2',
      startSeconds: 42,
      endSeconds: 60,
      text: 'This video is sponsored and you can use my discount code at checkout.',
    },
    {
      id: '3',
      startSeconds: 76,
      endSeconds: 96,
      text: 'Battery capacity determines how many appliances can keep running overnight.',
    },
    {
      id: '4',
      startSeconds: 105,
      endSeconds: 126,
      text: 'An inverter has a separate power limit that controls which large loads start together.',
    },
    {
      id: '5',
      startSeconds: 154,
      endSeconds: 176,
      text: 'A protected backup circuit keeps essentials online without trying to power the entire house.',
    },
    {
      id: '6',
      startSeconds: 188,
      endSeconds: 208,
      text: 'Choose capacity from overnight usage and inverter power from the appliances you need.',
    },
  ],
};

describe('buildQuickLearnPreview', () => {
  it('creates a caption-derived briefing with chronological key moments', () => {
    const preview = buildQuickLearnPreview(transcript);

    expect(preview.title).toBe(transcript.videoTitle);
    expect(preview.summary).toMatch(/solar battery|capacity|inverter/i);
    expect(preview.summary).not.toMatch(/discount code/i);
    expect(preview.points).toHaveLength(3);
    expect(preview.points.map(({ startSeconds }) => startSeconds)).toEqual(
      [...preview.points.map(({ startSeconds }) => startSeconds)].sort((a, b) => a - b),
    );
    expect(preview.points.map(({ text }) => text).join(' ')).not.toMatch(/sponsor/i);
  });

  it('handles a sparse caption track without inventing content', () => {
    const preview = buildQuickLearnPreview({
      ...transcript,
      durationSeconds: 8,
      segments: [
        { id: 'only', startSeconds: 0, endSeconds: 5, text: '[Music] Hello there' },
      ],
    });

    expect(preview.summary).toBe('Hello there.');
    expect(preview.points).toEqual([]);
  });
});
