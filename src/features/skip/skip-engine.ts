export type SkipPresetId = 'conservative' | 'balanced' | 'aggressive';

export interface SkipConfiguration {
  readonly enabled: boolean;
  readonly preset: SkipPresetId;
  readonly minimumGapSeconds: number;
  readonly leadingPaddingSeconds: number;
  readonly trailingPaddingSeconds: number;
  readonly speechPlaybackRate: number;
  readonly gapPlaybackRate: number;
  readonly jumpLongGaps: boolean;
  readonly jumpThresholdSeconds: number;
}

export type SkipDetectionState =
  'disabled' | 'waiting-for-transcript' | 'ready' | 'active' | 'unsupported' | 'error';

export interface SkipEngineSnapshot {
  readonly state: SkipDetectionState;
  readonly timeSavedSeconds: number;
  readonly message: string | null;
}

export interface SkipEngine {
  readonly snapshot: SkipEngineSnapshot;
  enable(configuration: SkipConfiguration): void;
  update(configuration: SkipConfiguration): void;
  disable(): void;
  subscribe(listener: (snapshot: SkipEngineSnapshot) => void): () => void;
  dispose(): void;
}

export interface TranscriptGap {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export const planTranscriptGaps = (
  segments: readonly TranscriptSegment[],
  configuration: SkipConfiguration,
): readonly TranscriptGap[] => {
  const valid = segments.filter(
    (segment) =>
      Number.isFinite(segment.startSeconds) &&
      Number.isFinite(segment.endSeconds) &&
      segment.startSeconds >= 0 &&
      segment.endSeconds > segment.startSeconds,
  );
  const gaps: TranscriptGap[] = [];
  for (let index = 0; index + 1 < valid.length; index += 1) {
    const current = valid[index];
    const next = valid[index + 1];
    if (!current || !next || next.startSeconds <= current.startSeconds) continue;
    const startSeconds = current.endSeconds + configuration.trailingPaddingSeconds;
    const endSeconds = next.startSeconds - configuration.leadingPaddingSeconds;
    if (
      endSeconds - startSeconds < configuration.minimumGapSeconds ||
      endSeconds <= startSeconds
    )
      continue;
    gaps.push({
      id: `${current.id}->${next.id}`,
      startSeconds,
      endSeconds,
    });
  }
  return gaps;
};

const disabledSnapshot = (): SkipEngineSnapshot => ({
  state: 'disabled',
  timeSavedSeconds: 0,
  message: 'Playback is unchanged.',
});

/** Conservative caption-gap engine. It never classifies semantic content. */
export class TranscriptGapSkipEngine implements SkipEngine {
  #configuration: SkipConfiguration | null = null;
  #segments: readonly TranscriptSegment[] = [];
  #gaps: readonly TranscriptGap[] = [];
  #snapshot: SkipEngineSnapshot = disabledSnapshot();
  #originalRate = 1;
  #lastTime: number | null = null;
  #activeRate = 1;
  #timeSavedSeconds = 0;
  #disposed = false;
  readonly #jumped = new Set<string>();
  readonly #listeners = new Set<(snapshot: SkipEngineSnapshot) => void>();
  readonly #unsubscribe: () => void;

  public constructor(private readonly playback: PlaybackController) {
    this.#unsubscribe = playback.subscribe((snapshot) => this.#onPlayback(snapshot));
  }

  public get snapshot(): SkipEngineSnapshot {
    return this.#snapshot;
  }

  public setTranscript(segments: readonly TranscriptSegment[] | null): void {
    this.#segments = segments ?? [];
    this.#jumped.clear();
    this.#timeSavedSeconds = 0;
    this.#lastTime = null;
    this.#replan();
    this.#onPlayback(this.playback.snapshot);
  }

