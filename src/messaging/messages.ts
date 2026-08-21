import type { WatchBetterSettings } from '@/features/settings/settings';
import {
  isWebChatProviderId,
  isWebChatSessionId,
  MAX_WEB_CHAT_MESSAGE_CHARACTERS,
  type WebChatProviderId,
  type WebChatProviderStatus,
} from '@/services/web-chat';

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
      readonly changes: Partial<WatchBetterSettings>;
    }
  | { readonly type: 'panel:get-status' }
  | { readonly type: 'panel:restore' }
  | { readonly type: 'settings:open' }
  | { readonly type: 'settings:manage' }
  | { readonly type: 'webchat:open'; readonly provider: WebChatProviderId }
  | {
      readonly type: 'webchat:frame-prepare';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
    }
  | {
      readonly type: 'webchat:frame-ready';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
    }
  | {
      readonly type: 'webchat:frame-reset';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
    }
  | {
      readonly type: 'webchat:get-status';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
    }
  | {
      readonly type: 'webchat:focus';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
    }
  | {
      readonly type: 'webchat:prime';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
      readonly message: string;
      readonly newConversation: boolean;
    }
  | {
      readonly type: 'webchat:send';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
      readonly message: string;
      readonly newConversation: boolean;
    }
  | {
      readonly type: 'webchat:analyze';
      readonly provider: WebChatProviderId;
      readonly sessionId: string;
      readonly message: string;
      readonly newConversation: boolean;
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
      readonly settings: WatchBetterSettings;
    }
  | { readonly ok: true; readonly type: 'panel:status'; readonly mounted: boolean }
  | ({ readonly ok: true; readonly type: 'webchat:status' } & WebChatProviderStatus)
  | {
      readonly ok: true;
      readonly type: 'webchat:response';
      readonly provider: WebChatProviderId;
      readonly text: string;
      readonly responseId: string;
    }
  | {
      readonly ok: true;
      readonly type: 'webchat:analysis';
      readonly provider: WebChatProviderId;
      readonly text: string;
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
  'smartSkip',
  'transcriptCachePolicy',
]);
const SMART_SKIP_KEYS = new Set(['provider', 'strictness', 'categories', 'autoSkip']);

const isSettingsPatch = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const changes = value as Record<string, unknown>;
  if (!Object.keys(changes).every((key) => SETTINGS_KEYS.has(key))) return false;
  if (!('smartSkip' in changes)) return true;
  const smartSkip = changes.smartSkip;
  return (
    typeof smartSkip === 'object' &&
    smartSkip !== null &&
    !Array.isArray(smartSkip) &&
    Object.keys(smartSkip).every((key) => SMART_SKIP_KEYS.has(key))
  );
};

export const isExtensionRequest = (value: unknown): value is ExtensionRequest => {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;

  const candidate = value as {
    readonly type?: unknown;
    readonly enabled?: unknown;
    readonly changes?: unknown;
    readonly provider?: unknown;
    readonly message?: unknown;
    readonly newConversation?: unknown;
    readonly sessionId?: unknown;
  };
  const hasOnlyKeys = (...allowed: readonly string[]) =>
    Object.keys(candidate).every((key) => allowed.includes(key));
  switch (candidate.type) {
    case 'runtime:get-status':
    case 'panel:get-status':
    case 'panel:restore':
    case 'settings:open':
    case 'settings:manage':
      return hasOnlyKeys('type');
    case 'runtime:set-enabled':
      return typeof candidate.enabled === 'boolean' && hasOnlyKeys('type', 'enabled');
    case 'settings:update':
      return isSettingsPatch(candidate.changes) && hasOnlyKeys('type', 'changes');
    case 'webchat:open':
      return isWebChatProviderId(candidate.provider) && hasOnlyKeys('type', 'provider');
    case 'webchat:frame-reset':
    case 'webchat:get-status':
    case 'webchat:focus':
      return (
        isWebChatProviderId(candidate.provider) &&
        isWebChatSessionId(candidate.sessionId) &&
        hasOnlyKeys('type', 'provider', 'sessionId')
      );
    case 'webchat:frame-prepare':
    case 'webchat:frame-ready':
      return (
        isWebChatProviderId(candidate.provider) &&
        isWebChatSessionId(candidate.sessionId) &&
        hasOnlyKeys('type', 'provider', 'sessionId')
      );
    case 'webchat:prime':
    case 'webchat:send':
    case 'webchat:analyze':
      return (
        isWebChatProviderId(candidate.provider) &&
        isWebChatSessionId(candidate.sessionId) &&
        typeof candidate.message === 'string' &&
        candidate.message.trim().length > 0 &&
        candidate.message.length <= MAX_WEB_CHAT_MESSAGE_CHARACTERS &&
        typeof candidate.newConversation === 'boolean' &&
        hasOnlyKeys('type', 'provider', 'sessionId', 'message', 'newConversation')
      );
    default:
      return false;
  }
};
