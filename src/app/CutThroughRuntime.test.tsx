import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';
import type {
  YouTubePageController,
  YouTubePageSnapshot,
} from '@/adapters/youtube/youtube-page-controller';
import { DEFAULT_SETTINGS } from '@/features/settings/settings';
import type {
  TranscriptDocument,
  TranscriptProvider,
  TranscriptTrack,
} from '@/features/transcript/domain';

const browserState = vi.hoisted(() => {
  const storage: Record<string, unknown> = {};
  const listeners = new Set<
    (changes: Record<string, { newValue?: unknown }>, areaName: string) => void
  >();
  return {
    storage,
    listeners,
    sendMessage: vi.fn(),
  };
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { sendMessage: browserState.sendMessage },
    storage: {
      local: {
        get: vi.fn((key: string) =>
          Promise.resolve({ [key]: browserState.storage[key] }),
        ),
        set: vi.fn((values: Record<string, unknown>) => {
          Object.assign(browserState.storage, values);
          return Promise.resolve();
        }),
        remove: vi.fn((key: string) => {
          delete browserState.storage[key];
          return Promise.resolve();
        }),
      },
      session: {
        get: vi.fn((key: string) =>
          Promise.resolve({ [key]: browserState.storage[key] }),
        ),
        set: vi.fn((values: Record<string, unknown>) => {
          Object.assign(browserState.storage, values);
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: (
          listener: typeof browserState.listeners extends Set<infer T> ? T : never,
        ) => browserState.listeners.add(listener),
        removeListener: (
          listener: typeof browserState.listeners extends Set<infer T> ? T : never,
        ) => browserState.listeners.delete(listener),
      },
    },
  },
}));

import { CutThroughRuntime } from './CutThroughRuntime';

class FakePageController implements YouTubePageController {
  public snapshot: YouTubePageSnapshot = {
    kind: 'watch',
    url: 'https://www.youtube.com/watch?v=one',
    videoId: 'one',
    generation: 1,
  };
  readonly #listeners = new Set<(snapshot: YouTubePageSnapshot) => void>();
  public start(): void {}
  public subscribe(listener: (snapshot: YouTubePageSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot);
    return () => this.#listeners.delete(listener);
  }
  public dispose(): void {}
  public emit(videoId: string): void {
    this.snapshot = {
      kind: 'watch',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      generation: this.snapshot.generation + 1,
    };
    for (const listener of this.#listeners) listener(this.snapshot);
  }
}

class FakePlayback implements PlaybackController {
  public snapshot: PlaybackSnapshot = {
    currentTimeSeconds: 0,
    durationSeconds: 60,
    playbackRate: 1,
    paused: false,
    adActive: false,
    supported: true,
  };
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  public seek(seconds: number): void {
    this.snapshot = { ...this.snapshot, currentTimeSeconds: seconds };
    for (const listener of this.#listeners) listener(this.snapshot);
  }
  public setPlaybackRate(playbackRate: number): void {
    this.snapshot = { ...this.snapshot, playbackRate };
    for (const listener of this.#listeners) listener(this.snapshot);
  }
  public subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot);
    return () => this.#listeners.delete(listener);
  }
  public dispose(): void {}
}

const track: TranscriptTrack = {
  id: 'en',
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: false,
};

const documentFor = (videoId: string): TranscriptDocument => ({
  videoId,
  videoTitle: `Video ${videoId}`,
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: false,
  durationSeconds: 60,
  segments: [
    {
      id: `${videoId}-a`,
      startSeconds: 0,
      endSeconds: 2,
      text: `First evidence for ${videoId}.`,
    },
    { id: `${videoId}-b`, startSeconds: 8, endSeconds: 10, text: 'Second idea.' },
  ],
});

describe('CutThroughRuntime integration', () => {
  beforeEach(() => {
    for (const key of Object.keys(browserState.storage))
      delete browserState.storage[key];
    browserState.storage['cutthrough:settings'] = DEFAULT_SETTINGS;
    browserState.sendMessage.mockReset();
    browserState.sendMessage.mockImplementation(
      (request: { type: string; changes?: object }) => {
        if (request.type === 'settings:update') {
          const settings = {
            ...(browserState.storage['cutthrough:settings'] as object),
            ...request.changes,
          };
          browserState.storage['cutthrough:settings'] = settings;
          return Promise.resolve({ ok: true, type: 'settings:updated', settings });
        }
        return Promise.resolve({ ok: true, type: 'acknowledged' });
      },
    );
  });

  it('loads real provider data, seeks playback, and opens explicit handoff', async () => {
    const pageController = new FakePageController();
    const playback = new FakePlayback();
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <CutThroughRuntime
        pageController={pageController}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    fireEvent.click(screen.getByRole('button', { name: 'Seek to 0:08' }));
    expect(playback.snapshot.currentTimeSeconds).toBe(8);

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    fireEvent.click(screen.getByRole('button', { name: 'Summarize this video' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open ChatGPT' }));
    await waitFor(() =>
      expect(browserState.sendMessage).toHaveBeenCalledWith({ type: 'chatgpt:open' }),
    );
  });

  it('ignores a stale transcript result after SPA navigation', async () => {
    const pageController = new FakePageController();
    const playback = new FakePlayback();
    let resolveFirst: ((document: TranscriptDocument) => void) | undefined;
    const load = vi.fn((request: { videoId: string }) =>
      request.videoId === 'one'
        ? new Promise<TranscriptDocument>((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve(documentFor(request.videoId)),
    );
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load,
    };
    render(
      <CutThroughRuntime
        pageController={pageController}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await waitFor(() => expect(load).toHaveBeenCalled());
    pageController.emit('two');
    await screen.findByText('First evidence for two.');
    resolveFirst?.(documentFor('one'));
    await Promise.resolve();
    expect(screen.queryByText('First evidence for one.')).not.toBeInTheDocument();
    expect(screen.getByText('First evidence for two.')).toBeInTheDocument();
  });
});
