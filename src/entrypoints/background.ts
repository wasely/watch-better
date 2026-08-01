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
  type WebChatProviderStatus,
} from '@/services/web-chat';

const settingsCoordinator = new SettingsWriteCoordinator(new SettingsRepository());
const WEB_CHAT_FRAME_STORAGE_KEY = 'watchbetter:webchat-frames:v2';

interface MessageSenderContext {
  readonly frameId?: number | undefined;
  readonly url?: string | undefined;
  readonly tab?:
    | {
        readonly id?: number | undefined;
        readonly url?: string | undefined;
      }
    | undefined;
}

interface EmbeddedFrameRecord {
  readonly tabId: number;
  readonly frameId: number;
  readonly provider: WebChatProviderId;
  readonly sessionId: string;
}

interface PendingFrameBinding {
  readonly tabId: number;
  readonly provider: WebChatProviderId;
  readonly sessionId: string;
}

interface WebChatFrameRegistry {
  readonly bindings: Record<string, PendingFrameBinding>;
  readonly frames: Record<string, EmbeddedFrameRecord>;
}

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

const frameKey = (tabId: number, providerId: WebChatProviderId): string =>
  `${tabId}:${providerId}`;

const emptyFrameRegistry = (): WebChatFrameRegistry => ({
  bindings: {},
  frames: {},
});

const loadFrameRegistry = async (): Promise<WebChatFrameRegistry> => {
  const stored = await browser.storage.session.get(WEB_CHAT_FRAME_STORAGE_KEY);
  const value = stored[WEB_CHAT_FRAME_STORAGE_KEY];
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return emptyFrameRegistry();
  const registry = value as Partial<WebChatFrameRegistry>;
  return {
    bindings:
      typeof registry.bindings === 'object' && registry.bindings !== null
        ? registry.bindings
        : {},
    frames:
      typeof registry.frames === 'object' && registry.frames !== null
        ? registry.frames
        : {},
  };
};

let frameRegistryQueue = Promise.resolve();

const mutateFrameRegistry = async (
  mutate: (registry: WebChatFrameRegistry) => void,
): Promise<void> => {
  const task = frameRegistryQueue
    .catch(() => undefined)
    .then(async () => {
      const registry = await loadFrameRegistry();
      mutate(registry);
      await browser.storage.session.set({ [WEB_CHAT_FRAME_STORAGE_KEY]: registry });
    });
  frameRegistryQueue = task;
  await task;
};

const loadEmbeddedFrame = async (
  tabId: number,
  providerId: WebChatProviderId,
): Promise<EmbeddedFrameRecord | null> => {
  await frameRegistryQueue.catch(() => undefined);
  const registry = await loadFrameRegistry();
  const key = frameKey(tabId, providerId);
  const binding = registry.bindings[key];
  const frame = registry.frames[key];
  return frame?.tabId === tabId &&
    frame.provider === providerId &&
    binding?.sessionId === frame.sessionId
    ? frame
    : null;
};

const prepareEmbeddedFrame = async (binding: PendingFrameBinding): Promise<void> => {
  await mutateFrameRegistry((registry) => {
    const key = frameKey(binding.tabId, binding.provider);
    registry.bindings[key] = binding;
    delete registry.frames[key];
  });
};

const saveEmbeddedFrame = async (record: EmbeddedFrameRecord): Promise<boolean> => {
  let saved = false;
  await mutateFrameRegistry((registry) => {
    const key = frameKey(record.tabId, record.provider);
    if (registry.bindings[key]?.sessionId !== record.sessionId) return;
    registry.frames[key] = record;
    saved = true;
  });
  return saved;
};

