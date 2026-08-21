import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';
import type { ChatTurnRequest, ChatTurnResult } from '@/features/ask/AskPanel';
import type {
  YouTubePageController,
  YouTubePageSnapshot,
} from '@/adapters/youtube/youtube-page-controller';
import { resolveInitialProductTab } from '@/config/product-features';
import type { DetachedVideoContext } from '@/features/detach/detached-video';
import type {
  TranscriptDocument,
  TranscriptProvider,
  TranscriptSegment,
  TranscriptSegmentId,
} from '@/features/transcript/domain';
import { TranscriptProviderError } from '@/features/transcript/domain';
import type { TranscriptViewState } from '@/features/transcript/transcript-view-state';
import { findActiveSegmentIndex } from '@/features/transcript/transcript-utils';
import {
  DEFAULT_SETTINGS,
  type WatchBetterSettings,
  type PanelTab,
} from '@/features/settings/settings';
import {
  buildSmartSkipAnalysisChunks,
  mergeSmartSkipAnalyses,
  normalizeSmartSkipIntervals,
  parseSmartSkipAnalysisResponse,
  smartSkipAnalysisCacheKey,
} from '@/features/smart-skip/analysis';
import type {
  SmartSkipAnalysis,
  SmartSkipAnalysisState,
  SmartSkipRefinementState,
} from '@/features/smart-skip/domain';
import { SmartSkipCache } from '@/features/smart-skip/smart-skip-cache';
import {
  buildInstantSmartSkipAnalysis,
  createInstantOpeningInterval,
} from '@/features/smart-skip/instant-analysis';
import {
  SmartSkipEngine,
  type SmartSkipEngineSnapshot,
} from '@/features/smart-skip/smart-skip-engine';
import { SmartSkipRefinementFrame } from '@/features/smart-skip/SmartSkipRefinementFrame';
import type { ExtensionRequest, ExtensionResponse } from '@/messaging/messages';
import {
  SettingsRepository,
  SETTINGS_STORAGE_KEY,
} from '@/storage/settings-repository';
import { TranscriptCache } from '@/storage/transcript-cache';
import {
  type WebChatConnectionState,
  type WebChatProviderId,
  type WebChatProviderStatus,
} from '@/services/web-chat';

import { WatchBetterApp, type ResolvedTheme } from './WatchBetterApp';

const EMPTY_PLAYBACK: PlaybackSnapshot = {
  currentTimeSeconds: 0,
  durationSeconds: null,
  playbackRate: 1,
  paused: true,
  adActive: false,
  supported: false,
};

const MAX_SETTINGS_LOAD_ATTEMPTS = 3;
const WEB_CHAT_PROVIDER_IDS: readonly WebChatProviderId[] = ['gemini', 'chatgpt'];
/** Fast while a frame is still coming up; polling stops entirely once every frame is ready. */
const PROVIDER_STATUS_POLL_MS = 400;
const MAX_PROVIDER_STATUS_POLL_MS = 3_200;
const EMPTY_SEGMENTS: readonly TranscriptSegment[] = [];
/**
 * Ask only needs a rough "where are we" for its current-section prompt. Coarse buckets
 * keep four playback ticks a second from re-rendering the panel.
 */
const ASK_TIME_BUCKET_SECONDS = 5;

/**
 * Chrome tears down a content script's extension APIs when the extension reloads while
 * the tab stays open. Nothing recovers except reloading the tab, so say so plainly.
 */
const isExtensionContextLost = (error: unknown): boolean =>
  error instanceof Error &&
  /extension context invalidated|extension context was invalidated/i.test(
    error.message,
  );

const CONTEXT_LOST_MESSAGE =
  'Watch Better was reloaded. Refresh this tab to reconnect the panel.';

const send = async (request: ExtensionRequest): Promise<ExtensionResponse> => {
  const response: unknown = await browser.runtime.sendMessage(request);
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    typeof response.ok === 'boolean'
  )
    return response as ExtensionResponse;
  return {
    ok: false,
    type: 'error',
    message:
      'Watch Better background did not respond. Reload the extension and refresh YouTube.',
  };
};

export interface WatchBetterRuntimeControls {
  restore(): Promise<void>;
  isMounted(): boolean;
}

export interface WatchBetterRuntimeProps {
  readonly pageController: YouTubePageController;
  readonly playback: PlaybackController;
  readonly transcriptProvider: TranscriptProvider;
  readonly theaterMode?: boolean;
  readonly onControls?: (controls: WatchBetterRuntimeControls | null) => void;
  readonly onVisibilityChange?: (visible: boolean) => void;
  readonly onAskFocusChange?: (focused: boolean) => void;
  readonly presentation?: 'panel' | 'floating';
  readonly initialTab?: PanelTab;
  readonly initialWebChatProvider?: WebChatProviderId;
  readonly videoTitle?: string;
  readonly onDetach?: (context: DetachedVideoContext) => void | Promise<void>;
  readonly onClose?: () => void;
  readonly minimized?: boolean;
  readonly onMinimizedChange?: (minimized: boolean) => void;
  readonly onToggleMaximized?: () => void;
}

