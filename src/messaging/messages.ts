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
  | { readonly ok: true; readonly type: 'acknowledged' }
  | { readonly ok: false; readonly type: 'error'; readonly message: string };

export const isExtensionRequest = (value: unknown): value is ExtensionRequest => {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;

  const candidate = value as { readonly type?: unknown; readonly enabled?: unknown };
  switch (candidate.type) {
    case 'runtime:get-status':
    case 'panel:restore':
    case 'settings:open':
    case 'chatgpt:open':
      return true;
    case 'runtime:set-enabled':
      return typeof candidate.enabled === 'boolean';
    default:
      return false;
  }
};
