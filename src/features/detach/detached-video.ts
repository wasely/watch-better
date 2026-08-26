import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';
import type {
  YouTubePageController,
  YouTubePageSnapshot,
} from '@/adapters/youtube/youtube-page-controller';
import type { WebChatProviderId } from '@/services/web-chat';

export type DetachedVideoKind = 'watch' | 'shorts';

export interface DetachedVideoContext {
  readonly videoId: string;
  readonly videoKind: DetachedVideoKind;
  readonly videoUrl: string;
  readonly videoTitle: string;
  readonly generation: number;
  readonly provider: WebChatProviderId;
}

const DETACHED_PLAYBACK: PlaybackSnapshot = Object.freeze({
  currentTimeSeconds: 0,
  durationSeconds: null,
  playbackRate: 1,
  paused: true,
  adActive: false,
  supported: false,
});

export class DetachedPageController implements YouTubePageController {
  public readonly snapshot: YouTubePageSnapshot;

  public constructor(context: DetachedVideoContext) {
    this.snapshot = {
      kind: context.videoKind,
      url: context.videoUrl,
      videoId: context.videoId,
      generation: context.generation,
    };
  }

  public start(): void {}

  public subscribe(listener: (snapshot: YouTubePageSnapshot) => void): () => void {
    listener(this.snapshot);
    return () => undefined;
  }

  public dispose(): void {}
}

/** Resolves the live player only while this tab is showing the card's own video. */
export type LiveVideoResolver = (videoId: string) => PlaybackController | null;

/**
 * Playback for a detached card. Seeking drives the video already open in this tab
 * when it is the card's video, and is otherwise inert — a detached card must never
 * open a tab or navigate the page out from under the viewer.
 */
export class DetachedPlaybackController implements PlaybackController {
  #snapshot: PlaybackSnapshot = DETACHED_PLAYBACK;
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  #live: PlaybackController | null = null;
  #unsubscribeLive: (() => void) | null = null;
  #disposed = false;

  public constructor(
    private readonly context: DetachedVideoContext,
    private readonly resolveLiveVideo: LiveVideoResolver = () => null,
  ) {
    this.refresh();
  }

  public get snapshot(): PlaybackSnapshot {
    return this.#snapshot;
  }

  /** Re-checks whether this tab is currently showing the card's video. */
  public refresh(): void {
    if (this.#disposed) return;
    const next = this.resolveLiveVideo(this.context.videoId);
    if (next === this.#live) return;
    this.#unsubscribeLive?.();
    this.#unsubscribeLive = null;
    this.#live = next;
    if (next)
      this.#unsubscribeLive = next.subscribe((snapshot) => this.#publish(snapshot));
    else this.#publish(DETACHED_PLAYBACK);
  }

  public seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    this.#live?.seek(seconds);
  }

  public subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  /** Never disposes the live controller — the attached panel owns it. */
  public dispose(): void {
    this.#disposed = true;
    this.#unsubscribeLive?.();
    this.#unsubscribeLive = null;
    this.#live = null;
    this.#listeners.clear();
  }

  #publish(snapshot: PlaybackSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
  }
}
