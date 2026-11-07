import { describe, expect, it } from 'vitest';

import {
  isProviderStartUrl,
  isWebChatFrameBinding,
  isWebChatPageRequest,
  providerForHostname,
  WEB_CHAT_PROVIDERS,
} from './web-chat';

describe('web chat provider contract', () => {
  it('maps only supported provider hosts', () => {
    expect(providerForHostname('chatgpt.com')?.id).toBe('chatgpt');
    expect(providerForHostname('gemini.google.com')?.id).toBe('gemini');
    expect(providerForHostname('chat.deepseek.com')).toBeNull();
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

  it('ships only providers that embed inside the panel', () => {
    expect(Object.keys(WEB_CHAT_PROVIDERS)).toEqual(['chatgpt', 'gemini']);
    expect(JSON.stringify(WEB_CHAT_PROVIDERS)).not.toMatch(/deepseek/i);
  });

  it('validates page messages and rejects hidden fields', () => {
    expect(isWebChatPageRequest({ type: 'watchbetter:webchat-page-status' })).toBe(
      true,
    );
    expect(isWebChatPageRequest({ type: 'watchbetter:webchat-page-focus' })).toBe(true);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-prime',
        message: 'Submit this transcript as context.',
        newConversation: true,
      }),
    ).toBe(true);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-send',
        message: 'Use this transcript.',
        newConversation: true,
        imageUrl: 'https://i.ytimg.com/vi/example/hqdefault.jpg',
      }),
    ).toBe(false);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-analyze',
        message: 'Return JSON cuts.',
        newConversation: true,
      }),
    ).toBe(true);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-send',
        message: 'Hello',
        newConversation: false,
        cookie: 'secret',
      }),
    ).toBe(false);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-focus',
        message: 'hidden data',
      }),
    ).toBe(false);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-send',
        message: 'Inspect this thumbnail.',
        newConversation: false,
        imageUrl: 'https://attacker.example/track.jpg',
      }),
    ).toBe(false);
    expect(
      isWebChatPageRequest({
        type: 'watchbetter:webchat-page-prime',
        message: 'Hidden image transfer.',
        newConversation: true,
        imageUrl: 'https://i.ytimg.com/vi/example/hqdefault.jpg',
      }),
    ).toBe(false);
  });

  it('accepts only bounded provider frame bindings', () => {
    expect(
      isWebChatFrameBinding({
        type: 'watchbetter:webchat-frame-binding',
        provider: 'gemini',
        sessionId: 'frame-123',
      }),
    ).toBe(true);
    expect(
      isWebChatFrameBinding({
        type: 'watchbetter:webchat-frame-binding',
        provider: 'gemini',
        sessionId: 'frame 123',
      }),
    ).toBe(false);
    expect(
      isWebChatFrameBinding({
        type: 'watchbetter:webchat-frame-binding',
        provider: 'gemini',
        sessionId: 'frame-123',
        token: 'hidden',
      }),
    ).toBe(false);
  });
});
