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

import { WatchBetterRuntime } from './WatchBetterRuntime';

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

const spanishTrack: TranscriptTrack = {
  id: 'es',
  languageCode: 'es',
  languageLabel: 'Español',
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

const spanishDocumentFor = (videoId: string): TranscriptDocument => ({
  ...documentFor(videoId),
  languageCode: spanishTrack.languageCode,
  languageLabel: spanishTrack.languageLabel,
  segments: [
    {
      id: `${videoId}-es-a`,
      startSeconds: 0,
      endSeconds: 2,
      text: `Primera evidencia para ${videoId}.`,
    },
  ],
});

describe('WatchBetterRuntime integration', () => {
  beforeEach(() => {
    for (const key of Object.keys(browserState.storage))
      delete browserState.storage[key];
    browserState.storage['watchbetter:settings:v2'] = DEFAULT_SETTINGS;
    browserState.sendMessage.mockReset();
    browserState.sendMessage.mockImplementation(
      (request: { type: string; changes?: object; provider?: string }) => {
        if (request.type === 'settings:update') {
          const settings = {
            ...(browserState.storage['watchbetter:settings:v2'] as object),
            ...request.changes,
          };
          browserState.storage['watchbetter:settings:v2'] = settings;
          return Promise.resolve({ ok: true, type: 'settings:updated', settings });
        }
        if (request.type === 'webchat:get-status') {
          return Promise.resolve({
            ok: true,
            type: 'webchat:status',
            provider: request.provider,
            state: 'ready',
          });
        }
        if (request.type === 'webchat:send') {
          return Promise.resolve({
            ok: true,
            type: 'webchat:response',
            provider: 'chatgpt',
            text: 'Ready for questions.',
            responseId: 'web_chatgpt_test',
          });
        }
        return Promise.resolve({ ok: true, type: 'acknowledged' });
      },
    );
  });

  it('loads data and sends only from the explicit transcript action', async () => {
    const pageController = new FakePageController();
    const playback = new FakePlayback();
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <WatchBetterRuntime
        pageController={pageController}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    await waitFor(() =>
      expect(browserState.sendMessage).toHaveBeenCalledWith({
        type: 'webchat:preload',
        provider: 'deepseek',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Seek to 0:08' }));
    expect(playback.snapshot.currentTimeSeconds).toBe(8);

    const sendCount = () =>
      browserState.sendMessage.mock.calls.filter(
        ([request]) => (request as { type?: string }).type === 'webchat:send',
      ).length;

    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(sendCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Gemini/ }));
    expect(sendCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /ChatGPT/ }));
    expect(sendCount()).toBe(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI' }));
    await waitFor(
      () =>
        expect(browserState.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'webchat:send',
            provider: 'chatgpt',
            newConversation: true,
          }),
        ),
      { timeout: 3_500 },
    );
    expect(JSON.stringify(browserState.sendMessage.mock.calls)).toContain(
      'TRANSCRIPT CONTEXT',
    );
    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTitle('ChatGPT embedded chat')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ask about this video')).not.toBeInTheDocument();

    expect(sendCount()).toBe(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() => expect(sendCount()).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Open ChatGPT in full tab' }));
    await waitFor(() =>
      expect(browserState.sendMessage).toHaveBeenCalledWith({
        type: 'webchat:open',
        provider: 'chatgpt',
      }),
    );
  });

  it('loads a Short transcript as a supported video surface', async () => {
    const pageController = new FakePageController();
    pageController.snapshot = {
      kind: 'shorts',
      url: 'https://www.youtube.com/shorts/short-one',
      videoId: 'short-one',
      generation: 1,
    };
    const listTracks = vi.fn(() => Promise.resolve([track]));
    const provider: TranscriptProvider = {
      listTracks,
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <WatchBetterRuntime
        pageController={pageController}
        playback={new FakePlayback()}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for short-one.');
    expect(listTracks).toHaveBeenCalledWith('short-one', expect.any(AbortSignal));
  });

  it('loads the transcript selected from the language panel', async () => {
    const pageController = new FakePageController();
    const playback = new FakePlayback();
    const load = vi.fn((request: { videoId: string; trackId?: string | null }) =>
      Promise.resolve(
        request.trackId === spanishTrack.id
          ? spanishDocumentFor(request.videoId)
          : documentFor(request.videoId),
      ),
    );
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track, spanishTrack])),
      load,
    };
    render(
      <WatchBetterRuntime
        pageController={pageController}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    const language = screen.getByRole('combobox', {
      name: 'Transcript language',
    });
    fireEvent.change(language, { target: { value: spanishTrack.id } });

    await screen.findByText('Primera evidencia para one.');
    expect(language).toHaveValue(spanishTrack.id);
    expect(load).toHaveBeenLastCalledWith(
      { videoId: 'one', trackId: spanishTrack.id },
      expect.any(AbortSignal),
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
      <WatchBetterRuntime
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
