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
  type CutThroughSettings,
  type PanelTab,
} from '@/features/settings/settings';
import {
  TranscriptGapSkipEngine,
  type SkipEngineSnapshot,
} from '@/features/skip/skip-engine';
import type { ExtensionRequest, ExtensionResponse } from '@/messaging/messages';
import {
  SettingsRepository,
  SETTINGS_STORAGE_KEY,
} from '@/storage/settings-repository';
import { TranscriptCache } from '@/storage/transcript-cache';

import { CutThroughApp, type ResolvedTheme } from './CutThroughApp';

const EMPTY_PLAYBACK: PlaybackSnapshot = {
  currentTimeSeconds: 0,
  durationSeconds: null,
  playbackRate: 1,
  paused: true,
  adActive: false,
  supported: false,
};

const EMPTY_SKIP: SkipEngineSnapshot = {
  state: 'disabled',
  timeSavedSeconds: 0,
  message: 'Playback is unchanged.',
};

const send = (request: ExtensionRequest): Promise<ExtensionResponse> =>
  browser.runtime.sendMessage(request);

export interface CutThroughRuntimeControls {
  restore(): Promise<void>;
  isMounted(): boolean;
}

export interface CutThroughRuntimeProps {
  readonly pageController: YouTubePageController;
  readonly playback: PlaybackController;
  readonly transcriptProvider: TranscriptProvider;
  readonly theaterMode?: boolean;
  readonly onControls?: (controls: CutThroughRuntimeControls | null) => void;
  readonly onVisibilityChange?: (visible: boolean) => void;
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

export function CutThroughRuntime({
  pageController,
  playback,
  transcriptProvider,
  theaterMode = false,
  onControls,
  onVisibilityChange,
}: CutThroughRuntimeProps) {
  const repository = useMemo(() => new SettingsRepository(), []);
  const cache = useMemo(() => new TranscriptCache(), []);
  const [settings, setSettings] = useState<CutThroughSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [page, setPage] = useState<YouTubePageSnapshot>(pageController.snapshot);
  const [playbackState, setPlaybackState] = useState<PlaybackSnapshot>(
    playback.snapshot ?? EMPTY_PLAYBACK,
  );
  const [transcript, setTranscript] = useState<TranscriptViewState>({
    kind: 'loading',
  });
  const [activeTab, setActiveTab] = useState<PanelTab>(DEFAULT_SETTINGS.defaultTab);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<
    ReadonlySet<TranscriptSegmentId>
  >(new Set());
  const [skipSnapshot, setSkipSnapshot] = useState<SkipEngineSnapshot>(EMPTY_SKIP);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const skipEngineRef = useRef<TranscriptGapSkipEngine | null>(null);
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
      setActiveTab(settingsRef.current.defaultTab);
    });
    pageController.start();
    return () => {
      unsubscribe();
      pageController.dispose();
    };
  }, [pageController]);

  useEffect(() => playback.subscribe(setPlaybackState), [playback]);

  useEffect(() => {
    const engine = new TranscriptGapSkipEngine(playback);
    skipEngineRef.current = engine;
    const unsubscribe = engine.subscribe(setSkipSnapshot);
    return () => {
      unsubscribe();
      engine.dispose();
      skipEngineRef.current = null;
    };
  }, [playback]);

  useEffect(() => {
    let disposed = false;
    const sync = () => {
      void repository.load().then((next) => {
        if (disposed) return;
        setSettings(next);
        setActiveTab(next.defaultTab);
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

  const patchSettings = useCallback(async (changes: Partial<CutThroughSettings>) => {
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
    if (!settingsLoaded || page.kind !== 'watch' || !page.videoId) return;
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

  useEffect(() => {
    skipEngineRef.current?.setTranscript(transcriptDocument?.segments ?? null);
  }, [transcriptDocument]);

  useEffect(() => {
    skipEngineRef.current?.update(settings.pause);
  }, [settings.pause]);

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
    page.kind === 'watch' &&
    Boolean(page.videoId);

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [onVisibilityChange, visible]);

  useEffect(() => {
    const controls: CutThroughRuntimeControls = {
      isMounted: () => visible,
      restore: async () => {
        if (!settingsRef.current.extensionEnabled)
          throw new Error('Enable CutThrough before restoring the panel.');
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
    <CutThroughApp
      activeTab={activeTab}
      collapsed={settings.panelCollapsed || theaterMode}
      onCollapsedChange={(panelCollapsed) =>
        void patchSettings({ panelCollapsed }).catch(() => undefined)
      }
      onOpenSettings={() => void send({ type: 'settings:open' })}
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
        onAskSelection: (segmentIds) => {
          setSelectedSegmentIds(new Set(segmentIds));
          setActiveTab('ask');
        },
        onOpenSelectionInChatGPT: (segmentIds) => {
          setSelectedSegmentIds(new Set(segmentIds));
          setActiveTab('ask');
          void send({ type: 'chatgpt:open' });
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
        onOpenChatGPT: async () => {
          const response = await send({ type: 'chatgpt:open' });
          if (!response.ok) throw new Error(response.message);
        },
      }}
      skip={{
        configuration: settings.pause,
        snapshot: skipSnapshot,
        detectionLabel: 'Padded transcript-gap detector',
        onConfigurationChange: (pause) => {
          skipEngineRef.current?.update(pause);
          void patchSettings({ pause }).catch(() => undefined);
        },
        onReset: () => {
          const pause = DEFAULT_SETTINGS.pause;
          skipEngineRef.current?.update(pause);
          void patchSettings({ pause }).catch(() => undefined);
        },
      }}
    />
  );
}