const errorState = (error: unknown): TranscriptViewState => {
  if (error instanceof TranscriptProviderError) {
    if (error.code === 'disabled') return { kind: 'disabled' };
    if (error.code === 'unavailable') return { kind: 'unavailable' };
    return { kind: 'error', message: error.message };
  }
  return {
    kind: 'error',
    message: error instanceof Error ? error.message : 'Transcript extraction failed.',
  };
};

export function WatchBetterRuntime({
  pageController,
  playback,
  transcriptProvider,
  theaterMode = false,
  onControls,
  onVisibilityChange,
  onAskFocusChange,
  presentation = 'panel',
  initialTab,
  initialWebChatProvider = 'gemini',
  videoTitle,
  onDetach,
  onClose,
  minimized = false,
  onMinimizedChange,
  onToggleMaximized,
}: WatchBetterRuntimeProps) {
  const repository = useMemo(() => new SettingsRepository(), []);
  const cache = useMemo(() => new TranscriptCache(), []);
  const smartSkipCache = useMemo(() => new SmartSkipCache(), []);
  const smartSkipEngine = useMemo(() => new SmartSkipEngine(playback), [playback]);
  const [settings, setSettings] = useState<WatchBetterSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [page, setPage] = useState<YouTubePageSnapshot>(pageController.snapshot);
  const [activeSegmentId, setActiveSegmentId] = useState<TranscriptSegmentId | null>(
    null,
  );
  const [askTimeSeconds, setAskTimeSeconds] = useState(0);
  const playbackTimeRef = useRef(
    (playback.snapshot ?? EMPTY_PLAYBACK).currentTimeSeconds,
  );
  const segmentsRef = useRef<readonly TranscriptSegment[]>(EMPTY_SEGMENTS);
  const [transcript, setTranscript] = useState<TranscriptViewState>({
    kind: 'loading',
  });
  const [activeTab, setActiveTab] = useState<PanelTab>(() =>
    resolveInitialProductTab(initialTab ?? DEFAULT_SETTINGS.defaultTab),
  );
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<
    ReadonlySet<TranscriptSegmentId>
  >(new Set());
  const [providerStatuses, setProviderStatuses] = useState<
    Partial<Record<WebChatProviderId, WebChatProviderStatus>>
  >({});
  const [sendRequestId, setSendRequestId] = useState(0);
  const [selectedWebChatProvider, setSelectedWebChatProvider] =
    useState<WebChatProviderId>(initialWebChatProvider);
  const [providerSessionIds, setProviderSessionIds] = useState<
    Partial<Record<WebChatProviderId, string>>
  >({});
  const [smartSkipAnalysisState, setSmartSkipAnalysisState] =
    useState<SmartSkipAnalysisState>({ kind: 'idle' });
  const smartSkipAnalysisStateRef = useRef<SmartSkipAnalysisState>({ kind: 'idle' });
  const [smartSkipRefinementState, setSmartSkipRefinementState] =
    useState<SmartSkipRefinementState>({ kind: 'idle' });
  const [smartSkipRefinementSession, setSmartSkipRefinementSession] = useState<{
    readonly provider: WebChatProviderId;
    readonly sessionId: string;
  } | null>(null);
  const [smartSkipRefinementProviderState, setSmartSkipRefinementProviderState] =
    useState<WebChatConnectionState>('not-open');
  const [smartSkipRefinementFrameEnabled, setSmartSkipRefinementFrameEnabled] =
    useState(false);
  const [smartSkipRefinementRetryToken, setSmartSkipRefinementRetryToken] = useState(0);
  const [smartSkipEngineSnapshot, setSmartSkipEngineSnapshot] =
    useState<SmartSkipEngineSnapshot>(smartSkipEngine.snapshot);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);
  const pageRef = useRef(page);
  const smartSkipGenerationRef = useRef(0);
  const smartSkipRefinementRunKeyRef = useRef<string | null>(null);
  const smartSkipRefinementFailureCountRef = useRef(0);
  const resolveDefaultTab = useCallback(
    (defaultTab: PanelTab) => resolveInitialProductTab(initialTab ?? defaultTab),
    [initialTab],
  );

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    smartSkipAnalysisStateRef.current = smartSkipAnalysisState;
  }, [smartSkipAnalysisState]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    smartSkipEngine.start();
    const unsubscribe = smartSkipEngine.subscribe(setSmartSkipEngineSnapshot);
    return () => {
      unsubscribe();
      smartSkipEngine.stop();
    };
  }, [smartSkipEngine]);

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const unsubscribe = pageController.subscribe((next) => {
      const changedVideo =
        next.videoId !== pageRef.current.videoId || next.kind !== pageRef.current.kind;
      pageRef.current = next;
      setPage(next);
      if (changedVideo) {
        setSelectedSegmentIds(new Set());
        smartSkipGenerationRef.current += 1;
        smartSkipRefinementRunKeyRef.current = null;
        setSmartSkipAnalysisState({ kind: 'idle' });
        setSmartSkipRefinementState({ kind: 'idle' });
        smartSkipEngine.setEnabled(false);
        const opening = next.videoId
          ? createInstantOpeningInterval(
              next.videoId,
              playback.snapshot.durationSeconds,
              settingsRef.current.smartSkip,
            )
          : null;
        smartSkipEngine.setIntervals(opening ? [opening] : []);
        if (opening && settingsRef.current.smartSkip.autoSkip)
          smartSkipEngine.setEnabled(true);
        setActiveTab(resolveDefaultTab(settingsRef.current.defaultTab));
      }
    });
    pageController.start();
    return () => {
      unsubscribe();
      pageController.dispose();
    };
  }, [pageController, playback, resolveDefaultTab, smartSkipEngine]);

  /**
   * Playback ticks four times a second. Keeping the raw snapshot in state re-rendered
   * the whole panel that often, so only the values the UI actually reads become state,
   * and both of those settle for seconds at a time.
   */
  const applyPlaybackTime = useCallback((currentTimeSeconds: number) => {
    playbackTimeRef.current = currentTimeSeconds;
    const segments = segmentsRef.current;
    const index = findActiveSegmentIndex(segments, currentTimeSeconds);
    setActiveSegmentId(index < 0 ? null : (segments[index]?.id ?? null));
    setAskTimeSeconds((current) =>
      Math.abs(currentTimeSeconds - current) >= ASK_TIME_BUCKET_SECONDS
        ? Math.floor(currentTimeSeconds)
        : current,
    );
  }, []);

  useEffect(
    () =>
      playback.subscribe((snapshot: PlaybackSnapshot) =>
        applyPlaybackTime(snapshot.currentTimeSeconds),
      ),
    [applyPlaybackTime, playback],
  );

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retryTimer: number | null = null;

    /**
     * The panel stays hidden until settings resolve, so a rejected load used to hide it
     * for the life of the tab. Retry transient failures, then fall back to defaults so
     * the panel always appears.
     */
    const sync = () => {
      void repository
        .load()
        .then((next) => {
          if (disposed) return;
          attempt = 0;
          setSettings(next);
          setActiveTab(resolveDefaultTab(next.defaultTab));
          setSettingsLoaded(true);
        })
        .catch((error: unknown) => {
          if (disposed) return;
          attempt += 1;
          console.warn(
            `[watchbetter] could not read settings (attempt ${attempt})`,
            error,
          );
          if (attempt <= MAX_SETTINGS_LOAD_ATTEMPTS) {
            retryTimer = window.setTimeout(sync, attempt * 400);
            return;
          }
          console.warn('[watchbetter] falling back to default settings');
          setSettings(DEFAULT_SETTINGS);
          setActiveTab(resolveDefaultTab(DEFAULT_SETTINGS.defaultTab));
          setSettingsLoaded(true);
        });
    };
    const onStorageChange = (
      changes: Record<string, { readonly newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName === 'local' && SETTINGS_STORAGE_KEY in changes) sync();
    };
    browser.storage.onChanged.addListener(onStorageChange);
    sync();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      browser.storage.onChanged.removeListener(onStorageChange);
    };
  }, [repository, resolveDefaultTab]);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    let running = false;
    let attempt = 0;

    const publish = (provider: WebChatProviderId, state: WebChatConnectionState) => {
      setProviderStatuses((current) =>
        current[provider]?.state === state
          ? current
          : { ...current, [provider]: { provider, state } },
      );
    };

    /** Resolves true once this provider's frame is answering. */
    const check = async (provider: WebChatProviderId): Promise<boolean> => {
      const sessionId = providerSessionIds[provider];
      if (!sessionId) {
        publish(provider, 'loading');
        return false;
      }
      try {
        const response = await send({
          type: 'webchat:get-status',
          provider,
          sessionId,
        });
        if (disposed) return true;
        if (!response.ok || response.type !== 'webchat:status') return false;
        publish(provider, response.state);
        return response.state === 'ready';
      } catch (error: unknown) {
        if (!disposed && isExtensionContextLost(error)) setContextLost(true);
        return disposed;
      }
    };

    /**
     * Poll hard while a frame is still coming up so Ask unlocks the moment it can send,
     * then stop: a ready frame only changes on a reload, which focus already catches.
     * A frame that stays unreachable (signed out, still loading) backs off instead.
     */
    const poll = async () => {
      if (disposed || running) return;
      const mountedProviders = WEB_CHAT_PROVIDER_IDS.filter(
        (provider) => providerSessionIds[provider],
      );
      if (mountedProviders.length === 0) return;
      running = true;
      const ready = await Promise.all(mountedProviders.map(check));
      running = false;
      if (disposed || ready.every(Boolean)) return;
      const delay = Math.min(
        MAX_PROVIDER_STATUS_POLL_MS,
        PROVIDER_STATUS_POLL_MS * 2 ** attempt,
      );
      attempt += 1;
      timer = window.setTimeout(() => void poll(), delay);
    };

    const restart = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      attempt = 0;
      void poll();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) restart();
    };
    window.addEventListener('focus', restart);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void poll();
    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('focus', restart);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [providerSessionIds]);

  const patchSettings = useCallback(async (changes: Partial<WatchBetterSettings>) => {
    setSettings((current) => ({ ...current, ...changes }));
    const response = await send({ type: 'settings:update', changes });
    if (!response.ok) throw new Error(response.message);
    if (response.type !== 'settings:updated')
      throw new Error('Unexpected settings response.');
    setSettings(response.settings);
  }, []);

  const primeAskWebChat = useCallback(async (request: ChatTurnRequest) => {
    const response = await send({ type: 'webchat:prime', ...request });
    if (!response.ok) throw new Error(response.message);
    if (response.type !== 'acknowledged')
      throw new Error('Unexpected context preload response.');
  }, []);

  const focusAskWebChat = useCallback(
    async (provider: WebChatProviderId, sessionId: string) => {
      const response = await send({
        type: 'webchat:focus',
        provider,
        sessionId,
      });
      if (!response.ok) throw new Error(response.message);
    },
    [],
  );

  const sendAskWebChat = useCallback(
    async (request: ChatTurnRequest): Promise<ChatTurnResult> => {
      const response = await send({ type: 'webchat:send', ...request });
      if (!response.ok) throw new Error(response.message);
      if (response.type !== 'webchat:response')
        throw new Error('Unexpected AI response.');
      return {
        text: response.text,
        responseId: response.responseId,
        provider: response.provider,
      };
    },
    [],
  );

  const openAskWebChat = useCallback(async (provider: WebChatProviderId) => {
    const response = await send({ type: 'webchat:open', provider });
    if (!response.ok) throw new Error(response.message);
  }, []);

  const prepareAskWebChat = useCallback(
    async (provider: WebChatProviderId, sessionId: string) => {
      setProviderStatuses((current) => ({
        ...current,
        [provider]: { provider, state: 'loading' },
      }));
      const response = await send({
        type: 'webchat:frame-prepare',
        provider,
        sessionId,
      });
      if (!response.ok) throw new Error(response.message);
    },
    [],
  );

  const resetAskWebChat = useCallback(
    async (provider: WebChatProviderId, sessionId: string) => {
      const response = await send({
        type: 'webchat:frame-reset',
        provider,
        sessionId,
      });
      if (!response.ok) throw new Error(response.message);
    },
    [],
  );

  const registerAskProviderSession = useCallback(
    (provider: WebChatProviderId, sessionId: string) => {
      setProviderSessionIds((current) =>
        current[provider] === sessionId
          ? current
          : { ...current, [provider]: sessionId },
      );
    },
    [],
  );

  const loadTranscript = useCallback(
    async (videoId: string, requestedTrackId: string | null = null) => {
      loadAbortRef.current?.abort();
      const abortController = new AbortController();
      loadAbortRef.current = abortController;
      const generation = ++loadGenerationRef.current;
      setTranscript({ kind: 'loading' });

      try {
        const tracks = await transcriptProvider.listTracks(
          videoId,
          abortController.signal,
        );
        const selectedTrack =
          tracks.find((track) => track.id === requestedTrackId) ?? tracks[0];
        if (!selectedTrack)
          throw new TranscriptProviderError(
            'unavailable',
            'This video has no available caption tracks.',
          );
        const cached = await cache.get(
          videoId,
          selectedTrack.id,
          settingsRef.current.transcriptCachePolicy,
        );
        const document =
          cached ??
          (await transcriptProvider.load(
            { videoId, trackId: selectedTrack.id },
            abortController.signal,
          ));
        if (!cached)
          await cache.set(
            videoId,
            selectedTrack.id,
            document,
            settingsRef.current.transcriptCachePolicy,
          );
        if (abortController.signal.aborted || generation !== loadGenerationRef.current)
          return;
        setTranscript({
          kind: 'ready',
          document,
          tracks,
          selectedTrackId: selectedTrack.id,
        });
      } catch (error) {
        if (abortController.signal.aborted || generation !== loadGenerationRef.current)
          return;
        setTranscript(errorState(error));
      }
    },
    [cache, transcriptProvider],
  );

  useEffect(() => {
    if (!settingsLoaded || page.kind === 'unsupported' || !page.videoId) return;
    const videoId = page.videoId;
    if (!settings.extensionEnabled) return;
    if (!settings.autoLoadTranscript) {
      loadAbortRef.current?.abort();
      queueMicrotask(() => setTranscript({ kind: 'disabled' }));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadTranscript(videoId);
    });
    return () => {
      cancelled = true;
      loadAbortRef.current?.abort();
    };
  }, [
    loadTranscript,
    page.generation,
    page.kind,
    page.videoId,
    settings.autoLoadTranscript,
    settings.extensionEnabled,
    settingsLoaded,
  ]);

  const transcriptDocument: TranscriptDocument | null =
    transcript.kind === 'ready' ? transcript.document : null;
  const resolvedVideoTitle =
    (
      transcriptDocument?.videoTitle ??
      videoTitle ??
      document.title.replace(/\s*-\s*YouTube$/, '')
    )
      .replace(/[\r\n]+/g, ' ')
      .replaceAll(String.fromCharCode(0), ' ')
      .trim()
      .slice(0, 300) || `YouTube video ${page.videoId ?? ''}`.trim();

  useEffect(() => {
    segmentsRef.current = transcriptDocument?.segments ?? EMPTY_SEGMENTS;
    applyPlaybackTime(playbackTimeRef.current);
  }, [applyPlaybackTime, transcriptDocument]);

  const selectedTranscriptTrackId =
    transcript.kind === 'ready' ? transcript.selectedTrackId : null;

  useEffect(() => {
    if (
      smartSkipRefinementFrameEnabled ||
      !transcriptDocument ||
      !selectedTranscriptTrackId ||
      !settings.smartSkip.autoSkip
    )
      return;
    let disposed = false;
    const enable = () => {
      if (!disposed) setSmartSkipRefinementFrameEnabled(true);
    };
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(enable, { timeout: 1_500 });
      return () => {
        disposed = true;
        window.cancelIdleCallback(idleId);
      };
    }
    const timer = window.setTimeout(enable, 500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [
    selectedTranscriptTrackId,
    settings.smartSkip.autoSkip,
    smartSkipRefinementFrameEnabled,
    transcriptDocument,
  ]);

  const registerSmartSkipRefinementSession = useCallback(
    (provider: WebChatProviderId, sessionId: string) => {
      setSmartSkipRefinementSession((current) =>
        current?.provider === provider && current.sessionId === sessionId
          ? current
          : { provider, sessionId },
      );
    },
    [],
  );

  const prepareSmartSkipRefinement = useCallback(
    async (provider: WebChatProviderId, sessionId: string) => {
      setSmartSkipRefinementProviderState('loading');
      setSmartSkipRefinementState({ kind: 'connecting' });
      try {
        const response = await send({
          type: 'webchat:frame-prepare',
          provider,
          sessionId,
        });
        if (!response.ok) throw new Error(response.message);
      } catch (error: unknown) {
        setSmartSkipRefinementState({
          kind: 'unavailable',
          message: 'Deep scan reconnecting; strict local cuts remain active.',
        });
        throw error;
      }
    },
    [],
  );

  const resetSmartSkipRefinement = useCallback(
    async (provider: WebChatProviderId, sessionId: string) => {
      const response = await send({
        type: 'webchat:frame-reset',
        provider,
        sessionId,
      });
      if (!response.ok) throw new Error(response.message);
    },
    [],
  );

  useEffect(() => {
    if (!smartSkipRefinementSession) return;
    let disposed = false;
    let timer: number | null = null;
    let attempt = 0;

    const poll = async () => {
      if (disposed) return;
      try {
        const response = await send({
          type: 'webchat:get-status',
          provider: smartSkipRefinementSession.provider,
          sessionId: smartSkipRefinementSession.sessionId,
        });
        if (disposed) return;
        if (response.ok && response.type === 'webchat:status') {
          setSmartSkipRefinementProviderState(response.state);
          if (response.state === 'ready') return;
          if (response.state === 'sign-in-required') {
            setSmartSkipRefinementState({
              kind: 'unavailable',
              message: 'Sign in to Gemini for deeper middle-of-video cuts.',
            });
            return;
          }
        }
      } catch {
        // Deep analysis is optional. Local cuts must remain uninterrupted.
      }
      attempt += 1;
      if (attempt === 9) {
        setSmartSkipRefinementState({
          kind: 'unavailable',
          message: 'Deep scan reconnecting; strict local cuts remain active.',
        });
      }
      timer = window.setTimeout(
        () => void poll(),
        attempt >= 9
          ? 10_000
          : Math.min(3_200, PROVIDER_STATUS_POLL_MS * 2 ** Math.min(attempt, 3)),
      );
    };

    queueMicrotask(() => {
      if (!disposed) setSmartSkipRefinementState({ kind: 'connecting' });
    });
    void poll();
    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [smartSkipRefinementSession]);

  const applySmartSkipAnalysis = useCallback(
    (analysis: SmartSkipAnalysis, cached: boolean, generation: number) => {
      smartSkipEngine.setEnabled(false);
      smartSkipEngine.setIntervals(analysis.intervals);
      if (settingsRef.current.smartSkip.autoSkip) smartSkipEngine.setEnabled(true);
      queueMicrotask(() => {
        if (generation === smartSkipGenerationRef.current)
          setSmartSkipAnalysisState({ kind: 'ready', analysis, cached });
      });
    },
    [smartSkipEngine],
  );

  useEffect(() => {
    const generation = ++smartSkipGenerationRef.current;
    let disposed = false;
    const configuration = settings.smartSkip;
    if (!page.videoId) {
      smartSkipEngine.setEnabled(false);
      smartSkipEngine.setIntervals([]);
      queueMicrotask(() => {
        if (!disposed) {
          setSmartSkipAnalysisState({ kind: 'idle' });
          setSmartSkipRefinementState({ kind: 'idle' });
        }
      });
      return () => {
        disposed = true;
      };
    }

    if (!transcriptDocument || !selectedTranscriptTrackId) {
      const opening = createInstantOpeningInterval(
        page.videoId,
        playback.snapshot.durationSeconds,
        configuration,
      );
      smartSkipEngine.setEnabled(false);
      smartSkipEngine.setIntervals(opening ? [opening] : []);
      if (opening && configuration.autoSkip) smartSkipEngine.setEnabled(true);
      queueMicrotask(() => {
        if (!disposed && generation === smartSkipGenerationRef.current) {
          setSmartSkipAnalysisState({ kind: 'idle' });
          setSmartSkipRefinementState({ kind: 'idle' });
        }
      });
      return () => {
        disposed = true;
      };
    }

    const instantAnalysis = buildInstantSmartSkipAnalysis(
      transcriptDocument,
      selectedTranscriptTrackId,
      configuration,
    );
    queueMicrotask(() => {
      if (disposed || generation !== smartSkipGenerationRef.current) return;
      setSmartSkipRefinementState(
        smartSkipRefinementSession ? { kind: 'connecting' } : { kind: 'idle' },
      );
    });
    applySmartSkipAnalysis(instantAnalysis, false, generation);
    const key = smartSkipAnalysisCacheKey(
      transcriptDocument,
      selectedTranscriptTrackId,
      configuration,
    );
    void smartSkipCache
      .get(key)
      .then((analysis) => {
        if (disposed || generation !== smartSkipGenerationRef.current) return;
        if (analysis) {
          applySmartSkipAnalysis(analysis, true, generation);
          const deepCuts = analysis.intervals.filter(
            (interval) => interval.source === 'deep',
          ).length;
          if (deepCuts > 0) {
            smartSkipRefinementRunKeyRef.current = key;
            setSmartSkipRefinementState({ kind: 'complete', addedCuts: deepCuts });
          }
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [
    applySmartSkipAnalysis,
    selectedTranscriptTrackId,
    smartSkipCache,
    smartSkipEngine,
    page.videoId,
    playback,
    settings.smartSkip,
    smartSkipRefinementSession,
    transcriptDocument,
  ]);

  useEffect(() => {
    if (
      !transcriptDocument ||
      !selectedTranscriptTrackId ||
      !smartSkipRefinementSession ||
      smartSkipRefinementProviderState !== 'ready' ||
      !settings.smartSkip.autoSkip
    )
      return;

    const configuration = settings.smartSkip;
    if (smartSkipRefinementSession.provider !== configuration.provider) return;
    const cacheKey = smartSkipAnalysisCacheKey(
      transcriptDocument,
      selectedTranscriptTrackId,
      configuration,
    );
    if (smartSkipRefinementRunKeyRef.current === cacheKey) return;
    const generation = smartSkipGenerationRef.current;
    let disposed = false;
    let retryTimer: number | null = null;

    const refine = async () => {
      try {
        const chunks = buildSmartSkipAnalysisChunks(transcriptDocument, configuration);
        const rawCuts: ReturnType<typeof parseSmartSkipAnalysisResponse>[number][] = [];
        setSmartSkipRefinementState({
          kind: 'analyzing',
          completed: 0,
          total: chunks.length,
        });
        for (const chunk of chunks) {
          let parsedCuts: ReturnType<typeof parseSmartSkipAnalysisResponse> | null =
            null;
          let lastError: Error | null = null;
          for (let attempt = 0; attempt < 2 && !disposed; attempt += 1) {
            try {
              const response = await send({
                type: 'webchat:analyze',
                provider: smartSkipRefinementSession.provider,
                sessionId: smartSkipRefinementSession.sessionId,
                message: chunk.prompt,
                newConversation: chunk.index === 0 || attempt > 0,
              });
              if (!response.ok) throw new Error(response.message);
              if (response.type !== 'webchat:analysis')
                throw new Error('Deep scan returned an unexpected response.');
              parsedCuts = parseSmartSkipAnalysisResponse(response.text, chunk);
              break;
            } catch (error: unknown) {
              lastError =
                error instanceof Error
                  ? error
                  : new Error('Deep scan could not read the provider response.');
              if (attempt < 1)
                await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
            }
          }
          if (!parsedCuts)
            throw lastError ?? new Error('Deep scan did not return cuts.');
          rawCuts.push(...parsedCuts);
          if (disposed || generation !== smartSkipGenerationRef.current) return;
          setSmartSkipRefinementState({
            kind: 'analyzing',
            completed: chunk.index + 1,
            total: chunks.length,
          });
        }

        const deep = normalizeSmartSkipIntervals(
          rawCuts,
          transcriptDocument,
          configuration,
        );
        const current = smartSkipAnalysisStateRef.current;
        const instant =
          current.kind === 'ready' &&
          current.analysis.videoId === transcriptDocument.videoId &&
          current.analysis.trackId === selectedTranscriptTrackId
            ? current.analysis
            : buildInstantSmartSkipAnalysis(
                transcriptDocument,
                selectedTranscriptTrackId,
                configuration,
              );
        const merged = mergeSmartSkipAnalyses(
          instant,
          deep,
          transcriptDocument.durationSeconds ??
            transcriptDocument.segments.at(-1)?.endSeconds ??
            0,
        );
        if (disposed || generation !== smartSkipGenerationRef.current) return;
        smartSkipEngine.updateIntervals(merged.intervals);
        smartSkipAnalysisStateRef.current = {
          kind: 'ready',
          analysis: merged,
          cached: false,
        };
        setSmartSkipAnalysisState(smartSkipAnalysisStateRef.current);
        const addedCuts = merged.intervals.filter(
          (interval) => interval.source === 'deep',
        ).length;
        smartSkipRefinementFailureCountRef.current = 0;
        setSmartSkipRefinementState({ kind: 'complete', addedCuts });
        await smartSkipCache.set(cacheKey, merged);
      } catch (error: unknown) {
        if (disposed || generation !== smartSkipGenerationRef.current) return;
        smartSkipRefinementRunKeyRef.current = null;
        const retryDelay = Math.min(
          30_000,
          2_000 * 2 ** smartSkipRefinementFailureCountRef.current,
        );
        smartSkipRefinementFailureCountRef.current += 1;
        setSmartSkipRefinementState({
          kind: 'unavailable',
          message: `Deep scan reconnecting; strict local cuts remain active. ${
            error instanceof Error ? error.message : ''
          }`.trim(),
        });
        if (smartSkipRefinementFailureCountRef.current <= 3)
          retryTimer = window.setTimeout(
            () => setSmartSkipRefinementRetryToken((value) => value + 1),
            retryDelay,
          );
      }
    };

    queueMicrotask(() => {
      if (
        disposed ||
        generation !== smartSkipGenerationRef.current ||
        smartSkipRefinementRunKeyRef.current === cacheKey
      )
        return;
      smartSkipRefinementRunKeyRef.current = cacheKey;
      void refine();
    });
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [
    selectedTranscriptTrackId,
    settings.smartSkip,
    smartSkipCache,
    smartSkipEngine,
    smartSkipRefinementProviderState,
    smartSkipRefinementRetryToken,
    smartSkipRefinementSession,
    transcriptDocument,
  ]);

  const displayedTranscript: TranscriptViewState = contextLost
    ? { kind: 'error', message: CONTEXT_LOST_MESSAGE }
    : transcript;

  const theme: ResolvedTheme =
    settings.theme === 'system' ? systemTheme : settings.theme;
  const visible =
    settingsLoaded &&
    settings.extensionEnabled &&
    page.kind !== 'unsupported' &&
    Boolean(page.videoId);
  const detachableVideo =
    page.videoId && (page.kind === 'watch' || page.kind === 'shorts')
      ? { videoId: page.videoId, videoKind: page.kind }
      : null;

  useEffect(() => {
    if (!visible) onAskFocusChange?.(false);
  }, [onAskFocusChange, visible]);

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [onVisibilityChange, visible]);

  useEffect(() => {
    const controls: WatchBetterRuntimeControls = {
      isMounted: () => visible,
      restore: async () => {
        if (!settingsRef.current.extensionEnabled)
          throw new Error('Enable Watch Better before restoring the panel.');
        await patchSettings({ panelCollapsed: false });
      },
    };
    onControls?.(controls);
    return () => onControls?.(null);
  }, [onControls, patchSettings, visible]);

  useEffect(
    () => () => {
      loadAbortRef.current?.abort();
      cache.clearMemory();
    },
    [cache],
  );

  if (!visible) return null;

  return (
    <>
      {smartSkipRefinementFrameEnabled ? (
        <SmartSkipRefinementFrame
          key={settings.smartSkip.provider}
          onPrepare={prepareSmartSkipRefinement}
          onReset={resetSmartSkipRefinement}
          onSessionChange={registerSmartSkipRefinementSession}
          provider={settings.smartSkip.provider}
        />
      ) : null}
      <WatchBetterApp
        activeTab={activeTab}
        allowCollapse={presentation === 'panel'}
        collapsed={
          presentation === 'floating' ? false : settings.panelCollapsed || theaterMode
        }
        {...(presentation === 'panel'
          ? {
              onCollapsedChange: (panelCollapsed: boolean) =>
                void patchSettings({ panelCollapsed }).catch(() => undefined),
            }
          : {})}
        {...(onAskFocusChange ? { onAskFocusChange } : {})}
        onOpenSettings={async () => {
          const response = await send({ type: 'settings:open' });
          if (!response.ok) throw new Error(response.message);
        }}
        onTabChange={setActiveTab}
        {...(presentation === 'panel' && detachableVideo && onDetach
          ? {
              onDetach: async () => {
                await onDetach({
                  videoId: detachableVideo.videoId,
                  videoKind: detachableVideo.videoKind,
                  videoUrl: page.url,
                  videoTitle: resolvedVideoTitle,
                  generation: page.generation,
                  provider: selectedWebChatProvider,
                });
              },
            }
          : {})}
        {...(presentation === 'floating'
          ? {
              minimized,
              ...(onClose ? { onClose } : {}),
              ...(onMinimizedChange ? { onMinimizedChange } : {}),
              ...(onToggleMaximized ? { onToggleMaximized } : {}),
            }
          : {})}
        presentation={presentation}
        theme={theme}
        transcriptFontSize={settings.transcriptFontSize}
        {...(presentation === 'floating' ? { videoTitle: resolvedVideoTitle } : {})}
        transcript={{
          state: displayedTranscript,
          activeSegmentId,
          autoFollow: settings.autoFollowTranscript,
          onSeek: (segment) => playback.seek(segment.startSeconds),
          onTrackChange: (trackId) => {
            if (page.videoId) void loadTranscript(page.videoId, trackId);
          },
          onSendToAI: (segmentIds) => {
            setSelectedSegmentIds(new Set(segmentIds));
            setActiveTab('ask');
            setSendRequestId((current) => current + 1);
          },
          onEnableTranscript: () =>
            void patchSettings({ autoLoadTranscript: true }).catch(() => undefined),
          onRetry: () => {
            if (page.videoId) void loadTranscript(page.videoId);
          },
        }}
        smartSkip={{
          configuration: settings.smartSkip,
          analysisState: smartSkipAnalysisState,
          refinementState: smartSkipRefinementState,
          engineSnapshot: smartSkipEngineSnapshot,
          durationSeconds:
            transcriptDocument?.durationSeconds ?? playback.snapshot.durationSeconds,
          transcriptAvailable: Boolean(transcriptDocument),
          onConfigurationChange: (configuration) => {
            void patchSettings({ smartSkip: configuration }).catch(() => undefined);
          },
          onEnabledChange: (enabled) => {
            smartSkipEngine.setEnabled(enabled);
            void patchSettings({
              smartSkip: { ...settings.smartSkip, autoSkip: enabled },
            }).catch(() => undefined);
          },
          onIntervalEnabledChange: (intervalId, enabled) => {
            setSmartSkipAnalysisState((current) => {
              if (current.kind !== 'ready') return current;
              const analysis = {
                ...current.analysis,
                intervals: current.analysis.intervals.map((interval) =>
                  interval.id === intervalId ? { ...interval, enabled } : interval,
                ),
              };
              smartSkipEngine.updateIntervals(analysis.intervals);
              if (transcriptDocument && selectedTranscriptTrackId) {
                const key = smartSkipAnalysisCacheKey(
                  transcriptDocument,
                  selectedTranscriptTrackId,
                  settings.smartSkip,
                );
                void smartSkipCache.set(key, analysis).catch(() => undefined);
              }
              return { ...current, analysis };
            });
          },
          onUndo: () => {
            smartSkipEngine.undoLastSkip();
          },
          onSeek: (seconds) => playback.seek(seconds),
        }}
        ask={{
          transcript: transcriptDocument,
          selectedSegmentIds,
          currentTimeSeconds: askTimeSeconds,
          providerStatuses,
          selectedProvider: selectedWebChatProvider,
          sendRequestId,
          onProviderChange: setSelectedWebChatProvider,
          onProviderSessionChange: registerAskProviderSession,
          onPrimeWebChat: primeAskWebChat,
          onFocusWebChat: focusAskWebChat,
          onSendWebChat: sendAskWebChat,
          onOpenWebChat: openAskWebChat,
          onPrepareWebChat: prepareAskWebChat,
          onResetWebChat: resetAskWebChat,
        }}
      />
    </>
  );
}
