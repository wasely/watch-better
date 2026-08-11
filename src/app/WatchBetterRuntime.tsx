import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import type {
  PlaybackController,
  PlaybackSnapshot,
} from '@/adapters/youtube/playback-controller';
import type {
  YouTubePageController,
  YouTubePageSnapshot,
} from '@/adapters/youtube/youtube-page-controller';
import { resolveInitialProductTab } from '@/config/product-features';
import type {
  TranscriptDocument,
  TranscriptProvider,
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
import type { ExtensionRequest, ExtensionResponse } from '@/messaging/messages';
import {
  SettingsRepository,
  SETTINGS_STORAGE_KEY,
} from '@/storage/settings-repository';
import { TranscriptCache } from '@/storage/transcript-cache';
import type { WebChatProviderId, WebChatProviderStatus } from '@/services/web-chat';

import { WatchBetterApp, type ResolvedTheme } from './WatchBetterApp';

const EMPTY_PLAYBACK: PlaybackSnapshot = {
  currentTimeSeconds: 0,
  durationSeconds: null,
  playbackRate: 1,
  paused: true,
  adActive: false,
  supported: false,
};

const send = (request: ExtensionRequest): Promise<ExtensionResponse> =>
  browser.runtime.sendMessage(request);

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
}: WatchBetterRuntimeProps) {
  const repository = useMemo(() => new SettingsRepository(), []);
  const cache = useMemo(() => new TranscriptCache(), []);
  const [settings, setSettings] = useState<WatchBetterSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [page, setPage] = useState<YouTubePageSnapshot>(pageController.snapshot);
  const [playbackState, setPlaybackState] = useState<PlaybackSnapshot>(
    playback.snapshot ?? EMPTY_PLAYBACK,
  );
  const [transcript, setTranscript] = useState<TranscriptViewState>({
    kind: 'loading',
  });
  const [activeTab, setActiveTab] = useState<PanelTab>(() =>
    resolveInitialProductTab(DEFAULT_SETTINGS.defaultTab),
  );
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<
    ReadonlySet<TranscriptSegmentId>
  >(new Set());
  const [providerStatuses, setProviderStatuses] = useState<
    Partial<Record<WebChatProviderId, WebChatProviderStatus>>
  >({});
  const [sendRequestId, setSendRequestId] = useState(0);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(query.matches ? 'dark' : 'light');
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const unsubscribe = pageController.subscribe((next) => {
      setPage(next);
      setSelectedSegmentIds(new Set());
      setActiveTab(resolveInitialProductTab(settingsRef.current.defaultTab));
    });
    pageController.start();
    return () => {
      unsubscribe();
      pageController.dispose();
    };
  }, [pageController]);

  useEffect(() => playback.subscribe(setPlaybackState), [playback]);

  useEffect(() => {
    let disposed = false;
    const sync = () => {
      void repository.load().then((next) => {
        if (disposed) return;
        setSettings(next);
        setActiveTab(resolveInitialProductTab(next.defaultTab));
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
      browser.storage.onChanged.removeListener(onStorageChange);
    };
  }, [repository]);

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      for (const provider of ['chatgpt', 'gemini', 'deepseek'] as const)
        void send({ type: 'webchat:get-status', provider }).then((response) => {
          if (disposed || !response.ok || response.type !== 'webchat:status') return;
          setProviderStatuses((current) => ({
            ...current,
            [provider]: { provider, state: response.state },
          }));
        });
    };
    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(refresh, 2_000);
    refresh();
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (
      !settingsLoaded ||
      !settings.extensionEnabled ||
      page.kind === 'unsupported' ||
      !page.videoId
    )
      return;
    void send({ type: 'webchat:preload', provider: 'deepseek' });
  }, [
    page.generation,
    page.kind,
    page.videoId,
    settings.extensionEnabled,
    settingsLoaded,
  ]);

  const patchSettings = useCallback(async (changes: Partial<WatchBetterSettings>) => {
    setSettings((current) => ({ ...current, ...changes }));
    const response = await send({ type: 'settings:update', changes });
    if (!response.ok) throw new Error(response.message);
    if (response.type !== 'settings:updated')
      throw new Error('Unexpected settings response.');
    setSettings(response.settings);
  }, []);

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

  const activeSegmentId = useMemo(() => {
    if (!transcriptDocument) return null;
    const index = findActiveSegmentIndex(
      transcriptDocument.segments,
      playbackState.currentTimeSeconds,
    );
    return index < 0 ? null : (transcriptDocument.segments[index]?.id ?? null);
  }, [playbackState.currentTimeSeconds, transcriptDocument]);

  const theme: ResolvedTheme =
    settings.theme === 'system' ? systemTheme : settings.theme;
  const visible =
    settingsLoaded &&
    settings.extensionEnabled &&
    page.kind !== 'unsupported' &&
    Boolean(page.videoId);

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
    <WatchBetterApp
      activeTab={activeTab}
      collapsed={settings.panelCollapsed || theaterMode}
      onCollapsedChange={(panelCollapsed) =>
        void patchSettings({ panelCollapsed }).catch(() => undefined)
      }
      {...(onAskFocusChange ? { onAskFocusChange } : {})}
      onOpenSettings={async () => {
        const response = await send({ type: 'settings:open' });
        if (!response.ok) throw new Error(response.message);
      }}
      onTabChange={setActiveTab}
      theme={theme}
      transcriptFontSize={settings.transcriptFontSize}
      transcript={{
        state: transcript,
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
      ask={{
        transcript: transcriptDocument,
        selectedSegmentIds,
        currentTimeSeconds: playbackState.currentTimeSeconds,
        providerStatuses,
        sendRequestId,
        onSendWebChat: async (request) => {
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
        onOpenWebChat: async (provider) => {
          const response = await send({ type: 'webchat:open', provider });
          if (!response.ok) throw new Error(response.message);
        },
        onPrepareWebChat: async (provider, sessionId) => {
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
      }}
    />
  );
}
