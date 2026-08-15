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
import type { DetachedVideoContext } from '@/features/detach/detached-video';
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
import {
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
  const [settings, setSettings] = useState<WatchBetterSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [page, setPage] = useState<YouTubePageSnapshot>(pageController.snapshot);
  const [playbackState, setPlaybackState] = useState<PlaybackSnapshot>(
    playback.snapshot ?? EMPTY_PLAYBACK,
  );
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
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);
  const pageRef = useRef(page);
  const resolveDefaultTab = useCallback(
    (defaultTab: PanelTab) => resolveInitialProductTab(initialTab ?? defaultTab),
    [initialTab],
  );

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

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
        setActiveTab(resolveDefaultTab(settingsRef.current.defaultTab));
      }
    });
    pageController.start();
    return () => {
      unsubscribe();
      pageController.dispose();
    };
  }, [pageController, resolveDefaultTab]);

  useEffect(() => playback.subscribe(setPlaybackState), [playback]);

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
    const refresh = () => {
      for (const provider of ['chatgpt', 'gemini'] as const) {
        const sessionId = providerSessionIds[provider];
        if (!sessionId) {
          setProviderStatuses((current) => ({
            ...current,
            [provider]: { provider, state: 'loading' },
          }));
          continue;
        }
        void send({ type: 'webchat:get-status', provider, sessionId })
          .then((response) => {
            if (disposed || !response.ok || response.type !== 'webchat:status') return;
            setProviderStatuses((current) => ({
              ...current,
              [provider]: { provider, state: response.state },
            }));
          })
          .catch((error: unknown) => {
            if (disposed) return;
            if (isExtensionContextLost(error)) setContextLost(true);
          });
      }
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
  }, [providerSessionIds]);

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

  const activeSegmentId = useMemo(() => {
    if (!transcriptDocument) return null;
    const index = findActiveSegmentIndex(
      transcriptDocument.segments,
      playbackState.currentTimeSeconds,
    );
    return index < 0 ? null : (transcriptDocument.segments[index]?.id ?? null);
  }, [playbackState.currentTimeSeconds, transcriptDocument]);

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
      ask={{
        transcript: transcriptDocument,
        selectedSegmentIds,
        currentTimeSeconds: playbackState.currentTimeSeconds,
        providerStatuses,
        selectedProvider: selectedWebChatProvider,
        sendRequestId,
        onProviderChange: setSelectedWebChatProvider,
        onProviderSessionChange: (provider, sessionId) =>
          setProviderSessionIds((current) =>
            current[provider] === sessionId
              ? current
              : { ...current, [provider]: sessionId },
          ),
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
        onResetWebChat: async (provider, sessionId) => {
          const response = await send({
            type: 'webchat:frame-reset',
            provider,
            sessionId,
          });
          if (!response.ok) throw new Error(response.message);
        },
      }}
    />
  );
}
