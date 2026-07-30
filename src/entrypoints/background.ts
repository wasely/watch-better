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
import { ChatConfigRepository } from '@/storage/chat-config';
import { sendOpenAIChat } from '@/services/openai-chat';

const settingsCoordinator = new SettingsWriteCoordinator(new SettingsRepository());
const chatConfigRepository = new ChatConfigRepository();

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

const sendToTab = async (
  tabId: number,
  request: ExtensionRequest,
): Promise<ExtensionResponse | null> => {
  try {
    return await browser.tabs.sendMessage(tabId, request);
  } catch {
    return null;
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
      const supportedPage = isSupportedWatchUrl(activeTab?.url);
      const panelResponse =
        supportedPage && typeof activeTab?.id === 'number'
          ? await sendToTab(activeTab.id, { type: 'panel:get-status' })
          : null;
      return {
        ok: true,
        type: 'runtime:status',
        status: {
          enabled: settings.extensionEnabled,
          supportedPage,
          panelMounted:
            panelResponse?.ok === true && panelResponse.type === 'panel:status'
              ? panelResponse.mounted
              : false,
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
    case 'panel:get-status':
      return {
        ok: false,
        type: 'error',
        message: 'Panel status is available only from a YouTube tab.',
      };
    case 'chatgpt:open':
      await browser.tabs.create({ url: 'https://chatgpt.com/' });
      return { ok: true, type: 'acknowledged' };
    case 'chatgpt:get-status': {
      const status = await chatConfigRepository.status();
      return { ok: true, type: 'chatgpt:status', ...status };
    }
    case 'chatgpt:configure': {
      const status = await chatConfigRepository.configure(request.apiKey);
      return { ok: true, type: 'chatgpt:status', ...status };
    }
    case 'chatgpt:send': {
      const config = await chatConfigRepository.load();
      if (!config.credential)
        return {
          ok: false,
          type: 'error',
          message: 'Add an OpenAI API key in CutThrough settings first.',
        };
      const { credential, safetyIdentifier } = config;
      const result = await sendOpenAIChat({
        credential,
        message: request.message,
        previousResponseId: request.previousResponseId,
        safetyIdentifier,
      });
      return { ok: true, type: 'chatgpt:response', ...result };
    }
    case 'settings:open':
      await browser.runtime.openOptionsPage();
      return { ok: true, type: 'acknowledged' };
    case 'panel:restore': {
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (typeof activeTab?.id !== 'number' || !isSupportedWatchUrl(activeTab.url))
        return {
          ok: false,
          type: 'error',
          message: 'Open a desktop YouTube watch page first.',
        };
      return (
        (await sendToTab(activeTab.id, request)) ?? {
          ok: false,
          type: 'error',
          message: 'CutThrough is not connected to this tab yet.',
        }
      );
    }
  }
};

export default defineBackground(() => {
  // Session caching is an explicit opt-in. Chrome otherwise hides this storage
  // area from a content script's isolated world.
  void browser.storage.session.setAccessLevel({
    accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
  });

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
