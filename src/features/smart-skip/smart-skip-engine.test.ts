import { afterEach, describe, expect, it, vi } from 'vitest';

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
  #frameCallback: (() => void) | null = null;
  public videoFramesSupported = false;

  public seek(seconds: number): void {
    this.emit({ currentTimeSeconds: seconds });
  }
  public requestVideoFrame(callback: () => void): (() => void) | null {
    if (!this.videoFramesSupported) return null;
    this.#frameCallback = callback;
    return () => {
      if (this.#frameCallback === callback) this.#frameCallback = null;
    };
  }
  public emitVideoFrame(currentTimeSeconds: number): void {
    this.snapshot = { ...this.snapshot, currentTimeSeconds };
    const callback = this.#frameCallback;
    this.#frameCallback = null;
    callback?.();
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

  it('retries an unconfirmed early jump without crediting the failed attempt', () => {
    const playback = new FakePlayback();
    const seek = vi.spyOn(playback, 'seek').mockImplementationOnce(() => undefined);
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);

    playback.emit({ currentTimeSeconds: 12 });
    expect(seek).toHaveBeenCalledTimes(1);
    expect(engine.snapshot.timeSavedSeconds).toBe(0);
    expect(engine.snapshot.lastSkipped).toBeNull();
    expect(engine.snapshot.message).toMatch(/Could not jump/i);

    playback.emit({ currentTimeSeconds: 12.2 });
    expect(seek).toHaveBeenCalledTimes(2);
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
    expect(engine.snapshot.timeSavedSeconds).toBeCloseTo(7.8);
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

  it('never changes the playback speed selected by the user', () => {
    vi.useFakeTimers();
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, playbackRate: 2 };
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);

    playback.emit({ currentTimeSeconds: 5 });
    expect(playback.snapshot.playbackRate).toBe(2);
    expect(playback.snapshot.currentTimeSeconds).toBe(5);

    playback.emit({ currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
    expect(playback.snapshot.playbackRate).toBe(2);
  });

  it('preserves savings while updating the active map', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);
    playback.emit({ currentTimeSeconds: 12 });

    engine.updateIntervals([{ ...interval, enabled: false }]);
    expect(engine.snapshot.timeSavedSeconds).toBe(8);
    expect(engine.snapshot.lastSkipped?.id).toBe(interval.id);
  });

  it('tracks an external playback rate without modifying it', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setEnabled(true);
    expect(playback.snapshot.playbackRate).toBe(1);

    playback.emit({ playbackRate: 2 });
    expect(playback.snapshot.playbackRate).toBe(2);
    expect(engine.snapshot.basePlaybackRate).toBe(2);
    engine.setEnabled(false);
    expect(playback.snapshot.playbackRate).toBe(2);
  });

  it('never applies a map to another or unidentified video', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, videoId: 'video-b' };
    const engine = new SmartSkipEngine(playback);
    const seek = vi.spyOn(playback, 'seek');
    engine.start();
    engine.setIntervals([interval], 'video-a');
    engine.setEnabled(true);

    playback.emit({ currentTimeSeconds: 12 });
    expect(seek).not.toHaveBeenCalled();
    expect(engine.snapshot.message).toMatch(/Waiting for this video/i);

    playback.emit({ currentTimeSeconds: 12, videoId: null });
    expect(seek).not.toHaveBeenCalled();

    playback.emit({ currentTimeSeconds: 12, videoId: 'video-a' });
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
  });

  it('does not touch ad playback or adopt an ad-imposed rate', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, playbackRate: 1.5 };
    const engine = new SmartSkipEngine(playback);
    engine.start();

    playback.emit({ adActive: true, playbackRate: 0.5 });
    engine.setEnabled(true);
    expect(engine.snapshot.basePlaybackRate).toBe(1.5);
    expect(playback.snapshot.playbackRate).toBe(0.5);

    playback.emit({ adActive: false, playbackRate: 1.5 });
    expect(engine.snapshot.basePlaybackRate).toBe(1.5);
    expect(playback.snapshot.playbackRate).toBe(1.5);
  });

  it('captures the user baseline after being enabled during an ad', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, adActive: true, playbackRate: 0.5 };
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setEnabled(true);

    expect(playback.snapshot.playbackRate).toBe(0.5);
    playback.emit({ adActive: false, playbackRate: 2 });
    expect(engine.snapshot.basePlaybackRate).toBe(2);
    expect(playback.snapshot.playbackRate).toBe(2);
  });

  it('preserves a user speed selected while an ad is active', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, playbackRate: 1.5 };
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setEnabled(true);

    playback.emit({ adActive: true, playbackRate: 0.5 });
    playback.emit({ playbackRate: 2 });
    expect(playback.snapshot.playbackRate).toBe(2);
    playback.emit({ adActive: false });
    expect(engine.snapshot.basePlaybackRate).toBe(2);
    expect(playback.snapshot.playbackRate).toBe(2);
  });

  it('leaves the user speed untouched across ads and stop', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, playbackRate: 1.5 };
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);

    playback.emit({ adActive: true });
    expect(playback.snapshot.playbackRate).toBe(1.5);
    playback.emit({ adActive: false, currentTimeSeconds: 8 });
    expect(playback.snapshot.playbackRate).toBe(1.5);
    engine.stop();
    expect(playback.snapshot.playbackRate).toBe(1.5);
  });

  it('uses decoded frames to catch a hard-jump boundary between timeupdates', () => {
    vi.useFakeTimers();
    const playback = new FakePlayback();
    playback.videoFramesSupported = true;
    playback.snapshot = { ...playback.snapshot, currentTimeSeconds: 9.8 };
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);

    expect(playback.snapshot.currentTimeSeconds).toBe(9.8);
    playback.emitVideoFrame(10.01);
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
    expect(engine.snapshot.lastSkipped?.id).toBe(interval.id);
  });

  it('defers a newly refined jump until playback leaves that sentence', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, currentTimeSeconds: 12 };
    const seek = vi.spyOn(playback, 'seek');
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([]);
    engine.setEnabled(true);

    engine.updateIntervals([interval]);
    playback.emit({ currentTimeSeconds: 13 });
    expect(seek).not.toHaveBeenCalled();

    playback.emit({ currentTimeSeconds: 21 });
    playback.emit({ currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
  });

  it('catches up immediately when a fresh local map lands just after entry', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, currentTimeSeconds: 12 };
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([]);
    engine.setEnabled(true);

    engine.updateIntervals([interval], { allowCatchUp: true });
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
    expect(engine.snapshot.lastSkipped?.id).toBe(interval.id);
  });

  it('keeps deep merges polite when playback is far into the span', () => {
    const playback = new FakePlayback();
    // Entered at 10s, now 25s in: beyond the catch-up window.
    playback.snapshot = { ...playback.snapshot, currentTimeSeconds: 25 };
    const seek = vi.spyOn(playback, 'seek');
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([]);
    engine.setEnabled(true);

    engine.updateIntervals([{ ...interval, startSeconds: 10 }], {
      allowCatchUp: true,
    });
    expect(seek).not.toHaveBeenCalled();

    playback.emit({ currentTimeSeconds: 21 });
    playback.emit({ currentTimeSeconds: 11 });
    expect(playback.snapshot.currentTimeSeconds).toBe(20);
  });

  it('keeps an undone section suppressed when refinement replaces its id', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);
    playback.emit({ currentTimeSeconds: 12 });
    expect(engine.undoLastSkip()).toBe(true);

    engine.updateIntervals([
      { ...interval, id: 'deep-replacement', startSeconds: 9.8, endSeconds: 20.2 },
    ]);
    playback.emit({ currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(12);
  });

  it('leaves the user speed untouched when playback reaches a new video', () => {
    const playback = new FakePlayback();
    playback.snapshot = { ...playback.snapshot, videoId: 'video-a' };
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([], 'video-a');
    engine.setEnabled(true);
    expect(playback.snapshot.playbackRate).toBe(1);

    playback.emit({ videoId: 'video-b' });
    expect(playback.snapshot.playbackRate).toBe(1);
    expect(engine.snapshot.message).toMatch(/Waiting for this video/i);
  });

  it('rejects malformed actions and becomes inert after disposal', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([
      { ...interval, action: 'teleport' } as unknown as SmartSkipInterval,
    ]);
    engine.setEnabled(true);
    playback.emit({ currentTimeSeconds: 12 });
    expect(playback.snapshot.currentTimeSeconds).toBe(12);

    engine.dispose();
    const disposedSnapshot = engine.snapshot;
    engine.setIntervals([interval]);
    engine.setEnabled(true);
    engine.updateIntervals([interval]);
    expect(engine.undoLastSkip()).toBe(false);
    expect(engine.snapshot).toBe(disposedSnapshot);
  });

  it('publishes a disabled map reset', () => {
    const playback = new FakePlayback();
    const engine = new SmartSkipEngine(playback);
    engine.start();
    engine.setIntervals([interval]);
    engine.setEnabled(true);
    playback.emit({ currentTimeSeconds: 12 });
    engine.setEnabled(false);
    const listener = vi.fn();
    engine.subscribe(listener);
    listener.mockClear();

    engine.setIntervals([]);
    expect(listener).toHaveBeenCalled();
    expect(engine.snapshot.lastSkipped).toBeNull();
    expect(engine.snapshot.timeSavedSeconds).toBe(0);
  });
});

afterEach(() => vi.useRealTimers());
