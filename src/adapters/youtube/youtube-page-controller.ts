import { observeDocumentMutations } from './document-mutations';
import { parseYouTubeVideoUrl, type YouTubePageKind } from './youtube-url';

export type { YouTubePageKind } from './youtube-url';

export interface YouTubePageSnapshot {
  readonly kind: YouTubePageKind;
  readonly url: string;
  readonly videoId: string | null;
  readonly generation: number;
}

export interface YouTubePageController {
  readonly snapshot: YouTubePageSnapshot;
  start(): void;
  subscribe(listener: (snapshot: YouTubePageSnapshot) => void): () => void;
  dispose(): void;
}

const readPage = (url: string, generation: number): YouTubePageSnapshot => {
  const page = parseYouTubeVideoUrl(url);
  return page
    ? { ...page, url, generation }
    : { kind: 'unsupported', url, videoId: null, generation };
};

/** Owns YouTube SPA URL observation without polling or page-owned state. */
export class BrowserYouTubePageController implements YouTubePageController {
  #snapshot: YouTubePageSnapshot;
  readonly #listeners = new Set<(snapshot: YouTubePageSnapshot) => void>();
  #unobserve: (() => void) | null = null;
  #started = false;
  #scheduled = false;

  public constructor(private readonly windowRef: Window = window) {
    this.#snapshot = readPage(this.windowRef.location.href, 0);
  }

  public get snapshot(): YouTubePageSnapshot {
    return this.#snapshot;
  }

  readonly #onPageSignal = () => this.#scheduleRefresh();

  public start(): void {
    if (this.#started) return;
    this.#started = true;
    this.windowRef.addEventListener('popstate', this.#onPageSignal);
    this.windowRef.document.addEventListener('yt-navigate-finish', this.#onPageSignal);
    this.windowRef.document.addEventListener(
      'yt-page-data-updated',
      this.#onPageSignal,
    );
    this.#unobserve = observeDocumentMutations(
      this.windowRef.document,
      this.#onPageSignal,
      true,
    );
    this.#refresh();
  }

  public subscribe(listener: (snapshot: YouTubePageSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    if (!this.#started) return;
    this.#started = false;
    this.windowRef.removeEventListener('popstate', this.#onPageSignal);
    this.windowRef.document.removeEventListener(
      'yt-navigate-finish',
      this.#onPageSignal,
    );
    this.windowRef.document.removeEventListener(
      'yt-page-data-updated',
      this.#onPageSignal,
    );
    this.#unobserve?.();
    this.#unobserve = null;
    this.#listeners.clear();
  }

  #scheduleRefresh(): void {
    if (!this.#started || this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#refresh();
    });
  }

  #refresh(): void {
    const next = readPage(this.windowRef.location.href, this.#snapshot.generation);
    const sameVideo =
      next.kind === this.#snapshot.kind && next.videoId === this.#snapshot.videoId;
    if (sameVideo && next.url === this.#snapshot.url) return;

    this.#snapshot = {
      ...next,
      generation: sameVideo ? this.#snapshot.generation : this.#snapshot.generation + 1,
    };
    for (const listener of this.#listeners) listener(this.#snapshot);
  }
}
