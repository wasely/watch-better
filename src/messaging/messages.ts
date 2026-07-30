import type { CutThroughSettings } from '@/features/settings/settings';
import type { ChatConfigStatus } from '@/storage/chat-config';
import { MAX_CHAT_MESSAGE_CHARACTERS } from '@/services/openai-chat';

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
  | { readonly type: 'chatgpt:open' }
  | { readonly type: 'chatgpt:get-status' }
  | { readonly type: 'chatgpt:configure'; readonly apiKey: string }
  | {
      readonly type: 'chatgpt:send';
      readonly message: string;
      readonly previousResponseId: string | null;
    };

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
  | ({ readonly ok: true; readonly type: 'chatgpt:status' } & ChatConfigStatus)
  | {
      readonly ok: true;
      readonly type: 'chatgpt:response';
      readonly text: string;
      readonly responseId: string;
      readonly model: string;
    }
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
    readonly apiKey?: unknown;
    readonly message?: unknown;
    readonly previousResponseId?: unknown;
  };
  const hasOnlyKeys = (...allowed: readonly string[]) =>
    Object.keys(candidate).every((key) => allowed.includes(key));
  switch (candidate.type) {
    case 'runtime:get-status':
    case 'panel:get-status':
    case 'panel:restore':
    case 'settings:open':
    case 'chatgpt:open':
    case 'chatgpt:get-status':
      return hasOnlyKeys('type');
    case 'runtime:set-enabled':
      return typeof candidate.enabled === 'boolean' && hasOnlyKeys('type', 'enabled');
    case 'settings:update':
      return isSettingsPatch(candidate.changes) && hasOnlyKeys('type', 'changes');
    case 'chatgpt:configure':
      return (
        typeof candidate.apiKey === 'string' &&
        candidate.apiKey.length <= 1_024 &&
        hasOnlyKeys('type', 'apiKey')
      );
    case 'chatgpt:send':
      return (
        typeof candidate.message === 'string' &&
        candidate.message.trim().length > 0 &&
        candidate.message.length <= MAX_CHAT_MESSAGE_CHARACTERS &&
        (candidate.previousResponseId === null ||
          (typeof candidate.previousResponseId === 'string' &&
            candidate.previousResponseId.length <= 256 &&
            candidate.previousResponseId.startsWith('resp_'))) &&
        hasOnlyKeys('type', 'message', 'previousResponseId')
      );
    default:
      return false;
  }
};
