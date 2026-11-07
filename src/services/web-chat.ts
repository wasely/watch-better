/** Every provider surface stays embedded inside the YouTube page. */
export type WebChatProviderId = 'chatgpt' | 'gemini';
export type EmbeddedWebChatProviderId = WebChatProviderId;

export type WebChatConnectionState =
  'ready' | 'not-open' | 'sign-in-required' | 'loading';

export interface WebChatProviderStatus {
  readonly provider: WebChatProviderId;
  readonly state: WebChatConnectionState;
}

export interface WebChatPageStatusRequest {
  readonly type: 'watchbetter:webchat-page-status';
}

export interface WebChatPageFocusRequest {
  readonly type: 'watchbetter:webchat-page-focus';
}

export interface WebChatPageSendRequest {
  readonly type: 'watchbetter:webchat-page-send';
  readonly message: string;
  readonly newConversation: boolean;
}

export interface WebChatPagePrimeRequest {
  readonly type: 'watchbetter:webchat-page-prime';
  readonly message: string;
  readonly newConversation: boolean;
}

export interface WebChatPageAnalyzeRequest {
  readonly type: 'watchbetter:webchat-page-analyze';
  readonly message: string;
  readonly newConversation: boolean;
}

export type WebChatPageRequest =
  | WebChatPageStatusRequest
  | WebChatPageFocusRequest
  | WebChatPagePrimeRequest
  | WebChatPageSendRequest
  | WebChatPageAnalyzeRequest;

export interface WebChatFrameBinding {
  readonly type: 'watchbetter:webchat-frame-binding';
  readonly provider: WebChatProviderId;
  readonly sessionId: string;
}

export type WebChatPageResponse =
  | { readonly ok: true; readonly type: 'webchat-page:ready' }
  /** The context was submitted and the provider accepted it. */
  | { readonly ok: true; readonly type: 'webchat-page:primed' }
  | { readonly ok: true; readonly type: 'webchat-page:focused' }
  /** The prompt is in and submitted. The answer streams into the frame the viewer sees. */
  | { readonly ok: true; readonly type: 'webchat-page:submitted' }
  | { readonly ok: true; readonly type: 'webchat-page:analysis'; readonly text: string }
  | {
      readonly ok: false;
      readonly type: 'webchat-page:error';
      readonly code: 'not-ready' | 'send-failed' | 'response-timeout';
      readonly message: string;
    };

export interface WebChatProviderDefinition {
  readonly id: WebChatProviderId;
  readonly displayName: string;
  readonly url: string;
  readonly tabPatterns: readonly string[];
  readonly composerSelectors: readonly string[];
  readonly sendSelectors: readonly string[];
  readonly responseSelectors: readonly string[];
  readonly generatingSelectors: readonly string[];
  readonly newConversationSelectors: readonly string[];
}

export const MAX_WEB_CHAT_MESSAGE_CHARACTERS = 24_000;
export const MAX_WEB_CHAT_SESSION_ID_CHARACTERS = 160;
export const MAX_WEB_CHAT_IMAGE_URL_CHARACTERS = 2_048;

export const isWebChatImageUrl = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_WEB_CHAT_IMAGE_URL_CHARACTERS
  )
    return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase();
    return (
      url.protocol === 'https:' &&
      (hostname === 'img.youtube.com' ||
        hostname === 'i.ytimg.com' ||
        /^i\d+\.ytimg\.com$/.test(hostname))
    );
  } catch {
    return false;
  }
};

export const WEB_CHAT_PROVIDERS: Readonly<
  Record<WebChatProviderId, WebChatProviderDefinition>
