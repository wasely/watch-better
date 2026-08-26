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
  readonly basePlaybackRate: number;
}

const initialSnapshot = (): SmartSkipEngineSnapshot => ({
  state: 'disabled',
  timeSavedSeconds: 0,
  lastSkipped: null,
  message: 'Playback is unchanged.',
  basePlaybackRate: 1,
});

const finiteRate = (rate: number, fallback = 1): number =>
  Number.isFinite(rate) ? Math.max(0.25, Math.min(16, rate)) : fallback;

const JUMP_FRAME_WINDOW_SECONDS = 0.45;
const JUMP_SCHEDULE_WINDOW_SECONDS = 1.25;
/**
 * When the first map lands after playback already entered a jump (slow caption
 * load), catching up feels like the skip the viewer asked for. Once playback is
 * this deep into a span, leave it alone until the span replays.
 */
const CATCH_UP_WINDOW_SECONDS = 12;

const isValidAction = (action: SmartSkipInterval['action']): boolean =>
  action === undefined || action === 'skip';

const validIntervals = (
  intervals: readonly SmartSkipInterval[],
): readonly SmartSkipInterval[] =>
  intervals
    .filter(
      (interval) =>
        Number.isFinite(interval.startSeconds) &&
        Number.isFinite(interval.endSeconds) &&
        interval.startSeconds >= 0 &&
        interval.endSeconds > interval.startSeconds &&
        isValidAction(interval.action),
    )
    .map((interval) => ({ ...interval, enabled: interval.enabled === true }))
    .sort((left, right) => left.startSeconds - right.startSeconds);

const intervalOverlapRatio = (
  left: SmartSkipInterval,
  right: SmartSkipInterval,
): number => {
  const overlap = Math.max(
    0,
    Math.min(left.endSeconds, right.endSeconds) -
      Math.max(left.startSeconds, right.startSeconds),
  );
  const shorter = Math.min(
    left.endSeconds - left.startSeconds,
    right.endSeconds - right.startSeconds,
  );
  return shorter > 0 ? overlap / shorter : 0;
};

const sameSemanticInterval = (
  left: SmartSkipInterval,
  right: SmartSkipInterval,
): boolean => left.id === right.id || intervalOverlapRatio(left, right) >= 0.6;

export class SmartSkipEngine {
  #enabled = false;
  #intervals: readonly SmartSkipInterval[] = [];
  #snapshot = initialSnapshot();
  #disposed = false;
  #jumpingId: string | null = null;
  #jumpTimer: ReturnType<typeof setTimeout> | null = null;
  #jumpFrameCancel: (() => void) | null = null;
  #baseRate = 1;
  #videoId: string | null = null;
  #observedVideoId: string | null = null;
  #lastSkipSavedSeconds = 0;
  #undoSuppression: SmartSkipInterval | null = null;
  readonly #deferredIntervals: SmartSkipInterval[] = [];
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
    if (this.#disposed) return;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#clearJumpSchedule();
  }

  public setIntervals(
    intervals: readonly SmartSkipInterval[],
    videoId: string | null = null,
  ): void {
    if (this.#disposed) return;
    this.#intervals = validIntervals(intervals);
    this.#videoId = videoId;
    this.#suppressed.clear();
    this.#undoSuppression = null;
    this.#deferredIntervals.length = 0;
    this.#jumpingId = null;
    this.#clearJumpSchedule();
    this.#lastSkipSavedSeconds = 0;
    this.#snapshot = {
      ...initialSnapshot(),
      state: this.#enabled ? 'ready' : 'disabled',
      basePlaybackRate: this.#baseRate,
    };
    this.#notify();
    this.#onPlayback(this.playback.snapshot);
  }

  public updateIntervals(
    intervals: readonly SmartSkipInterval[],
    options: { readonly allowCatchUp?: boolean } = {},
  ): void {
    if (this.#disposed) return;
    const previous = this.#intervals;
    const next = validIntervals(intervals);
    const currentTime = this.playback.snapshot.currentTimeSeconds;
    const allowCatchUp = options.allowCatchUp === true;
    for (const interval of next) {
      if (
        interval.enabled &&
        (interval.action ?? 'skip') === 'skip' &&
        currentTime >= interval.startSeconds &&
        currentTime < interval.endSeconds &&
        !previous.some((candidate) => sameSemanticInterval(candidate, interval)) &&
        !this.#deferredIntervals.some((candidate) =>
          sameSemanticInterval(candidate, interval),
        ) &&
        // A brand-new map that lands shortly after playback walked into a span
        // still jumps right away; deep merges mid-span stay polite.
        !(
          allowCatchUp && currentTime - interval.startSeconds <= CATCH_UP_WINDOW_SECONDS
        )
      )
        this.#deferredIntervals.push(interval);
    }
    this.#intervals = next;
    const ids = new Set(next.map((interval) => interval.id));
    for (const id of this.#suppressed) if (!ids.has(id)) this.#suppressed.delete(id);
    this.#clearJumpSchedule();
    this.#onPlayback(this.playback.snapshot);
  }

  public setEnabled(enabled: boolean): void {
    if (this.#disposed) return;
    if (enabled === this.#enabled) {
      if (enabled) this.#onPlayback(this.playback.snapshot);
      return;
    }
    if (enabled) {
      const playback = this.playback.snapshot;
      if (playback.supported && !playback.adActive) {
        this.#baseRate = finiteRate(playback.playbackRate, this.#baseRate);
      }
      this.#snapshot = { ...this.#snapshot, basePlaybackRate: this.#baseRate };
      this.#enabled = true;
      this.#publish(
        'ready',
        'Smart Skip is watching playback.',
        this.#snapshot.lastSkipped,
      );
      this.#onPlayback(this.playback.snapshot);
      return;
    }

    this.#enabled = false;
    this.#jumpingId = null;
    this.#clearJumpSchedule();
    this.#publish(
      'disabled',
      'Playback speed is unchanged.',
      this.#snapshot.lastSkipped,
    );
  }

