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
import {
  isProviderStartUrl,
  providerForHostname,
  WEB_CHAT_PROVIDERS,
  type WebChatPageRequest,
  type WebChatPageResponse,
  type WebChatProviderDefinition,
  type WebChatProviderId,
} from '@/services/web-chat';

const settingsCoordinator = new SettingsWriteCoordinator(new SettingsRepository());
const WEB_CHAT_TAB_STORAGE_KEY = 'watchbetter:webchat-tabs:v1';

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

const providerTabs = async (provider: WebChatProviderDefinition) =>
  browser.tabs.query({ url: [...provider.tabPatterns] });

const findProviderTab = async (provider: WebChatProviderDefinition) => {
  const tabs = await providerTabs(provider);
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  return (
    tabs.find(
      (tab) =>
        tab.windowId === activeTab?.windowId && isProviderStartUrl(provider, tab.url),
    ) ??
    tabs.find((tab) => isProviderStartUrl(provider, tab.url)) ??
    tabs.find((tab) => tab.windowId === activeTab?.windowId) ??
    tabs.at(0) ??
    null
  );
};

const loadConversationTabId = async (
  providerId: WebChatProviderId,
): Promise<number | null> => {
  const stored = await browser.storage.session.get(WEB_CHAT_TAB_STORAGE_KEY);
  const value = stored[WEB_CHAT_TAB_STORAGE_KEY];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const tabId = (value as Record<string, unknown>)[providerId];
  return typeof tabId === 'number' ? tabId : null;
};

const saveConversationTabId = async (
  providerId: WebChatProviderId,
  tabId: number,
): Promise<void> => {
  const stored = await browser.storage.session.get(WEB_CHAT_TAB_STORAGE_KEY);
  const current = stored[WEB_CHAT_TAB_STORAGE_KEY];
  const tabs =
    typeof current === 'object' && current !== null && !Array.isArray(current)
      ? current
      : {};
  await browser.storage.session.set({
    [WEB_CHAT_TAB_STORAGE_KEY]: { ...tabs, [providerId]: tabId },
  });
};

const openProviderTab = async (
  provider: WebChatProviderDefinition,
): Promise<number> => {
  const existing = await findProviderTab(provider);
  if (typeof existing?.id === 'number') {
    await browser.tabs.update(existing.id, { active: true });
    if (typeof existing.windowId === 'number')
      await browser.windows.update(existing.windowId, { focused: true });
    return existing.id;
  }
  const created = await browser.tabs.create({ url: provider.url, active: true });
  if (typeof created.id !== 'number')
    throw new Error(`Could not open ${provider.displayName}.`);
  return created.id;
};

const waitForTabComplete = async (tabId: number, timeout = 30_000): Promise<void> => {
  const current = await browser.tabs.get(tabId).catch(() => null);
  if (current?.status === 'complete') return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('The AI page took too long to load.'));
    }, timeout);
    const onUpdated = (
      updatedTabId: number,
      changeInfo: { readonly status?: string },
    ) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    browser.tabs.onUpdated.addListener(onUpdated);
  });
};

const sendToProviderPage = async (
  tabId: number,
  request: WebChatPageRequest,
): Promise<WebChatPageResponse | null> => {
  try {
    return await browser.tabs.sendMessage(tabId, request);
  } catch {
    return null;
  }
};

const sendToProviderPageWhenReady = async (
  tabId: number,
  request: WebChatPageRequest,
  timeout = 10_000,
): Promise<WebChatPageResponse | null> => {
  const deadline = Date.now() + timeout;
  do {
    const response = await sendToProviderPage(tabId, request);
    if (response) return response;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  return null;
};

const providerStatus = async (providerId: WebChatProviderId) => {
  const provider = WEB_CHAT_PROVIDERS[providerId];
  const tab = await findProviderTab(provider);
  if (typeof tab?.id !== 'number')
    return { provider: providerId, state: 'not-open' as const };
  if (tab.status === 'loading')
    return { provider: providerId, state: 'loading' as const };
  const response = await sendToProviderPage(tab.id, {
    type: 'watchbetter:webchat-page-status',
  });
  return {
    provider: providerId,
    state: response?.ok ? ('ready' as const) : ('sign-in-required' as const),
  };
};

const sendWebChat = async (
  providerId: WebChatProviderId,
  message: string,
  newConversation: boolean,
): Promise<ExtensionResponse> => {
  const provider = WEB_CHAT_PROVIDERS[providerId];
  let tabId: number;
  if (newConversation) {
    const availableTab = await findProviderTab(provider);
    if (typeof availableTab?.id !== 'number') {
      await openProviderTab(provider);
      return {
        ok: false,
        type: 'error',
        message: `${provider.displayName} opened. Sign in, then return to YouTube and send again.`,
      };
    }
    const ready = await sendToProviderPageWhenReady(
      availableTab.id,
      { type: 'watchbetter:webchat-page-status' },
      2_000,
    );
    if (!ready?.ok) {
      await browser.tabs
        .update(availableTab.id, { active: true })
        .catch(() => undefined);
      return {
        ok: false,
        type: 'error',
        message: `Sign in to ${provider.displayName}, then return to YouTube and send again.`,
      };
    }
    if (isProviderStartUrl(provider, availableTab.url)) tabId = availableTab.id;
    else {
      const created = await browser.tabs.create({
        active: false,
        url: provider.url,
        windowId: availableTab.windowId,
      });
      if (typeof created.id !== 'number')
        throw new Error(`Could not start a new ${provider.displayName} chat.`);
      tabId = created.id;
      await waitForTabComplete(tabId);
    }
    await saveConversationTabId(providerId, tabId);
  } else {
    const storedTabId = await loadConversationTabId(providerId);
    if (storedTabId === null)
      return {
        ok: false,
        type: 'error',
        message: `${provider.displayName} lost the conversation tab. Start a new chat.`,
      };
    const storedTab = await browser.tabs.get(storedTabId).catch(() => null);
    const storedProvider = (() => {
      try {
        return providerForHostname(new URL(storedTab?.url ?? '').hostname)?.id ?? null;
      } catch {
        return null;
      }
    })();
    if (storedProvider !== providerId)
      return {
        ok: false,
        type: 'error',
        message: `${provider.displayName} lost the conversation tab. Start a new chat.`,
      };
    tabId = storedTabId;
  }

  const response = await sendToProviderPageWhenReady(tabId, {
    type: 'watchbetter:webchat-page-send',
    message,
  });
  if (!response?.ok) {
    await browser.tabs.update(tabId, { active: true }).catch(() => undefined);
    return {
      ok: false,
      type: 'error',
      message:
        response?.message ??
        `${provider.displayName} is not ready. Sign in, then try again.`,
    };
  }
  if (response.type !== 'webchat-page:response')
    return {
      ok: false,
      type: 'error',
      message: `${provider.displayName} returned an unexpected response.`,
    };
  return {
    ok: true,
    type: 'webchat:response',
    provider: providerId,
    text: response.text,
    responseId: `web_${providerId}_${crypto.randomUUID()}`,
  };
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
    case 'webchat:open':
      await openProviderTab(WEB_CHAT_PROVIDERS[request.provider]);
      return { ok: true, type: 'acknowledged' };
    case 'webchat:get-status':
      return {
        ok: true,
        type: 'webchat:status',
        ...(await providerStatus(request.provider)),
      };
    case 'webchat:send':
      return sendWebChat(request.provider, request.message, request.newConversation);
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
          message: 'WatchBetter is not connected to this tab yet.',
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