const resetEmbeddedFrame = async (
  tabId: number,
  providerId: WebChatProviderId,
): Promise<void> => {
  await mutateFrameRegistry((registry) => {
    const key = frameKey(tabId, providerId);
    delete registry.bindings[key];
    delete registry.frames[key];
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

const sendToProviderPage = async (
  tabId: number,
  frameId: number,
  request: WebChatPageRequest,
): Promise<WebChatPageResponse | null> => {
  try {
    return await browser.tabs.sendMessage(tabId, request, { frameId });
  } catch {
    return null;
  }
};

const providerStatus = async (
  providerId: WebChatProviderId,
  tabId: number,
): Promise<WebChatProviderStatus> => {
  const frame = await loadEmbeddedFrame(tabId, providerId);
  if (!frame) return { provider: providerId, state: 'loading' };
  const response = await sendToProviderPage(tabId, frame.frameId, {
    type: 'watchbetter:webchat-page-status',
  });
  return {
    provider: providerId,
    state: response?.ok ? 'ready' : 'sign-in-required',
  };
};

const sendWebChat = async (
  providerId: WebChatProviderId,
  message: string,
  tabId: number,
): Promise<ExtensionResponse> => {
  const provider = WEB_CHAT_PROVIDERS[providerId];
  const frame = await loadEmbeddedFrame(tabId, providerId);
  if (!frame)
    return {
      ok: false,
      type: 'error',
      message: `${provider.displayName} is still loading inside WatchBetter.`,
    };
  const response = await sendToProviderPage(tabId, frame.frameId, {
    type: 'watchbetter:webchat-page-send',
    message,
  });
  if (!response?.ok) {
    return {
      ok: false,
      type: 'error',
      message:
        response?.message ??
        `${provider.displayName} is not ready in the embedded window.`,
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

const youtubeSenderTabId = (sender: MessageSenderContext): number | null =>
  typeof sender.tab?.id === 'number' && isSupportedWatchUrl(sender.tab.url)
    ? sender.tab.id
    : null;

const registerEmbeddedFrame = async (
  providerId: WebChatProviderId,
  sessionId: string,
  sender: MessageSenderContext,
): Promise<boolean> => {
  const tabId = youtubeSenderTabId(sender);
  if (tabId === null || typeof sender.frameId !== 'number' || sender.frameId <= 0)
    return false;
  try {
    if (providerForHostname(new URL(sender.url ?? '').hostname)?.id !== providerId)
      return false;
  } catch {
    return false;
  }
  try {
    const frame = await browser.webNavigation.getFrame({
      tabId,
      frameId: sender.frameId,
    });
    if (!frame || frame.parentFrameId !== 0) return false;
  } catch {
    return false;
  }
  return saveEmbeddedFrame({
    tabId,
    frameId: sender.frameId,
    provider: providerId,
    sessionId,
  });
};

const handleRequest = async (
  request: ExtensionRequest,
  sender: MessageSenderContext,
): Promise<ExtensionResponse> => {
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
    case 'webchat:frame-prepare': {
      const tabId = youtubeSenderTabId(sender);
      if (tabId === null || sender.frameId !== 0)
        return {
          ok: false,
          type: 'error',
          message: 'Provider frames can be prepared only from the YouTube panel.',
        };
      await prepareEmbeddedFrame({
        tabId,
        provider: request.provider,
        sessionId: request.sessionId,
      });
      return { ok: true, type: 'acknowledged' };
    }
    case 'webchat:frame-ready':
      return (await registerEmbeddedFrame(request.provider, request.sessionId, sender))
        ? { ok: true, type: 'acknowledged' }
        : {
            ok: false,
            type: 'error',
            message: 'Rejected an untrusted embedded provider frame.',
          };
    case 'webchat:frame-reset': {
      const tabId = youtubeSenderTabId(sender);
      if (tabId === null || sender.frameId !== 0)
        return {
          ok: false,
          type: 'error',
          message: 'Frame reset is available only from the YouTube panel.',
        };
      await resetEmbeddedFrame(tabId, request.provider);
      return { ok: true, type: 'acknowledged' };
    }
    case 'webchat:get-status': {
      const tabId = youtubeSenderTabId(sender);
      if (tabId === null)
        return {
          ok: false,
          type: 'error',
          message: 'Embedded provider status is available only on YouTube.',
        };
      return {
        ok: true,
        type: 'webchat:status',
        ...(await providerStatus(request.provider, tabId)),
      };
    }
    case 'webchat:send': {
      const tabId = youtubeSenderTabId(sender);
      if (tabId === null)
        return {
          ok: false,
          type: 'error',
          message: 'Embedded Ask is available only on YouTube.',
        };
      return sendWebChat(request.provider, request.message, tabId);
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
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (!isExtensionRequest(message)) return undefined;

    return handleRequest(message, sender).catch(
      (error: unknown): ExtensionResponse => ({
        ok: false,
        type: 'error',
        message: error instanceof Error ? error.message : 'Unexpected extension error.',
      }),
    );
  });
});
