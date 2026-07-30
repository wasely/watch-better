import { browser } from 'wxt/browser';

import {
  isExtensionRequest,
  type ExtensionRequest,
  type ExtensionResponse,
} from '@/messaging/messages';
import {
  SettingsRepository,
  SettingsWriteCoordinator,
} from '@/storage/settings-repository';

const settingsCoordinator = new SettingsWriteCoordinator(new SettingsRepository());

const isSupportedWatchUrl = (url: string | undefined): boolean => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'www.youtube.com' &&
      parsed.pathname === '/watch' &&
      parsed.searchParams.has('v')
    );
  } catch {
    return false;
  }
};

const handleRequest = async (request: ExtensionRequest): Promise<ExtensionResponse> => {
  switch (request.type) {
    case 'runtime:get-status': {
      const settings = await settingsCoordinator.load();
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      return {
        ok: true,
        type: 'runtime:status',
        status: {
          enabled: settings.extensionEnabled,
          supportedPage: isSupportedWatchUrl(activeTab?.url),
          panelMounted: false,
          version: browser.runtime.getManifest().version,
        },
      };
    }
    case 'runtime:set-enabled': {
      const settings = await settingsCoordinator.patch({
        extensionEnabled: request.enabled,
      });
      return { ok: true, type: 'settings:updated', settings };
    }
    case 'settings:update': {
      const settings = await settingsCoordinator.patch(request.changes);
      return { ok: true, type: 'settings:updated', settings };
    }
    case 'chatgpt:open':
      await browser.tabs.create({ url: 'https://chatgpt.com/' });
      return { ok: true, type: 'acknowledged' };
    case 'settings:open':
      await browser.runtime.openOptionsPage();
      return { ok: true, type: 'acknowledged' };
    case 'panel:restore':
      return {
        ok: false,
        type: 'error',
        message: 'Panel restore is not connected yet.',
      };
  }
};

export default defineBackground(() => {
  // WebExtension onMessage listeners intentionally return a promise response.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isExtensionRequest(message)) return undefined;

    return handleRequest(message).catch((error: unknown): ExtensionResponse => ({
      ok: false,
      type: 'error',
      message: error instanceof Error ? error.message : 'Unexpected extension error.',
    }));
  });
});
