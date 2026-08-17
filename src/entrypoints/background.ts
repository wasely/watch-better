import { browser } from 'wxt/browser';

import { isSupportedYouTubeVideoUrl } from '@/adapters/youtube/youtube-url';

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
import { buildFrameRule, frameRuleId } from '@/services/web-chat-frame-rule';

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
  readonly ruleId: number;
}

interface WebChatFrameRegistry {
  readonly bindings: Record<string, PendingFrameBinding>;
  readonly frames: Record<string, EmbeddedFrameRecord>;
}

const isSupportedWatchUrl = (url: string | undefined): boolean =>
  Boolean(url && isSupportedYouTubeVideoUrl(url));

const isYouTubePageUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'www.youtube.com';
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

const frameKey = (
  tabId: number,
  providerId: WebChatProviderId,
  sessionId: string,
): string => `${tabId}:${providerId}:${sessionId}`;

const installFrameRule = async (
  tabId: number,
  providerId: 'chatgpt' | 'gemini',
): Promise<number> => {
  const ruleId = frameRuleId(tabId, providerId);
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [buildFrameRule(tabId, providerId)],
  });
  return ruleId;
};

const removeFrameRule = async (ruleId: number): Promise<void> => {
  await browser.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [ruleId] })
    .catch(() => undefined);
};

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
  sessionId: string,
): Promise<EmbeddedFrameRecord | null> => {
  await frameRegistryQueue.catch(() => undefined);
  const registry = await loadFrameRegistry();
  const key = frameKey(tabId, providerId, sessionId);
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
    const key = frameKey(binding.tabId, binding.provider, binding.sessionId);
    registry.bindings[key] = binding;
    delete registry.frames[key];
  });
};

const saveEmbeddedFrame = async (record: EmbeddedFrameRecord): Promise<boolean> => {
  let saved = false;
  await mutateFrameRegistry((registry) => {
    const key = frameKey(record.tabId, record.provider, record.sessionId);
    if (registry.bindings[key]?.sessionId !== record.sessionId) return;
    registry.frames[key] = record;
    saved = true;
  });
  return saved;
};

const resetEmbeddedFrame = async (
  tabId: number,
  providerId: WebChatProviderId,
  sessionId: string,
): Promise<void> => {
  const key = frameKey(tabId, providerId, sessionId);
  await mutateFrameRegistry((registry) => {
    delete registry.bindings[key];
    delete registry.frames[key];
  });
};

const resetEmbeddedFramesForTab = async (tabId: number): Promise<void> => {
  const registry = await loadFrameRegistry();
  const ruleIds = Object.values(registry.bindings)
    .filter((binding) => binding.tabId === tabId)
    .map((binding) => binding.ruleId);
  await mutateFrameRegistry((current) => {
    for (const [key, binding] of Object.entries(current.bindings)) {
      if (binding.tabId !== tabId) continue;
      delete current.bindings[key];
      delete current.frames[key];
    }
  });
  if (ruleIds.length > 0)
    await browser.declarativeNetRequest
      .updateSessionRules({ removeRuleIds: [...new Set(ruleIds)] })
      .catch(() => undefined);
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
  sessionId?: string,
): Promise<WebChatProviderStatus> => {
  if (!sessionId) return { provider: providerId, state: 'loading' };
  const frame = await loadEmbeddedFrame(tabId, providerId, sessionId);
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
  newConversation: boolean,
  tabId: number,
  sessionId?: string,
): Promise<ExtensionResponse> => {
  const provider = WEB_CHAT_PROVIDERS[providerId];
  const targetTabId = tabId;

  const frame = sessionId
    ? await loadEmbeddedFrame(tabId, providerId, sessionId)
    : null;
  if (!frame)
    return {
      ok: false,
      type: 'error',
      message: `${provider.displayName} is still loading inside Watch Better.`,
    };
  const targetFrameId = frame.frameId;

  const response = await sendToProviderPage(targetTabId, targetFrameId, {
    type: 'watchbetter:webchat-page-send',
    message,
    newConversation,
  });
  if (!response?.ok) {
    return {
      ok: false,
      type: 'error',
      message: response?.message ?? `${provider.displayName} is not ready.`,
    };
  }
  if (response.type !== 'webchat-page:submitted')
    return {
      ok: false,
      type: 'error',
      message: `${provider.displayName} returned an unexpected response.`,
    };
  // The answer belongs to the frame the viewer is watching, so nothing to carry back.
  return {
    ok: true,
    type: 'webchat:response',
    provider: providerId,
    text: '',
    responseId: `web_${providerId}_${crypto.randomUUID()}`,
  };
};

const panelSenderTabId = (sender: MessageSenderContext): number | null =>
  typeof sender.tab?.id === 'number' && isYouTubePageUrl(sender.tab.url)
    ? sender.tab.id
    : null;

const registerEmbeddedFrame = async (
  providerId: WebChatProviderId,
  sessionId: string,
  sender: MessageSenderContext,
): Promise<boolean> => {
  const tabId = panelSenderTabId(sender);
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
      const tabId = panelSenderTabId(sender);
      if (tabId === null || sender.frameId !== 0)
        return {
          ok: false,
          type: 'error',
          message: 'Provider frames can be prepared only from Watch Better.',
        };
      const ruleId = await installFrameRule(tabId, request.provider);
      try {
        await prepareEmbeddedFrame({
          tabId,
          provider: request.provider,
          sessionId: request.sessionId,
          ruleId,
        });
      } catch (error) {
        await removeFrameRule(ruleId);
        throw error;
      }
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
      const tabId = panelSenderTabId(sender);
      if (tabId === null || sender.frameId !== 0)
        return {
          ok: false,
          type: 'error',
          message: 'Frame reset is available only from Watch Better.',
        };
      await resetEmbeddedFrame(tabId, request.provider, request.sessionId);
      return { ok: true, type: 'acknowledged' };
    }
    case 'webchat:get-status': {
      const tabId = panelSenderTabId(sender);
      if (tabId === null)
        return {
          ok: false,
          type: 'error',
          message: 'Embedded provider status is available only inside Watch Better.',
        };
      return {
        ok: true,
        type: 'webchat:status',
        ...(await providerStatus(request.provider, tabId, request.sessionId)),
      };
    }
    case 'webchat:send': {
      const tabId = panelSenderTabId(sender);
      if (tabId === null)
        return {
          ok: false,
          type: 'error',
          message: 'Embedded Ask is available only inside Watch Better.',
        };
      return sendWebChat(
        request.provider,
        request.message,
        request.newConversation,
        tabId,
        request.sessionId,
      );
    }
    case 'settings:open':
      await browser.runtime.openOptionsPage();
      return { ok: true, type: 'acknowledged' };
    case 'settings:manage':
      await browser.tabs.create({
        url: `chrome://extensions/?id=${browser.runtime.id}`,
        active: true,
      });
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
          message: 'Open a desktop YouTube video or Short first.',
        };
      return (
        (await sendToTab(activeTab.id, request)) ?? {
          ok: false,
          type: 'error',
          message: 'Watch Better is not connected to this tab yet.',
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

  browser.tabs.onRemoved.addListener((tabId) => {
    void resetEmbeddedFramesForTab(tabId);
  });
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0 || isYouTubePageUrl(details.url)) return;
    void resetEmbeddedFramesForTab(details.tabId);
  });
});
