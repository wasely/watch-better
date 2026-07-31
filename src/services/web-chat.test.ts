import { describe, expect, it } from 'vitest';

import {
  isProviderStartUrl,
  isWebChatPageRequest,
  providerForHostname,
  WEB_CHAT_PROVIDERS,
} from './web-chat';

describe('web chat provider contract', () => {
  it('maps only supported provider hosts', () => {
    expect(providerForHostname('chatgpt.com')?.id).toBe('chatgpt');
    expect(providerForHostname('gemini.google.com')?.id).toBe('gemini');
    expect(providerForHostname('api.openai.com')).toBeNull();
    expect(providerForHostname('www.chatgpt.com')).toBeNull();
  });

  it('recognizes only blank provider conversation URLs', () => {
    expect(isProviderStartUrl(WEB_CHAT_PROVIDERS.chatgpt, 'https://chatgpt.com/')).toBe(
      true,
    );
    expect(
      isProviderStartUrl(
        WEB_CHAT_PROVIDERS.chatgpt,
        'https://chatgpt.com/c/existing-chat',
      ),
    ).toBe(false);
    expect(
      isProviderStartUrl(WEB_CHAT_PROVIDERS.gemini, 'https://gemini.google.com/app'),
    ).toBe(true);
    expect(
      isProviderStartUrl(
        WEB_CHAT_PROVIDERS.gemini,
        'https://gemini.google.com/app/existing-chat',
      ),
    ).toBe(false);
  });

  it('uses web apps rather than provider APIs', () => {
    expect(WEB_CHAT_PROVIDERS.chatgpt.url).toBe('https://chatgpt.com/');
    expect(WEB_CHAT_PROVIDERS.gemini.url).toBe('https://gemini.google.com/app');
    expect(JSON.stringify(WEB_CHAT_PROVIDERS)).not.toMatch(
      /api\.openai|generativelanguage/,
    );
  });

  it('validates page messages and rejects hidden fields', () => {
    expect(isWebChatPageRequest({ type: 'watchbetter:webchat-page-status' })).toBe(
      true,
    );
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-send',
        message: 'Use this transcript.',
      }),
    ).toBe(true);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-send',
        message: 'Hello',
        cookie: 'secret',
      }),
    ).toBe(false);
  });
});