  public suppress(intervalId: string, suppressed: boolean): void {
    if (this.#disposed) return;
    if (suppressed) this.#suppressed.add(intervalId);
    else this.#suppressed.delete(intervalId);
  }

  public undoLastSkip(): boolean {
    if (this.#disposed) return false;
    const last = this.#snapshot.lastSkipped;
    if (!last) return false;
    this.#undoSuppression = last;
    this.#jumpingId = last.id;
    this.#clearJumpSchedule();
    this.playback.seek(last.startSeconds);
    this.#snapshot = {
      state: this.#enabled ? 'ready' : 'disabled',
      timeSavedSeconds: Math.max(
        0,
        this.#snapshot.timeSavedSeconds - this.#lastSkipSavedSeconds,
      ),
      lastSkipped: null,
      message: 'Skip undone. This section will play normally for this session.',
      basePlaybackRate: this.#baseRate,
    };
    this.#notify();
    return true;
  }

  public subscribe(listener: (snapshot: SmartSkipEngineSnapshot) => void): () => void {
    listener(this.#snapshot);
    if (this.#disposed) return () => undefined;
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.setEnabled(false);
    this.stop();
    this.#disposed = true;
    this.#listeners.clear();
  }

  #onPlayback(playback: PlaybackSnapshot): void {
    if (this.#disposed) return;
    this.#handleVideoIdentity(playback);
    this.#releaseDeferredIntervals(playback.currentTimeSeconds);
    if (!this.#enabled) {
      if (playback.supported && !playback.adActive)
        this.#captureExternalRate(playback.playbackRate);
      return;
    }
    if (this.#videoId && playback.videoId !== this.#videoId) {
      this.#clearJumpSchedule();
      this.#publish(
        'unsupported',
        'Waiting for this video’s Smart Skip map.',
        this.#snapshot.lastSkipped,
      );
      return;
    }

    if (!playback.supported) {
      this.#clearJumpSchedule();
      this.#publish(
        'unsupported',
        'No supported video player is available.',
        this.#snapshot.lastSkipped,
      );
      return;
    }
    if (playback.adActive) {
      this.#clearJumpSchedule();
      this.#publish(
        'unsupported',
        'Smart Skip is suspended during ads.',
        this.#snapshot.lastSkipped,
      );
      return;
    }
    this.#captureExternalRate(playback.playbackRate);
    if (playback.paused) {
      this.#clearJumpSchedule();
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
        (candidate.action ?? 'skip') === 'skip' &&
        !this.#isSuppressed(candidate) &&
        !this.#isDeferred(candidate) &&
        playback.currentTimeSeconds >= candidate.startSeconds &&
        playback.currentTimeSeconds < candidate.endSeconds,
    );
    if (!interval) {
      this.#jumpingId = null;
      this.#scheduleJumpBoundary(playback);
      const jumps = this.#intervals.filter(
        (candidate) =>
          candidate.enabled &&
          (candidate.action ?? 'skip') === 'skip' &&
          !this.#isSuppressed(candidate) &&
          !this.#isDeferred(candidate),
      ).length;
      this.#publish(
        'ready',
        `${jumps.toLocaleString()} jumps ready. Playback speed is yours.`,
        this.#snapshot.lastSkipped,
      );
      return;
    }

    this.#clearJumpSchedule();
    if (this.#jumpingId === interval.id) return;
    this.#jumpingId = interval.id;
    const startSeconds = playback.currentTimeSeconds;
    this.#publish(
      'skipping',
      `Jumping ${interval.reason.toLocaleLowerCase()}.`,
      this.#snapshot.lastSkipped,
    );
    this.playback.seek(interval.endSeconds);
    const confirmedEnd = Math.min(
      interval.endSeconds,
      this.playback.snapshot.currentTimeSeconds,
    );
    const confirmedMediaSeconds = Math.max(0, confirmedEnd - startSeconds);
    if (confirmedMediaSeconds <= 0.04) {
      this.#jumpingId = null;
      this.#publish(
        'ready',
        `Could not jump ${interval.reason.toLocaleLowerCase()}.`,
        this.#snapshot.lastSkipped,
      );
      return;
    }
    const saved = confirmedMediaSeconds / this.#baseRate;
    this.#lastSkipSavedSeconds = saved;
    this.#snapshot = {
      state: 'ready',
      timeSavedSeconds: this.#snapshot.timeSavedSeconds + saved,
      lastSkipped: interval,
      message: `Jumped ${interval.reason}.`,
      basePlaybackRate: this.#baseRate,
    };
    this.#notify();
  }

  #isSuppressed(interval: SmartSkipInterval): boolean {
    return (
      this.#suppressed.has(interval.id) ||
      (this.#undoSuppression !== null &&
        sameSemanticInterval(this.#undoSuppression, interval))
    );
  }

  #isDeferred(interval: SmartSkipInterval): boolean {
    return this.#deferredIntervals.some((candidate) =>
      sameSemanticInterval(candidate, interval),
    );
  }

  #releaseDeferredIntervals(currentTime: number): void {
    for (let index = this.#deferredIntervals.length - 1; index >= 0; index -= 1) {
      const interval = this.#deferredIntervals[index]!;
      if (currentTime < interval.startSeconds || currentTime >= interval.endSeconds)
        this.#deferredIntervals.splice(index, 1);
    }
  }

  #handleVideoIdentity(playback: PlaybackSnapshot): void {
    const videoId = playback.videoId ?? null;
    if (!videoId) return;
    if (!this.#observedVideoId) {
      this.#observedVideoId = videoId;
      return;
    }
    if (videoId === this.#observedVideoId) return;

    this.#observedVideoId = videoId;
    this.#clearJumpSchedule();
    this.#jumpingId = null;
    this.#undoSuppression = null;
    this.#deferredIntervals.length = 0;
    this.#lastSkipSavedSeconds = 0;

    if (playback.supported && !playback.adActive) {
      const currentRate = finiteRate(playback.playbackRate, this.#baseRate);
      if (Math.abs(currentRate - this.#baseRate) > 0.01) {
        this.#baseRate = currentRate;
      }
    }
    this.#snapshot = {
      ...this.#snapshot,
      timeSavedSeconds: 0,
      lastSkipped: null,
      basePlaybackRate: this.#baseRate,
    };
    this.#notify();
  }

  #scheduleJumpBoundary(playback: PlaybackSnapshot): void {
    this.#clearJumpSchedule();
    const next = this.#intervals.find(
      (candidate) =>
        candidate.enabled &&
        (candidate.action ?? 'skip') === 'skip' &&
        !this.#isSuppressed(candidate) &&
        !this.#isDeferred(candidate) &&
        candidate.startSeconds > playback.currentTimeSeconds,
    );
    if (!next) return;
    const mediaSecondsUntilStart = next.startSeconds - playback.currentTimeSeconds;
    if (mediaSecondsUntilStart > JUMP_SCHEDULE_WINDOW_SECONDS) return;

    const run = () => this.#onPlayback(this.playback.snapshot);
    const realSecondsUntilStart =
      mediaSecondsUntilStart / Math.max(playback.playbackRate, 0.25);
    let frameCancel: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (mediaSecondsUntilStart <= JUMP_FRAME_WINDOW_SECONDS) {
      frameCancel =
        this.playback.requestVideoFrame?.(() => {
          if (this.#jumpFrameCancel !== frameCancel) return;
          this.#jumpFrameCancel = null;
          if (timer !== null && this.#jumpTimer === timer) {
            clearTimeout(timer);
            this.#jumpTimer = null;
          }
          run();
        }) ?? null;
      this.#jumpFrameCancel = frameCancel;
    }
    const delay = Math.max(16, Math.min(250, realSecondsUntilStart * 1000));
    timer = setTimeout(
      () => {
        if (this.#jumpTimer !== timer) return;
        this.#jumpTimer = null;
        this.#jumpFrameCancel?.();
        this.#jumpFrameCancel = null;
        run();
      },
      frameCancel ? Math.min(delay, 100) : delay,
    );
    this.#jumpTimer = timer;
  }

  #clearJumpSchedule(): void {
    if (this.#jumpTimer !== null) clearTimeout(this.#jumpTimer);
    this.#jumpTimer = null;
    this.#jumpFrameCancel?.();
    this.#jumpFrameCancel = null;
  }

  #captureExternalRate(rate: number): void {
    const current = finiteRate(rate, this.#baseRate);
    if (Math.abs(current - this.#baseRate) <= 0.01) return;
    this.#baseRate = current;
    this.#snapshot = { ...this.#snapshot, basePlaybackRate: current };
    this.#notify();
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
