import { observeDocumentMutations } from './document-mutations';
import { parseYouTubeVideoUrl } from './youtube-url';

export interface PlaybackSnapshot {
  readonly currentTimeSeconds: number;
  readonly durationSeconds: number | null;
  readonly playbackRate: number;
  readonly paused: boolean;
  readonly adActive: boolean;
  readonly supported: boolean;
  /** Active media identity, when YouTube exposes it. */
  readonly videoId?: string | null;
}

export interface PlaybackController {
  readonly snapshot: PlaybackSnapshot;
  seek(seconds: number): void;
  /** Schedules against decoded media frames when the active player supports it. */
  requestVideoFrame?(callback: () => void): (() => void) | null;
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
  videoId: null,
});

const finiteDuration = (video: HTMLVideoElement): number | null =>
  Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;

const activeVideoId = (
  video: HTMLVideoElement,
  documentRef: Document,
): string | null => {
  const player = video.closest<HTMLElement & { getVideoData?: () => unknown }>(
    '.html5-video-player',
  );
  try {
    const data = player?.getVideoData?.();
    if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>;
      const id = record.video_id ?? record.videoId;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
  } catch {
    // YouTube may replace the player while its page API is being read.
  }

  const shortLink = video
    .closest('ytd-reel-video-renderer')
    ?.querySelector<HTMLAnchorElement>('a[href^="/shorts/"]');
  if (shortLink) {
    const parsed = parseYouTubeVideoUrl(new URL(shortLink.href, documentRef.URL).href);
    if (parsed?.videoId) return parsed.videoId;
  }
  return parseYouTubeVideoUrl(documentRef.location.href)?.videoId ?? null;
};

const resolvePlaybackVideo = (documentRef: Document): HTMLVideoElement | null => {
  if (documentRef.location.pathname.startsWith('/shorts')) {
    const activeShort = documentRef.querySelector<HTMLVideoElement>(
      'ytd-reel-video-renderer[is-active] video.html5-main-video',
    );
    if (activeShort) return activeShort;
  } else {
    const watchVideo = documentRef.querySelector<HTMLVideoElement>(
      'ytd-watch-flexy #movie_player video.html5-main-video, #movie_player video.html5-main-video, ytd-watch-flexy video.html5-main-video',
    );
    if (watchVideo) return watchVideo;

    const nonShortVideo = Array.from(
      documentRef.querySelectorAll<HTMLVideoElement>('video.html5-main-video'),
    ).find((video) => !video.closest('ytd-reel-video-renderer'));
    if (nonShortVideo) return nonShortVideo;
  }

  return documentRef.querySelector<HTMLVideoElement>(
    'video.html5-main-video, #movie_player video, video',
  );
};

const sameSnapshot = (left: PlaybackSnapshot, right: PlaybackSnapshot): boolean =>
  left.currentTimeSeconds === right.currentTimeSeconds &&
  left.durationSeconds === right.durationSeconds &&
  left.playbackRate === right.playbackRate &&
  left.paused === right.paused &&
  left.adActive === right.adActive &&
  left.supported === right.supported &&
  left.videoId === right.videoId;

/** Reconnects automatically when YouTube replaces its video element. */
export class HtmlVideoPlaybackController implements PlaybackController {
  #video: HTMLVideoElement | null = null;
  #snapshot: PlaybackSnapshot = EMPTY_SNAPSHOT;
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  readonly #unobserve: () => void;
  #scheduled = false;
  #disposed = false;

  public constructor(private readonly documentRef: Document = document) {
    this.#unobserve = observeDocumentMutations(this.documentRef, () =>
      this.#scheduleConnect(),
    );
    this.#connect();
  }

  public get snapshot(): PlaybackSnapshot {
    return this.#readSnapshot();
  }

  readonly #onVideoEvent = () => this.#publish();

  public seek(seconds: number): void {
    if (!this.#video || !Number.isFinite(seconds)) return;
    const duration = finiteDuration(this.#video);
    this.#video.currentTime = Math.max(0, Math.min(duration ?? seconds, seconds));
    this.#publish();
  }

  public requestVideoFrame(callback: () => void): (() => void) | null {
    const video = this.#video;
    if (!video || typeof video.requestVideoFrameCallback !== 'function') return null;
    let active = true;
    const handle = video.requestVideoFrameCallback(() => {
      if (!active || this.#disposed || this.#video !== video) return;
      active = false;
      callback();
    });
    return () => {
      if (!active) return;
      active = false;
      video.cancelVideoFrameCallback(handle);
    };
  }

  public subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unobserve();
    this.#detach();
    this.#listeners.clear();
  }

  /** Re-resolves when YouTube changes routes or which retained Short is active. */
  #needsReconnect(): boolean {
    return resolvePlaybackVideo(this.documentRef) !== this.#video;
  }

  #scheduleConnect(): void {
    if (this.#disposed || this.#scheduled || !this.#needsReconnect()) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      if (!this.#disposed) this.#connect();
    });
  }

  #connect(): void {
    if (this.#disposed) return;
    const next = resolvePlaybackVideo(this.documentRef);
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

  #readSnapshot(): PlaybackSnapshot {
    const video = this.#video;
    return video
      ? {
          currentTimeSeconds: Number.isFinite(video.currentTime)
            ? Math.max(0, video.currentTime)
            : 0,
          durationSeconds: finiteDuration(video),
          playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
          paused: video.paused,
          adActive: Boolean(
            video.closest('.html5-video-player')?.classList.contains('ad-showing'),
          ),
          supported: video.isConnected,
          videoId: activeVideoId(video, this.documentRef),
        }
      : EMPTY_SNAPSHOT;
  }

  #publish(): void {
    const next = this.#readSnapshot();
    // Subscribers re-render on every publish, so never publish an identical snapshot.
    if (sameSnapshot(next, this.#snapshot)) return;
    this.#snapshot = next;
    for (const listener of this.#listeners) listener(next);
  }
}
