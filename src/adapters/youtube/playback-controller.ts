export interface PlaybackSnapshot {
  readonly currentTimeSeconds: number;
  readonly durationSeconds: number | null;
  readonly playbackRate: number;
  readonly paused: boolean;
  readonly adActive: boolean;
  readonly supported: boolean;
}

export interface PlaybackController {
  readonly snapshot: PlaybackSnapshot;
  seek(seconds: number): void;
  setPlaybackRate(rate: number): void;
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
  dispose(): void;
}

const EMPTY_SNAPSHOT: PlaybackSnapshot = Object.freeze({
  currentTimeSeconds: 0,
  durationSeconds: null,
  playbackRate: 1,
  paused: true,
  adActive: false,
  supported: false,
});

const finiteDuration = (video: HTMLVideoElement): number | null =>
  Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;

/** Reconnects automatically when YouTube replaces its video element. */
export class HtmlVideoPlaybackController implements PlaybackController {
  #video: HTMLVideoElement | null = null;
  #snapshot: PlaybackSnapshot = EMPTY_SNAPSHOT;
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  readonly #observer: MutationObserver;
  #scheduled = false;

  public constructor(private readonly documentRef: Document = document) {
    this.#observer = new MutationObserver(() => this.#scheduleConnect());
    this.#observer.observe(this.documentRef.documentElement, {
      childList: true,
      subtree: true,
    });
    this.#connect();
  }

  public get snapshot(): PlaybackSnapshot {
    return this.#snapshot;
  }

  readonly #onVideoEvent = () => this.#publish();

  public seek(seconds: number): void {
    if (!this.#video || !Number.isFinite(seconds)) return;
    const duration = finiteDuration(this.#video);
    this.#video.currentTime = Math.max(0, Math.min(duration ?? seconds, seconds));
    this.#publish();
  }

  public setPlaybackRate(rate: number): void {
    if (!this.#video || !Number.isFinite(rate)) return;
    this.#video.playbackRate = Math.max(0.25, Math.min(16, rate));
    this.#publish();
  }

  public subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    this.#observer.disconnect();
    this.#detach();
    this.#listeners.clear();
  }

  #scheduleConnect(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#connect();
    });
  }

  #connect(): void {
    const next = this.documentRef.querySelector<HTMLVideoElement>(
      'video.html5-main-video, #movie_player video, video',
    );
    if (next === this.#video) {
      this.#publish();
      return;
    }
    this.#detach();
    this.#video = next;
    for (const event of [
      'timeupdate',
      'durationchange',
      'ratechange',
      'play',
      'pause',
      'loadedmetadata',
      'emptied',
    ])
      this.#video?.addEventListener(event, this.#onVideoEvent);
    this.#publish();
  }

  #detach(): void {
    for (const event of [
      'timeupdate',
      'durationchange',
      'ratechange',
      'play',
      'pause',
      'loadedmetadata',
      'emptied',
    ])
      this.#video?.removeEventListener(event, this.#onVideoEvent);
    this.#video = null;
  }

  #publish(): void {
    const video = this.#video;
    this.#snapshot = video
      ? {
          currentTimeSeconds: Number.isFinite(video.currentTime)
            ? Math.max(0, video.currentTime)
            : 0,
          durationSeconds: finiteDuration(video),
          playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
          paused: video.paused,
          adActive: Boolean(
            this.documentRef.querySelector(
              '#movie_player.ad-showing, .html5-video-player.ad-showing',
            ),
          ),
          supported: video.isConnected,
        }
      : EMPTY_SNAPSHOT;
    for (const listener of this.#listeners) listener(this.#snapshot);
  }
}
