import { observeDocumentMutations } from './document-mutations';

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

const sameSnapshot = (left: PlaybackSnapshot, right: PlaybackSnapshot): boolean =>
  left.currentTimeSeconds === right.currentTimeSeconds &&
  left.durationSeconds === right.durationSeconds &&
  left.playbackRate === right.playbackRate &&
  left.paused === right.paused &&
  left.adActive === right.adActive &&
  left.supported === right.supported;

/** Reconnects automatically when YouTube replaces its video element. */
export class HtmlVideoPlaybackController implements PlaybackController {
  #video: HTMLVideoElement | null = null;
  #snapshot: PlaybackSnapshot = EMPTY_SNAPSHOT;
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  readonly #unobserve: () => void;
  #scheduled = false;

  public constructor(private readonly documentRef: Document = document) {
    this.#unobserve = observeDocumentMutations(this.documentRef, () =>
      this.#scheduleConnect(),
    );
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
    this.#unobserve();
    this.#detach();
    this.#listeners.clear();
  }

  /**
   * A DOM mutation only matters when the element we are bound to went away. Shorts swap
   * between reel players that all stay connected, so only that page re-resolves eagerly.
   */
  #needsReconnect(): boolean {
    if (!this.#video?.isConnected) return true;
    return this.documentRef.location.pathname.startsWith('/shorts');
  }

  #scheduleConnect(): void {
    if (this.#scheduled || !this.#needsReconnect()) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#connect();
    });
  }

  #connect(): void {
    const next =
      this.documentRef.querySelector<HTMLVideoElement>(
        'ytd-reel-video-renderer[is-active] video.html5-main-video',
      ) ??
      this.documentRef.querySelector<HTMLVideoElement>(
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
    const next: PlaybackSnapshot = video
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
    // Subscribers re-render on every publish, so never publish an identical snapshot.
    if (sameSnapshot(next, this.#snapshot)) return;
    this.#snapshot = next;
    for (const listener of this.#listeners) listener(next);
  }
}
