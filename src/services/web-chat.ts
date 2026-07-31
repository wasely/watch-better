export type WebChatProviderId = 'chatgpt' | 'gemini';

export type WebChatConnectionState =
  'ready' | 'not-open' | 'sign-in-required' | 'loading';

export interface WebChatProviderStatus {
  readonly provider: WebChatProviderId;
  readonly state: WebChatConnectionState;
}

export interface WebChatPageStatusRequest {
  readonly type: 'watchbetter:webchat-page-status';
}

export interface WebChatPageSendRequest {
  readonly type: 'watchbetter:webchat-page-send';
  readonly message: string;
}

export type WebChatPageRequest = WebChatPageStatusRequest | WebChatPageSendRequest;

export type WebChatPageResponse =
  | { readonly ok: true; readonly type: 'webchat-page:ready' }
  | {
      readonly ok: true;
      readonly type: 'webchat-page:response';
      readonly text: string;
    }
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
}

export const MAX_WEB_CHAT_MESSAGE_CHARACTERS = 24_000;

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
  },
});

export const isWebChatProviderId = (value: unknown): value is WebChatProviderId =>
  value === 'chatgpt' || value === 'gemini';

export const isWebChatPageRequest = (value: unknown): value is WebChatPageRequest => {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const request = value as { readonly type?: unknown; readonly message?: unknown };
  if (request.type === 'watchbetter:webchat-page-status')
    return Object.keys(request).length === 1;
  return (
    request.type === 'watchbetter:webchat-page-send' &&
    typeof request.message === 'string' &&
    request.message.trim().length > 0 &&
    request.message.length <= MAX_WEB_CHAT_MESSAGE_CHARACTERS &&
    Object.keys(request).every((key) => key === 'type' || key === 'message')
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
    if (definition.id === 'chatgpt') return parsed.pathname === '/';
    return parsed.pathname === '/' || /^\/app\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
};