> = Object.freeze({
  chatgpt: {
    id: 'chatgpt',
    displayName: 'ChatGPT',
    url: 'https://chatgpt.com/',
    tabPatterns: ['https://chatgpt.com/*'],
    composerSelectors: [
      '#prompt-textarea',
      'textarea[data-id="root"]',
      'textarea[placeholder*="Message" i]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
    ],
    sendSelectors: [
      'button[data-testid="send-button"]',
      '#composer-submit-button',
      'button[aria-label*="Send" i]',
    ],
    responseSelectors: [
      '[data-message-author-role="assistant"]',
      'article[data-testid^="conversation-turn-"] .markdown',
    ],
    generatingSelectors: [
      'button[data-testid="stop-button"]',
      'button[aria-label*="Stop generating" i]',
    ],
    newConversationSelectors: [
      'a[data-testid="create-new-chat-button"]',
      'button[aria-label*="New chat" i]',
      'a[href="/"]',
    ],
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini',
    url: 'https://gemini.google.com/app',
    tabPatterns: ['https://gemini.google.com/*'],
    composerSelectors: [
      'rich-textarea .ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="prompt" i]',
      'textarea[aria-label*="prompt" i]',
    ],
    sendSelectors: [
      'button.send-button',
      'button[aria-label*="Send message" i]',
      'button[aria-label="Send"]',
    ],
    responseSelectors: [
      'model-response .model-response-text',
      'model-response message-content',
      '.model-response-text',
      'message-content',
    ],
    generatingSelectors: [
      'button[aria-label*="Stop response" i]',
      'button[aria-label*="Stop generating" i]',
    ],
    newConversationSelectors: [
      'button[aria-label*="New chat" i]',
      'a[aria-label*="New chat" i]',
      'a[href="/app"]',
    ],
  },
});

export const isWebChatProviderId = (value: unknown): value is WebChatProviderId =>
  value === 'chatgpt' || value === 'gemini';

export const isWebChatSessionId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_WEB_CHAT_SESSION_ID_CHARACTERS &&
  /^[a-zA-Z0-9._:-]+$/.test(value);

export const isWebChatFrameBinding = (value: unknown): value is WebChatFrameBinding => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as {
    readonly type?: unknown;
    readonly provider?: unknown;
    readonly sessionId?: unknown;
  };
  return (
    candidate.type === 'watchbetter:webchat-frame-binding' &&
    isWebChatProviderId(candidate.provider) &&
    isWebChatSessionId(candidate.sessionId) &&
    Object.keys(candidate).every((key) =>
      ['type', 'provider', 'sessionId'].includes(key),
    )
  );
};

export const isWebChatPageRequest = (value: unknown): value is WebChatPageRequest => {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const request = value as {
    readonly type?: unknown;
    readonly message?: unknown;
    readonly newConversation?: unknown;
  };
  if (
    request.type === 'watchbetter:webchat-page-status' ||
    request.type === 'watchbetter:webchat-page-focus'
  )
    return Object.keys(request).length === 1;
  const isPromptRequest =
    request.type === 'watchbetter:webchat-page-prime' ||
    request.type === 'watchbetter:webchat-page-send' ||
    request.type === 'watchbetter:webchat-page-analyze';
  if (!isPromptRequest) return false;
  return (
    typeof request.message === 'string' &&
    request.message.trim().length > 0 &&
    request.message.length <= MAX_WEB_CHAT_MESSAGE_CHARACTERS &&
    typeof request.newConversation === 'boolean' &&
    Object.keys(request).every((key) =>
      ['type', 'message', 'newConversation'].includes(key),
    )
  );
};

export const providerForHostname = (
  hostname: string,
): WebChatProviderDefinition | null => {
  const normalized = hostname.toLocaleLowerCase();
  if (normalized === 'chatgpt.com') return WEB_CHAT_PROVIDERS.chatgpt;
  if (normalized === 'gemini.google.com') return WEB_CHAT_PROVIDERS.gemini;
  return null;
};

export const isProviderStartUrl = (
  definition: WebChatProviderDefinition,
  value: string | undefined,
): boolean => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (providerForHostname(parsed.hostname)?.id !== definition.id) return false;
    if (definition.id === 'gemini')
      return parsed.pathname === '/' || /^\/app\/?$/.test(parsed.pathname);
    return parsed.pathname === '/';
  } catch {
    return false;
  }
};
