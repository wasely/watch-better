import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';

import type { SmartSkipInterval } from './domain';

export type SmartSkipPlaybackState = 'disabled' | 'ready' | 'skipping' | 'unsupported';

export interface SmartSkipEngineSnapshot {
  readonly state: SmartSkipPlaybackState;
  readonly timeSavedSeconds: number;
  readonly lastSkipped: SmartSkipInterval | null;
  readonly message: string;
}

const initialSnapshot = (): SmartSkipEngineSnapshot => ({
  state: 'disabled',
  timeSavedSeconds: 0,
  lastSkipped: null,
  message: 'Playback is unchanged.',
});

export class SmartSkipEngine {
  #enabled = false;
  #intervals: readonly SmartSkipInterval[] = [];
  #snapshot = initialSnapshot();
  #disposed = false;
  #jumpingId: string | null = null;
  #lastSkipSavedSeconds = 0;
  readonly #suppressed = new Set<string>();
  readonly #listeners = new Set<(snapshot: SmartSkipEngineSnapshot) => void>();
  #unsubscribe: (() => void) | null = null;

  public constructor(private readonly playback: PlaybackController) {}

  public get snapshot(): SmartSkipEngineSnapshot {
    return this.#snapshot;
  }

  public start(): void {
    if (this.#disposed || this.#unsubscribe) return;
    this.#unsubscribe = this.playback.subscribe((snapshot) =>
      this.#onPlayback(snapshot),
    );
  }

  public stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  public setIntervals(intervals: readonly SmartSkipInterval[]): void {
    this.#intervals = intervals;
    this.#suppressed.clear();
    this.#jumpingId = null;
    this.#lastSkipSavedSeconds = 0;
    this.#snapshot = {
      ...initialSnapshot(),
      state: this.#enabled ? 'ready' : 'disabled',
    };
    this.#onPlayback(this.playback.snapshot);
  }

  public updateIntervals(intervals: readonly SmartSkipInterval[]): void {
    this.#intervals = intervals;
    const ids = new Set(intervals.map((interval) => interval.id));
    for (const id of this.#suppressed) if (!ids.has(id)) this.#suppressed.delete(id);
    this.#onPlayback(this.playback.snapshot);
  }

  public setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    this.#jumpingId = null;
    this.#publish(
      enabled ? 'ready' : 'disabled',
      enabled ? 'Smart Skip is watching playback.' : 'Playback is unchanged.',
      this.#snapshot.lastSkipped,
    );
    if (enabled) this.#onPlayback(this.playback.snapshot);
  }

  public suppress(intervalId: string, suppressed: boolean): void {
    if (suppressed) this.#suppressed.add(intervalId);
    else this.#suppressed.delete(intervalId);
  }

  public undoLastSkip(): boolean {
    const last = this.#snapshot.lastSkipped;
    if (!last) return false;
    this.#suppressed.add(last.id);
    this.#jumpingId = last.id;
    this.playback.seek(last.startSeconds);
    this.#snapshot = {
      state: this.#enabled ? 'ready' : 'disabled',
      timeSavedSeconds: Math.max(
        0,
        this.#snapshot.timeSavedSeconds - this.#lastSkipSavedSeconds,
      ),
      lastSkipped: null,
      message: 'Skip undone. This section will play normally for this session.',
    };
    this.#notify();
    return true;
  }

  public subscribe(listener: (snapshot: SmartSkipEngineSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.stop();
    this.#disposed = true;
    this.#listeners.clear();
  }

  #onPlayback(playback: PlaybackSnapshot): void {
    if (this.#disposed || !this.#enabled) return;
    if (!playback.supported || playback.adActive) {
      this.#publish(
        'unsupported',
        playback.adActive
          ? 'Smart Skip is suspended during ads.'
          : 'No supported video player is available.',
        this.#snapshot.lastSkipped,
      );
      return;
    }
    if (playback.paused) {
      this.#publish(
        'ready',
        'Ready when playback resumes.',
        this.#snapshot.lastSkipped,
      );
      return;
    }
    const interval = this.#intervals.find(
      (candidate) =>
        candidate.enabled &&
        !this.#suppressed.has(candidate.id) &&
        playback.currentTimeSeconds >= candidate.startSeconds &&
        playback.currentTimeSeconds < candidate.endSeconds,
    );
    if (!interval) {
      this.#jumpingId = null;
      this.#publish(
        'ready',
        `${this.#intervals.filter((candidate) => candidate.enabled && !this.#suppressed.has(candidate.id)).length.toLocaleString()} cuts ready.`,
        this.#snapshot.lastSkipped,
      );
      return;
    }
    if (this.#jumpingId === interval.id) return;
    this.#jumpingId = interval.id;
    const saved = Math.max(0, interval.endSeconds - playback.currentTimeSeconds);
    this.#lastSkipSavedSeconds = saved;
    this.#snapshot = {
      state: 'skipping',
      timeSavedSeconds: this.#snapshot.timeSavedSeconds + saved,
      lastSkipped: interval,
      message: `Skipped ${interval.reason}.`,
    };
    this.#notify();
    this.playback.seek(interval.endSeconds);
  }

  #publish(
    state: SmartSkipPlaybackState,
    message: string,
    lastSkipped: SmartSkipInterval | null,
  ): void {
    if (
      state === this.#snapshot.state &&
      message === this.#snapshot.message &&
      lastSkipped === this.#snapshot.lastSkipped
    )
      return;
    this.#snapshot = { ...this.#snapshot, state, message, lastSkipped };
    this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) listener(this.#snapshot);
  }
}
