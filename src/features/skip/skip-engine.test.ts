import { describe, expect, it } from 'vitest';

import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';
import { DEFAULT_SKIP_CONFIGURATION } from '@/features/settings/settings';
import type { TranscriptSegment } from '@/features/transcript/domain';

import { planTranscriptGaps, TranscriptGapSkipEngine } from './skip-engine';

class FakePlayback implements PlaybackController {
  public snapshot: PlaybackSnapshot = {
    currentTimeSeconds: 0,
    durationSeconds: 100,
    playbackRate: 1.25,
    paused: false,
    adActive: false,
    supported: true,
  };
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  public seek(seconds: number): void {
    this.emit({ currentTimeSeconds: seconds });
  }
  public setPlaybackRate(playbackRate: number): void {
    this.emit({ playbackRate });
  }
  public subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot);
    return () => this.#listeners.delete(listener);
  }
  public dispose(): void {}
  public emit(changes: Partial<PlaybackSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.#listeners) listener(this.snapshot);
  }
}

const segments: readonly TranscriptSegment[] = [
  { id: 'a', startSeconds: 0, endSeconds: 2, text: 'A' },
  { id: 'b', startSeconds: 7, endSeconds: 9, text: 'B' },
];

describe('TranscriptGapSkipEngine', () => {
  it('plans only positive padded gaps above the threshold', () => {
    expect(planTranscriptGaps(segments, DEFAULT_SKIP_CONFIGURATION)).toEqual([
      { id: 'a->b', startSeconds: 2.25, endSeconds: 6.65 },
    ]);
  });

  it('compresses gaps, suspends for ads, and restores the original rate', () => {
    const playback = new FakePlayback();
    const engine = new TranscriptGapSkipEngine(playback);
    engine.setTranscript(segments);
    engine.enable({ ...DEFAULT_SKIP_CONFIGURATION, enabled: true });

    playback.emit({ currentTimeSeconds: 3 });
    expect(playback.snapshot.playbackRate).toBe(2);
    expect(engine.snapshot.state).toBe('active');

    playback.emit({ adActive: true });
    expect(playback.snapshot.playbackRate).toBe(1.25);
    expect(engine.snapshot.state).toBe('unsupported');

    playback.emit({ adActive: false, currentTimeSeconds: 8 });
    engine.disable();
    expect(playback.snapshot.playbackRate).toBe(1.25);
    expect(engine.snapshot.state).toBe('disabled');
    engine.dispose();
  });
});
