import {
  DEFAULT_SMART_SKIP_CONFIGURATION,
  SMART_SKIP_CATEGORIES,
  type SmartSkipCategory,
  type SmartSkipConfiguration,
  type SmartSkipStrictness,
} from '@/features/smart-skip/domain';
import { isWebChatProviderId, type WebChatProviderId } from '@/services/web-chat';

export type PanelTab = 'transcript' | 'ask' | 'smart-skip';
export type ThemePreference = 'system' | 'dark' | 'light';
export type TranscriptFontSize = 'compact' | 'standard' | 'large';
export type TranscriptCachePolicy = 'memory-only' | 'session';

export interface WatchBetterSettings {
  readonly schemaVersion: 3;
  readonly extensionEnabled: boolean;
  readonly defaultTab: PanelTab;
  readonly autoLoadTranscript: boolean;
  readonly autoFollowTranscript: boolean;
  readonly transcriptFontSize: TranscriptFontSize;
  readonly theme: ThemePreference;
  readonly panelCollapsed: boolean;
  readonly smartSkip: SmartSkipConfiguration;
  readonly transcriptCachePolicy: TranscriptCachePolicy;
}

export const DEFAULT_SETTINGS: WatchBetterSettings = Object.freeze({
  schemaVersion: 3,
  extensionEnabled: true,
  defaultTab: 'transcript',
  autoLoadTranscript: true,
  autoFollowTranscript: true,
  transcriptFontSize: 'standard',
  theme: 'system',
  panelCollapsed: false,
  smartSkip: DEFAULT_SMART_SKIP_CONFIGURATION,
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

const normalizeDefaultTab = (value: unknown): PanelTab => {
  // The source-only Jump Cut prototype used "skip". Preserve that user intent.
  if (value === 'skip') return 'smart-skip';
  return oneOf<PanelTab>(
    value,
    ['transcript', 'ask', 'smart-skip'],
    DEFAULT_SETTINGS.defaultTab,
  );
};

const normalizeCategories = (value: unknown): readonly SmartSkipCategory[] => {
  if (!Array.isArray(value)) return DEFAULT_SMART_SKIP_CONFIGURATION.categories;
  const allowed = new Set<SmartSkipCategory>(SMART_SKIP_CATEGORIES);
  const categories = Array.from(
    new Set(
      value.filter(
        (candidate): candidate is SmartSkipCategory =>
          typeof candidate === 'string' && allowed.has(candidate as SmartSkipCategory),
      ),
    ),
  );
  return categories.length > 0
    ? categories
    : DEFAULT_SMART_SKIP_CONFIGURATION.categories;
};

const normalizeSmartSkip = (value: unknown): SmartSkipConfiguration => {
  const source = isRecord(value) ? value : {};
  const provider: WebChatProviderId = isWebChatProviderId(source.provider)
    ? source.provider
    : DEFAULT_SMART_SKIP_CONFIGURATION.provider;
  return {
    provider,
    strictness: oneOf<SmartSkipStrictness>(
      source.strictness,
      ['conservative', 'balanced', 'aggressive'],
      DEFAULT_SMART_SKIP_CONFIGURATION.strictness,
    ),
    categories: normalizeCategories(source.categories),
    autoSkip: booleanOr(source.autoSkip, DEFAULT_SMART_SKIP_CONFIGURATION.autoSkip),
  };
};

export const normalizeSettings = (value: unknown): WatchBetterSettings => {
  const source = isRecord(value) ? value : {};
  return {
    schemaVersion: 3,
    extensionEnabled: booleanOr(
      source.extensionEnabled,
      DEFAULT_SETTINGS.extensionEnabled,
    ),
    defaultTab: normalizeDefaultTab(source.defaultTab),
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
    smartSkip: normalizeSmartSkip(source.smartSkip),
    transcriptCachePolicy: oneOf<TranscriptCachePolicy>(
      source.transcriptCachePolicy,
      ['memory-only', 'session'],
      DEFAULT_SETTINGS.transcriptCachePolicy,
    ),
  };
};
