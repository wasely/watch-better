import { browser } from 'wxt/browser';

import type { TranscriptDocument } from '@/features/transcript/domain';

export type TranscriptCachePolicy = 'memory-only' | 'session';

interface CacheValue {
  readonly document: TranscriptDocument;
  readonly cachedAt: number;
}

const PREFIX = 'cutthrough:transcript-cache:';
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
    await browser.storage.session.set({ [key]: document });
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
