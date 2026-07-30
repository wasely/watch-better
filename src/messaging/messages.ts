import type { CutThroughSettings } from '@/features/settings/settings';

export type RuntimeStatus = {
  readonly enabled: boolean;
  readonly supportedPage: boolean;
  readonly panelMounted: boolean;
  readonly version: string;
};

export type ExtensionRequest =
  | { readonly type: 'runtime:get-status' }
  | { readonly type: 'runtime:set-enabled'; readonly enabled: boolean }
  | {
      readonly type: 'settings:update';
      readonly changes: Partial<CutThroughSettings>;
    }
  | { readonly type: 'panel:get-status' }
  | { readonly type: 'panel:restore' }
  | { readonly type: 'settings:open' }
  | { readonly type: 'chatgpt:open' };

export type ExtensionResponse =
  | {
      readonly ok: true;
      readonly type: 'runtime:status';
      readonly status: RuntimeStatus;
    }
  | {
      readonly ok: true;
      readonly type: 'settings:updated';
      readonly settings: CutThroughSettings;
    }
  | { readonly ok: true; readonly type: 'panel:status'; readonly mounted: boolean }
  | { readonly ok: true; readonly type: 'acknowledged' }
  | { readonly ok: false; readonly type: 'error'; readonly message: string };

const SETTINGS_KEYS = new Set([
  'schemaVersion',
  'extensionEnabled',
  'defaultTab',
  'autoLoadTranscript',
  'autoFollowTranscript',
  'transcriptFontSize',
  'theme',
  'panelCollapsed',
  'pause',
  'chatgptHandoff',
  'transcriptCachePolicy',
]);
const PAUSE_KEYS = new Set([
  'enabled',
  'preset',
  'minimumGapSeconds',
  'leadingPaddingSeconds',
  'trailingPaddingSeconds',
  'speechPlaybackRate',
  'gapPlaybackRate',
  'jumpLongGaps',
  'jumpThresholdSeconds',
]);

const isSettingsPatch = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const changes = value as Record<string, unknown>;
  if (!Object.keys(changes).every((key) => SETTINGS_KEYS.has(key))) return false;
  if (!('pause' in changes)) return true;
  const pause = changes.pause;
  return (
    typeof pause === 'object' &&
    pause !== null &&
    !Array.isArray(pause) &&
    Object.keys(pause).every((key) => PAUSE_KEYS.has(key))
  );
};

export const isExtensionRequest = (value: unknown): value is ExtensionRequest => {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;

  const candidate = value as {
    readonly type?: unknown;
    readonly enabled?: unknown;
    readonly changes?: unknown;
  };
  const hasOnlyKeys = (...allowed: readonly string[]) =>
    Object.keys(candidate).every((key) => allowed.includes(key));
  switch (candidate.type) {
    case 'runtime:get-status':
    case 'panel:get-status':
    case 'panel:restore':
    case 'settings:open':
    case 'chatgpt:open':
      return hasOnlyKeys('type');
    case 'runtime:set-enabled':
      return typeof candidate.enabled === 'boolean' && hasOnlyKeys('type', 'enabled');
    case 'settings:update':
      return isSettingsPatch(candidate.changes) && hasOnlyKeys('type', 'changes');
    default:
      return false;
  }
};