  public enable(configuration: SkipConfiguration): void {
    if (this.#disposed) return;
    this.#configuration = { ...configuration, enabled: true };
    this.#originalRate = this.playback.snapshot.playbackRate;
    this.#activeRate = this.#originalRate;
    this.#lastTime = this.playback.snapshot.currentTimeSeconds;
    this.#replan();
    this.#onPlayback(this.playback.snapshot);
  }

  public update(configuration: SkipConfiguration): void {
    if (!configuration.enabled) {
      this.disable();
      return;
    }
    if (!this.#configuration?.enabled) {
      this.enable(configuration);
      return;
    }
    this.#configuration = configuration;
    this.#replan();
    this.#onPlayback(this.playback.snapshot);
  }

  public disable(): void {
    const wasEnabled = Boolean(this.#configuration?.enabled);
    this.#configuration = null;
    if (wasEnabled) this.#setRate(this.#originalRate);
    this.#lastTime = null;
    this.#activeRate = 1;
    this.#publish('disabled', 'Playback restored to its previous speed.');
  }

  public subscribe(listener: (snapshot: SkipEngineSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.disable();
    this.#disposed = true;
    this.#unsubscribe();
    this.#listeners.clear();
  }

  #replan(): void {
    this.#gaps = this.#configuration
      ? planTranscriptGaps(this.#segments, this.#configuration)
      : [];
  }

  #onPlayback(playback: PlaybackSnapshot): void {
    const configuration = this.#configuration;
    if (this.#disposed || !configuration?.enabled) return;

    this.#recordSavedTime(playback.currentTimeSeconds);
    if (!playback.supported) {
      this.#setRate(this.#originalRate);
      this.#publish('unsupported', 'No supported YouTube video player is available.');
      return;
    }
    if (playback.adActive) {
      this.#setRate(this.#originalRate);
      this.#publish('unsupported', 'Jump cutting is suspended during ads.');
      return;
    }
    if (this.#segments.length === 0) {
      this.#setRate(configuration.speechPlaybackRate);
      this.#publish(
        'waiting-for-transcript',
        'Waiting for reliable transcript timing.',
      );
      return;
    }
    if (playback.paused) {
      this.#setRate(configuration.speechPlaybackRate);
      this.#publish('ready', 'Ready when playback resumes.');
      return;
    }

    const gap = this.#gaps.find(
      (candidate) =>
        playback.currentTimeSeconds >= candidate.startSeconds &&
        playback.currentTimeSeconds < candidate.endSeconds,
    );
    if (!gap) {
      this.#setRate(configuration.speechPlaybackRate);
      this.#publish(
        'ready',
        this.#gaps.length
          ? `${this.#gaps.length.toLocaleString()} reliable caption gaps detected.`
          : 'No caption gaps meet the current safety threshold.',
      );
      return;
    }

    const remaining = gap.endSeconds - playback.currentTimeSeconds;
    if (
      configuration.jumpLongGaps &&
      gap.endSeconds - gap.startSeconds >= configuration.jumpThresholdSeconds &&
      !this.#jumped.has(gap.id)
    ) {
      this.#jumped.add(gap.id);
      this.#timeSavedSeconds += Math.max(0, remaining);
      this.#lastTime = gap.endSeconds;
      this.playback.seek(gap.endSeconds);
      this.#setRate(configuration.speechPlaybackRate);
      this.#publish('active', 'Jumped one long, padded caption gap.');
      return;
    }

    this.#setRate(configuration.gapPlaybackRate);
    this.#publish(
      'active',
      `Compressing a padded caption gap at ${configuration.gapPlaybackRate}×.`,
    );
  }

  #recordSavedTime(currentTime: number): void {
    if (
      this.#lastTime !== null &&
      currentTime >= this.#lastTime &&
      currentTime - this.#lastTime < 5 &&
      this.#activeRate > 1
    )
      this.#timeSavedSeconds +=
        (currentTime - this.#lastTime) * (1 - 1 / this.#activeRate);
    this.#lastTime = currentTime;
  }

  #setRate(rate: number): void {
    this.#activeRate = rate;
    if (Math.abs(this.playback.snapshot.playbackRate - rate) > 0.001)
      this.playback.setPlaybackRate(rate);
  }

  #publish(state: SkipDetectionState, message: string): void {
    const next: SkipEngineSnapshot = {
      state,
      timeSavedSeconds: this.#timeSavedSeconds,
      message,
    };
    if (
      next.state === this.#snapshot.state &&
      next.message === this.#snapshot.message &&
      Math.abs(next.timeSavedSeconds - this.#snapshot.timeSavedSeconds) < 0.01
    )
      return;
    this.#snapshot = next;
    for (const listener of this.#listeners) listener(next);
  }
}
import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';
import type { TranscriptSegment } from '@/features/transcript/domain';
