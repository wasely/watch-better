import { browser } from 'wxt/browser';

import type { TranscriptDocument } from '@/features/transcript/domain';

export type TranscriptCachePolicy = 'memory-only' | 'session';

interface CacheValue {
  readonly document: TranscriptDocument;
  readonly cachedAt: number;
}

const PREFIX = 'watchbetter:transcript-cache:';
const INDEX_KEY = 'watchbetter:transcript-cache-lru:v1';
const MAX_ENTRIES = 3;
const MAX_SERIALIZED_CHARACTERS = 2_000_000;

const keyFor = (videoId: string, trackId: string): string =>
  `${PREFIX}${encodeURIComponent(videoId)}:${trackId}`;

const isDocument = (value: unknown): value is TranscriptDocument => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TranscriptDocument>;
  return (
    typeof candidate.videoId === 'string' &&
    typeof candidate.videoTitle === 'string' &&
    typeof candidate.languageCode === 'string' &&
    Array.isArray(candidate.segments)
  );
};

/** Small, bounded cache. Memory is default; session storage is explicit opt-in. */
export class TranscriptCache {
  readonly #memory = new Map<string, CacheValue>();
  #sessionQueue = Promise.resolve();

  public async get(
    videoId: string,
    trackId: string,
    policy: TranscriptCachePolicy,
  ): Promise<TranscriptDocument | null> {
    const key = keyFor(videoId, trackId);
    const memory = this.#memory.get(key);
    if (memory) return memory.document;
    if (policy !== 'session') return null;

    const stored = await browser.storage.session.get(key);
    const value = stored[key];
    if (!isDocument(value)) return null;
    this.#remember(key, value);
    return value;
  }

  public async set(
    videoId: string,
    trackId: string,
    document: TranscriptDocument,
    policy: TranscriptCachePolicy,
  ): Promise<void> {
    const key = keyFor(videoId, trackId);
    this.#remember(key, document);
    if (policy !== 'session') return;
    if (JSON.stringify(document).length > MAX_SERIALIZED_CHARACTERS) return;
    const task = this.#sessionQueue
      .catch(() => undefined)
      .then(() => this.#storeSession(key, document));
    this.#sessionQueue = task;
    await task;
  }

  async #storeSession(key: string, document: TranscriptDocument): Promise<void> {
    const stored = await browser.storage.session.get(INDEX_KEY);
    const current = Array.isArray(stored[INDEX_KEY])
      ? stored[INDEX_KEY].filter(
          (candidate): candidate is string =>
            typeof candidate === 'string' && candidate.startsWith(PREFIX),
        )
      : [];
    const keys = [...current.filter((candidate) => candidate !== key), key];
    const evicted = keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES));
    const retained = keys.slice(-MAX_ENTRIES);
    if (evicted.length > 0) await browser.storage.session.remove(evicted);
    await browser.storage.session.set({ [key]: document, [INDEX_KEY]: retained });
  }

  public clearMemory(): void {
    this.#memory.clear();
  }

  #remember(key: string, document: TranscriptDocument): void {
    this.#memory.delete(key);
    this.#memory.set(key, { document, cachedAt: Date.now() });
    while (this.#memory.size > MAX_ENTRIES) {
      const oldest = this.#memory.keys().next().value;
      if (!oldest) break;
      this.#memory.delete(oldest);
    }
  }
}
