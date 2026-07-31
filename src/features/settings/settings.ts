import type { SkipConfiguration, SkipPresetId } from '@/features/skip/skip-engine';

export type PanelTab = 'transcript' | 'ask' | 'skip';
export type ThemePreference = 'system' | 'dark' | 'light';
export type TranscriptFontSize = 'compact' | 'standard' | 'large';
export type TranscriptCachePolicy = 'memory-only' | 'session';

export interface WatchBetterSettings {
  readonly schemaVersion: 2;
  readonly extensionEnabled: boolean;
  readonly defaultTab: PanelTab;
  readonly autoLoadTranscript: boolean;
  readonly autoFollowTranscript: boolean;
  readonly transcriptFontSize: TranscriptFontSize;
  readonly theme: ThemePreference;
  readonly panelCollapsed: boolean;
  readonly pause: SkipConfiguration;
  readonly transcriptCachePolicy: TranscriptCachePolicy;
}

export const DEFAULT_SKIP_CONFIGURATION: SkipConfiguration = Object.freeze({
  enabled: false,
  preset: 'conservative',
  minimumGapSeconds: 2.5,
  leadingPaddingSeconds: 0.35,
  trailingPaddingSeconds: 0.25,
  speechPlaybackRate: 1,
  gapPlaybackRate: 2,
  jumpLongGaps: false,
  jumpThresholdSeconds: 8,
});

export const DEFAULT_SETTINGS: WatchBetterSettings = Object.freeze({
  schemaVersion: 2,
  extensionEnabled: true,
  defaultTab: 'transcript',
  autoLoadTranscript: true,
  autoFollowTranscript: true,
  transcriptFontSize: 'standard',
  theme: 'system',
  panelCollapsed: false,
  pause: DEFAULT_SKIP_CONFIGURATION,
  transcriptCachePolicy: 'memory-only',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T =>
  typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback;

const booleanOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const boundedNumber = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;

const normalizePauseSettings = (value: unknown): SkipConfiguration => {
  const source = isRecord(value) ? value : {};
  const defaults = DEFAULT_SKIP_CONFIGURATION;

  return {
    enabled: booleanOr(source.enabled, defaults.enabled),
    preset: oneOf<SkipPresetId>(
      source.preset,
      ['conservative', 'balanced', 'aggressive'],
      defaults.preset,
    ),
    minimumGapSeconds: boundedNumber(
      source.minimumGapSeconds,
      defaults.minimumGapSeconds,
      0.5,
      30,
    ),
    leadingPaddingSeconds: boundedNumber(
      source.leadingPaddingSeconds,
      defaults.leadingPaddingSeconds,
      0,
      3,
    ),
    trailingPaddingSeconds: boundedNumber(
      source.trailingPaddingSeconds,
      defaults.trailingPaddingSeconds,
      0,
      3,
    ),
    speechPlaybackRate: boundedNumber(
      source.speechPlaybackRate,
      defaults.speechPlaybackRate,
      0.5,
      3,
    ),
    gapPlaybackRate: boundedNumber(
      source.gapPlaybackRate,
      defaults.gapPlaybackRate,
      1,
      16,
    ),
    jumpLongGaps: booleanOr(source.jumpLongGaps, defaults.jumpLongGaps),
    jumpThresholdSeconds: boundedNumber(
      source.jumpThresholdSeconds,
      defaults.jumpThresholdSeconds,
      2,
      60,
    ),
  };
};

export const normalizeSettings = (value: unknown): WatchBetterSettings => {
  const source = isRecord(value) ? value : {};

  return {
    schemaVersion: 2,
    extensionEnabled: booleanOr(
      source.extensionEnabled,
      DEFAULT_SETTINGS.extensionEnabled,
    ),
    defaultTab: oneOf<PanelTab>(
      source.defaultTab,
      ['transcript', 'ask', 'skip'],
      DEFAULT_SETTINGS.defaultTab,
    ),
    autoLoadTranscript: booleanOr(
      source.autoLoadTranscript,
      DEFAULT_SETTINGS.autoLoadTranscript,
    ),
    autoFollowTranscript: booleanOr(
      source.autoFollowTranscript,
      DEFAULT_SETTINGS.autoFollowTranscript,
    ),
    transcriptFontSize: oneOf<TranscriptFontSize>(
      source.transcriptFontSize,
      ['compact', 'standard', 'large'],
      DEFAULT_SETTINGS.transcriptFontSize,
    ),
    theme: oneOf<ThemePreference>(
      source.theme,
      ['system', 'dark', 'light'],
      DEFAULT_SETTINGS.theme,
    ),
    panelCollapsed: booleanOr(source.panelCollapsed, DEFAULT_SETTINGS.panelCollapsed),
    pause: normalizePauseSettings(source.pause),
    transcriptCachePolicy: oneOf<TranscriptCachePolicy>(
      source.transcriptCachePolicy,
      ['memory-only', 'session'],
      DEFAULT_SETTINGS.transcriptCachePolicy,
    ),
  };
};
