import { describe, expect, it } from 'vitest';

import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';

import type { SmartSkipInterval } from './domain';
import { SmartSkipEngine } from './smart-skip-engine';

class FakePlayback implements PlaybackController {
  public snapshot: PlaybackSnapshot = {
    currentTimeSeconds: 0,
    durationSeconds: 100,
    playbackRate: 1,
    paused: false,
    adActive: false,
    supported: true,
  };
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  public seek(seconds: number): void {
    this.emit({ currentTimeSeconds: seconds });
  }
  public setPlaybackRate(): void {}
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

const interval: SmartSkipInterval = {
  id: 'cut-1',
  startSegmentIndex: 1,
  endSegmentIndex: 2,
  startSeconds: 10,
  endSeconds: 20,
  category: 'sponsor',
  reason: 'Paid promotion',
  confidence: 0.95,
  enabled: true,
};

describe('SmartSkipEngine', () => {
  it('skips enabled intervals and records actual saved time', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);
    playback.emit({ currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
    expect(engine.snapshot.timeSavedSeconds).toBe(8);
    expect(engine.snapshot.lastSkipped?.id).toBe('cut-1');
  });

  it('suspends during ads and undo prevents an immediate repeat', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);
    playback.emit({ adActive: true, currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(12);
    playback.emit({ adActive: false });
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
    expect(engine.undoLastSkip()).toBe(true);
    expect(playback.snapshot.currentTimeSeconds).toBe(10);
    playback.emit({ currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(12);
  });

  it('never skips disabled intervals', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([{ ...interval, enabled: false }]);
    engine.setEnabled(true);
    playback.emit({ currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(12);
  });
});
