import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
import { smartSkipAnalysisCacheKey } from '@/features/smart-skip/analysis';
import { buildInstantSmartSkipAnalysis } from '@/features/smart-skip/instant-analysis';
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
    localGet: vi.fn((key: string) => Promise.resolve({ [key]: storage[key] })),
    sessionGet: vi.fn((key: string) => Promise.resolve({ [key]: storage[key] })),
  };
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { sendMessage: browserState.sendMessage },
    storage: {
      local: {
        get: browserState.localGet,
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
        get: browserState.sessionGet,
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
    videoId: 'one',
  };
  readonly #listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  public seek(seconds: number): void {
    this.snapshot = { ...this.snapshot, currentTimeSeconds: seconds };
    for (const listener of this.#listeners) listener(this.snapshot);
  }
  public subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot);
    return () => this.#listeners.delete(listener);
  }
  public dispose(): void {}
  public emit(changes: Partial<PlaybackSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.#listeners) listener(this.snapshot);
  }
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
    browserState.storage['watchbetter:settings:v3'] = DEFAULT_SETTINGS;
    browserState.localGet.mockReset();
    browserState.localGet.mockImplementation((key: string) =>
      Promise.resolve({ [key]: browserState.storage[key] }),
    );
    browserState.sessionGet.mockReset();
    browserState.sessionGet.mockImplementation((key: string) =>
      Promise.resolve({ [key]: browserState.storage[key] }),
    );
    browserState.sendMessage.mockReset();
    browserState.sendMessage.mockImplementation(
      (request: { type: string; changes?: object; provider?: string }) => {
        if (request.type === 'settings:update') {
          const settings = {
            ...(browserState.storage['watchbetter:settings:v3'] as object),
            ...request.changes,
          };
          browserState.storage['watchbetter:settings:v3'] = settings;
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
            provider: request.provider ?? 'gemini',
            text: 'Ready for questions.',
            responseId: 'web_chat_test',
          });
        }
        return Promise.resolve({ ok: true, type: 'acknowledged' });
      },
    );
  });

  it('starts locally and crosses bounded dead air before any AI response', async () => {
    const playback = new FakePlayback();
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    act(() => playback.seek(2.1));
    await waitFor(() => expect(playback.snapshot.currentTimeSeconds).toBeCloseTo(7.92));
    expect(browserState.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'webchat:analyze' }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Smart Skip' }));
    expect(await screen.findByText(/Optional deep scan/i)).toBeVisible();
    const smartSkipPanel = screen.getByRole('tabpanel', { name: 'Smart Skip' });
    const savedMetric =
      within(smartSkipPanel).getByText('Saved this play').parentElement;
    expect(savedMetric).toHaveTextContent('6s');
    const smartSkipSwitch = screen.getByRole('switch');
    expect(smartSkipSwitch).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(smartSkipSwitch);
    await waitFor(() =>
      expect(smartSkipSwitch).toHaveAttribute('aria-checked', 'false'),
    );
    expect(savedMetric).toHaveTextContent('6s');
  });

  it('waits for cached action overrides before enabling playback', async () => {
    const playback = new FakePlayback();
    const transcript = documentFor('one');
    const instant = buildInstantSmartSkipAnalysis(
      transcript,
      track.id,
      DEFAULT_SETTINGS.smartSkip,
    );
    const cachedAnalysis = {
      ...instant,
      intervals: instant.intervals.map((interval) => ({
        ...interval,
        enabled: false,
      })),
    };
    const analysisKey = smartSkipAnalysisCacheKey(
      transcript,
      track.id,
      DEFAULT_SETTINGS.smartSkip,
    );
    let resolveCache!: (value: Record<string, unknown>) => void;
    browserState.sessionGet.mockImplementation(
      (key: string) =>
        new Promise((resolve) => {
          expect(key).toBe('watchbetter:smart-skip-cache:v1');
          resolveCache = resolve;
        }),
    );
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn(() => Promise.resolve(transcript)),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    await waitFor(() => expect(resolveCache).toBeTypeOf('function'));
    act(() => playback.seek(2.1));
    expect(playback.snapshot.currentTimeSeconds).toBe(2.1);

    await act(async () => {
      resolveCache({
        'watchbetter:smart-skip-cache:v1': {
          entries: [{ key: analysisKey, analysis: cachedAnalysis, accessedAt: 1 }],
        },
      });
      await Promise.resolve();
    });
    act(() => playback.seek(2.1));
    expect(playback.snapshot.currentTimeSeconds).toBe(2.1);
  });

  it('falls back to the instant map when a cache entry does not match its key', async () => {
    const playback = new FakePlayback();
    const transcript = documentFor('one');
    const cacheKey = smartSkipAnalysisCacheKey(
      transcript,
      track.id,
      DEFAULT_SETTINGS.smartSkip,
    );
    browserState.storage['watchbetter:smart-skip-cache:v1'] = {
      entries: [
        {
          key: cacheKey,
          analysis: {
            ...buildInstantSmartSkipAnalysis(
              documentFor('other-video'),
              track.id,
              DEFAULT_SETTINGS.smartSkip,
            ),
            videoId: 'other-video',
          },
          accessedAt: 1,
        },
      ],
    };
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn(() => Promise.resolve(transcript)),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    await waitFor(() => expect(browserState.sessionGet).toHaveBeenCalled());
    act(() => playback.seek(2.1));
    await waitFor(() => expect(playback.snapshot.currentTimeSeconds).toBeCloseTo(7.92));
  });

  it('keeps the nested seek target as the final active transcript row', async () => {
    const playback = new FakePlayback();
    const transcript = documentFor('one');
    const cachedAnalysis = {
      ...buildInstantSmartSkipAnalysis(
        transcript,
        track.id,
        DEFAULT_SETTINGS.smartSkip,
      ),
      intervals: [
        {
          id: 'nested-seek',
          startSegmentIndex: 0,
          endSegmentIndex: 0,
          startSeconds: 1,
          endSeconds: 8.5,
          category: 'sponsor' as const,
          reason: 'Bounded disposable section',
          confidence: 1,
          enabled: true,
          action: 'skip' as const,
          source: 'instant' as const,
        },
      ],
    };
    const cacheKey = smartSkipAnalysisCacheKey(
      transcript,
      track.id,
      DEFAULT_SETTINGS.smartSkip,
    );
    browserState.storage['watchbetter:smart-skip-cache:v1'] = {
      entries: [{ key: cacheKey, analysis: cachedAnalysis, accessedAt: 1 }],
    };
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn(() => Promise.resolve(transcript)),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    await waitFor(() => expect(browserState.sessionGet).toHaveBeenCalled());
    act(() => playback.seek(1.5));
    await waitFor(() => expect(playback.snapshot.currentTimeSeconds).toBe(8.5));
    expect(screen.getByRole('listitem', { current: true })).toHaveAttribute(
      'data-segment-id',
      'one-b',
    );
  });

  it('rejects a stale cached map after SPA video navigation', async () => {
    const pageController = new FakePageController();
    const playback = new FakePlayback();
    const firstTranscript = documentFor('one');
    const staleAnalysis = {
      ...buildInstantSmartSkipAnalysis(
        firstTranscript,
        track.id,
        DEFAULT_SETTINGS.smartSkip,
      ),
      intervals: [
        {
          id: 'one:stale-cut',
          startSegmentIndex: 1,
          endSegmentIndex: 1,
          startSeconds: 20,
          endSeconds: 30,
          category: 'sponsor' as const,
          reason: 'Stale action',
          confidence: 1,
          enabled: true,
          action: 'skip' as const,
          source: 'instant' as const,
        },
      ],
    };
    const staleKey = smartSkipAnalysisCacheKey(
      firstTranscript,
      track.id,
      DEFAULT_SETTINGS.smartSkip,
    );
    let resolveStaleCache!: (value: Record<string, unknown>) => void;
    let smartCacheReads = 0;
    browserState.sessionGet.mockImplementation((key: string) => {
      if (key !== 'watchbetter:smart-skip-cache:v1')
        return Promise.resolve({ [key]: browserState.storage[key] });
      smartCacheReads += 1;
      if (smartCacheReads > 1) return Promise.resolve({ [key]: undefined });
      return new Promise((resolve) => {
        resolveStaleCache = resolve;
      });
    });
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
    await waitFor(() => expect(resolveStaleCache).toBeTypeOf('function'));
    act(() => {
      pageController.emit('two');
      playback.emit({ videoId: 'two', currentTimeSeconds: 0 });
    });
    await screen.findByText('First evidence for two.');
    await waitFor(() => expect(smartCacheReads).toBe(2));

    await act(async () => {
      resolveStaleCache({
        'watchbetter:smart-skip-cache:v1': {
          entries: [{ key: staleKey, analysis: staleAnalysis, accessedAt: 1 }],
        },
      });
      await Promise.resolve();
    });
    act(() => playback.seek(21));
    expect(playback.snapshot.currentTimeSeconds).toBe(21);
    act(() => playback.seek(2.1));
    expect(playback.snapshot.currentTimeSeconds).toBeCloseTo(7.92);
  });

  it('keeps Smart Skip working when the extension background does not respond', async () => {
    browserState.sendMessage.mockResolvedValue(undefined);
    const playback = new FakePlayback();
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    act(() => playback.seek(2.1));
    await waitFor(() => expect(playback.snapshot.currentTimeSeconds).toBeCloseTo(7.92));
    fireEvent.click(screen.getByRole('tab', { name: 'Smart Skip' }));
    const smartSkipPanel = screen.getByRole('tabpanel', { name: 'Smart Skip' });
    expect(
      await within(smartSkipPanel).findByText(/Optional deep scan/i),
    ).toBeVisible();
    expect(browserState.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'webchat:analyze' }),
    );
    expect(screen.queryByText(/Cannot read properties of undefined/i)).toBeNull();
    expect(screen.queryByText(/did not accept the prompt/i)).toBeNull();
  });

  it('restarts a cancelled deep scan after Smart Skip is re-enabled', async () => {
    let analysisAttempts = 0;
    browserState.sendMessage.mockImplementation(
      (request: { type: string; changes?: object; provider?: string }) => {
        if (request.type === 'settings:update') {
          const settings = {
            ...(browserState.storage['watchbetter:settings:v3'] as object),
            ...request.changes,
          };
          browserState.storage['watchbetter:settings:v3'] = settings;
          return Promise.resolve({ ok: true, type: 'settings:updated', settings });
        }
        if (request.type === 'webchat:get-status')
          return Promise.resolve({
            ok: true,
            type: 'webchat:status',
            provider: request.provider,
            state: 'ready',
          });
        if (request.type === 'webchat:analyze') {
          analysisAttempts += 1;
          if (analysisAttempts === 1) return new Promise(() => undefined);
          return Promise.resolve({
            ok: true,
            type: 'webchat:analysis',
            provider: 'gemini',
            text: JSON.stringify({ cuts: [] }),
          });
        }
        return Promise.resolve({ ok: true, type: 'acknowledged' });
      },
    );
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={new FakePlayback()}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    fireEvent.click(screen.getByRole('tab', { name: 'Smart Skip' }));
    expect(analysisAttempts).toBe(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Start deep scan' }));
    await waitFor(() => expect(analysisAttempts).toBe(1));
    const smartSkipSwitch = screen.getByRole('switch');
    fireEvent.click(smartSkipSwitch);
    await waitFor(() =>
      expect(smartSkipSwitch).toHaveAttribute('aria-checked', 'false'),
    );
    fireEvent.click(smartSkipSwitch);
    await waitFor(() => expect(analysisAttempts).toBe(2));
  });

  it('requires a new deep-scan action after the analysis configuration changes', async () => {
    let analysisAttempts = 0;
    browserState.sendMessage.mockImplementation(
      (request: { type: string; changes?: object; provider?: string }) => {
        if (request.type === 'settings:update') {
          const settings = {
            ...(browserState.storage['watchbetter:settings:v3'] as object),
            ...request.changes,
          };
          browserState.storage['watchbetter:settings:v3'] = settings;
          return Promise.resolve({ ok: true, type: 'settings:updated', settings });
        }
        if (request.type === 'webchat:get-status')
          return Promise.resolve({
            ok: true,
            type: 'webchat:status',
            provider: request.provider,
            state: 'ready',
          });
        if (request.type === 'webchat:analyze') {
          analysisAttempts += 1;
          return Promise.resolve({
            ok: true,
            type: 'webchat:analysis',
            provider: request.provider,
            text: JSON.stringify({ cuts: [] }),
          });
        }
        return Promise.resolve({ ok: true, type: 'acknowledged' });
      },
    );
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn(() => Promise.resolve(documentFor('one'))),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={new FakePlayback()}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    fireEvent.click(screen.getByRole('tab', { name: 'Smart Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start deep scan' }));
    await waitFor(() => expect(analysisAttempts).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Maximum' }));
    expect(await screen.findByText('Optional deep scan')).toBeVisible();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(analysisAttempts).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Start deep scan' }));
    await waitFor(() => expect(analysisAttempts).toBe(2));
  });

  it('merges a semantic middle cut after instant playback is already active', async () => {
    let analysisAttempts = 0;
    browserState.sendMessage.mockImplementation(
      (request: { type: string; changes?: object; provider?: string }) => {
        if (request.type === 'webchat:get-status')
          return Promise.resolve({
            ok: true,
            type: 'webchat:status',
            provider: request.provider,
            state: 'ready',
          });
        if (request.type === 'webchat:analyze') {
          analysisAttempts += 1;
          if (analysisAttempts === 1)
            return Promise.resolve({
              ok: false,
              type: 'error',
              message: 'Temporary provider failure.',
            });
          return Promise.resolve({
            ok: true,
            type: 'webchat:analysis',
            provider: 'gemini',
            text: JSON.stringify({
              cuts: [
                {
                  start: 1,
                  end: 1,
                  category: 'ramble',
                  reason: 'Disposable middle tangent',
                  confidence: 0.96,
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, type: 'acknowledged' });
      },
    );
    const playback = new FakePlayback();
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <WatchBetterRuntime
        pageController={new FakePageController()}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    act(() => playback.seek(2.1));
    await waitFor(() => expect(playback.snapshot.currentTimeSeconds).toBeCloseTo(7.92));
    fireEvent.click(screen.getByRole('tab', { name: 'Smart Skip' }));
    expect(analysisAttempts).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Start deep scan' }));
    await waitFor(
      () =>
        expect(browserState.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'webchat:analyze' }),
        ),
      { timeout: 3_500 },
    );
    const panel = screen.getByRole('tabpanel', { name: 'Smart Skip' });
    await waitFor(() => expect(panel).toHaveTextContent('Disposable middle tangent'), {
      timeout: 3_500,
    });
    expect(analysisAttempts).toBe(2);
    expect(screen.getByText('1 deeper jump found')).toBeVisible();
    expect(screen.getByText('Middle')).toBeVisible();
  });

  it('submits video context after Ask opens while explicit send remains user-driven', async () => {
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
    expect(browserState.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'webchat:prime' }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() =>
      expect(browserState.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'webchat:prime',
          provider: 'gemini',
          newConversation: true,
        }),
      ),
    );
    expect(JSON.stringify(browserState.sendMessage.mock.calls)).toContain(
      'Reply only READY',
    );
    const sendCount = () =>
      browserState.sendMessage.mock.calls.filter(
        ([request]) => (request as { type?: string }).type === 'webchat:send',
      ).length;

    expect(sendCount()).toBe(0);
    await waitFor(() =>
      expect(browserState.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'webchat:focus',
          provider: 'gemini',
        }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Codex' }));
    expect(sendCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Google Gemini' }));
    expect(sendCount()).toBe(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to AI' }));
    await waitFor(
      () =>
        expect(browserState.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'webchat:send',
            provider: 'gemini',
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
    expect(screen.getByTitle('Gemini embedded chat')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ask about this video')).not.toBeInTheDocument();

    expect(sendCount()).toBe(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() => expect(sendCount()).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Open Gemini in full tab' }));
    await waitFor(() =>
      expect(browserState.sendMessage).toHaveBeenCalledWith({
        type: 'webchat:open',
        provider: 'gemini',
      }),
    );
  });

  it('still shows the panel when settings never load', async () => {
    // The panel stays hidden until settings resolve, so a permanently rejecting
    // storage read used to leave the sidebar invisible for the life of the tab.
    const get = browserState.localGet;
    get.mockRejectedValue(new Error('Extension context invalidated.'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const provider: TranscriptProvider = {
        listTracks: vi.fn(() => Promise.resolve([track])),
        load: vi.fn((request: { videoId: string }) =>
          Promise.resolve(documentFor(request.videoId)),
        ),
      };
      render(
        <WatchBetterRuntime
          pageController={new FakePageController()}
          playback={new FakePlayback()}
          transcriptProvider={provider}
        />,
      );

      await vi.advanceTimersByTimeAsync(5_000);
      await waitFor(() =>
        expect(
          screen.getByLabelText('YouTube Max video companion'),
        ).toBeInTheDocument(),
      );
      expect(get).toHaveBeenCalled();
      expect(
        warn.mock.calls.filter(([message]) =>
          String(message).startsWith('[watchbetter] could not read settings'),
        ).length,
      ).toBeGreaterThanOrEqual(3);
      expect(warn).toHaveBeenCalledWith(
        '[watchbetter] falling back to default settings',
      );
    } finally {
      vi.useRealTimers();
      warn.mockRestore();
    }
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

  it('detaches the current runtime with its exact video and provider', async () => {
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    const onDetach = vi.fn(() => Promise.resolve());
    render(
      <WatchBetterRuntime
        onDetach={onDetach}
        pageController={new FakePageController()}
        playback={new FakePlayback()}
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    fireEvent.click(screen.getByRole('button', { name: 'Google Gemini' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Detach YouTube Max for this video',
      }),
    );

    await waitFor(() =>
      expect(onDetach).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'one',
          videoKind: 'watch',
          videoTitle: 'Video one',
          provider: 'gemini',
        }),
      ),
    );
  });

  it('renders floating presentation without nested detach or collapse controls', async () => {
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    render(
      <WatchBetterRuntime
        initialTab="ask"
        initialWebChatProvider="gemini"
        pageController={new FakePageController()}
        playback={new FakePlayback()}
        presentation="floating"
        transcriptProvider={provider}
        videoTitle="Detached video"
      />,
    );

    await screen.findByText('First evidence for one.');
    expect(screen.queryByText('Detached video')).not.toBeInTheDocument();
    expect(screen.getByText('Video one')).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: 'Detach YouTube Max for this video',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Collapse YouTube Max' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Google Gemini' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('forwards floating-card window controls', async () => {
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    const onMinimizedChange = vi.fn();
    const onToggleMaximized = vi.fn();
    const onClose = vi.fn();
    render(
      <WatchBetterRuntime
        onClose={onClose}
        onMinimizedChange={onMinimizedChange}
        onToggleMaximized={onToggleMaximized}
        pageController={new FakePageController()}
        playback={new FakePlayback()}
        presentation="floating"
        transcriptProvider={provider}
      />,
    );

    await screen.findByText('First evidence for one.');
    fireEvent.click(
      screen.getByRole('button', { name: 'Minimize detached YouTube Max' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Maximize or restore detached YouTube Max',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close detached YouTube Max' }));

    expect(onMinimizedChange).toHaveBeenCalledWith(true);
    expect(onToggleMaximized).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preserves the exact mounted provider frame when the runtime becomes floating', async () => {
    const provider: TranscriptProvider = {
      listTracks: vi.fn(() => Promise.resolve([track])),
      load: vi.fn((request: { videoId: string }) =>
        Promise.resolve(documentFor(request.videoId)),
      ),
    };
    const pageController = new FakePageController();
    const playback = new FakePlayback();
    const view = render(
      <WatchBetterRuntime
        initialTab="ask"
        onDetach={() => undefined}
        pageController={pageController}
        playback={playback}
        transcriptProvider={provider}
      />,
    );

    const originalFrame = await screen.findByTitle('Gemini embedded chat');
    view.rerender(
      <WatchBetterRuntime
        initialTab="ask"
        pageController={pageController}
        playback={playback}
        presentation="floating"
        transcriptProvider={provider}
        videoTitle="Video one"
      />,
    );

    expect(screen.getByTitle('Gemini embedded chat')).toBe(originalFrame);
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
