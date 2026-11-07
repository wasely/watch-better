import { describe, expect, it } from 'vitest';

import { isExtensionRequest } from './messages';

describe('extension message validation', () => {
  it('accepts only typed panel and settings requests', () => {
    expect(isExtensionRequest({ type: 'panel:get-status' })).toBe(true);
    expect(isExtensionRequest({ type: 'panel:restore' })).toBe(true);
    expect(
      isExtensionRequest({
        type: 'settings:update',
        changes: { panelCollapsed: false },
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:analyze',
        provider: 'gemini',
        sessionId: 'smart-skip:gemini:frame-1',
        message: 'Return structured cuts.',
        newConversation: true,
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:analyze',
        provider: 'gemini',
        sessionId: 'frame-1',
        message: '',
        newConversation: true,
      }),
    ).toBe(false);
    expect(isExtensionRequest({ type: 'settings:update', changes: [] })).toBe(false);
    expect(
      isExtensionRequest({
        type: 'settings:update',
        changes: { transcript: 'hidden data' },
      }),
    ).toBe(false);
    expect(isExtensionRequest({ type: 'runtime:set-enabled', enabled: 'yes' })).toBe(
      false,
    );
    expect(
      isExtensionRequest({
        type: 'webchat:open',
        provider: 'chatgpt',
        prompt: 'hidden data',
      }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: 'webchat:get-status',
        provider: 'gemini',
        sessionId: 'gemini:frame-1',
      }),
    ).toBe(true);
    expect(isExtensionRequest({ type: 'webchat:get-status', provider: 'gemini' })).toBe(
      false,
    );
    expect(isExtensionRequest({ type: 'webchat:preload', provider: 'chatgpt' })).toBe(
      false,
    );
    expect(isExtensionRequest({ type: 'webchat:open', provider: 'deepseek' })).toBe(
      false,
    );
    expect(isExtensionRequest({ type: 'settings:manage' })).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:frame-prepare',
        provider: 'chatgpt',
        sessionId: 'frame-123',
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:frame-ready',
        provider: 'chatgpt',
        sessionId: 'frame-123',
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({ type: 'webchat:frame-ready', provider: 'chatgpt' }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: 'webchat:frame-reset',
        provider: 'gemini',
        sessionId: 'gemini:frame-1',
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:prime',
        provider: 'gemini',
        sessionId: 'gemini:frame-1',
        message: 'Prepare this transcript.',
        newConversation: true,
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:focus',
        provider: 'gemini',
        sessionId: 'gemini:frame-1',
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:focus',
        provider: 'gemini',
        sessionId: 'gemini:frame-1',
        message: 'hidden data',
      }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: 'webchat:send',
        provider: 'chatgpt',
        sessionId: 'chatgpt:frame-1',
        message: 'Use the transcript.',
        newConversation: true,
        imageUrl: 'https://i.ytimg.com/vi/example/hqdefault.jpg',
      }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: 'webchat:send',
        provider: 'chatgpt',
        sessionId: 'chatgpt:frame-1',
        message: 'Use the transcript.',
        newConversation: true,
        imageUrl: 'https://attacker.example/track.jpg',
      }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: 'webchat:send',
        provider: 'chatgpt',
        message: 'Use the transcript.',
        newConversation: true,
      }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: 'webchat:send',
        provider: 'chatgpt',
        sessionId: 'chatgpt:frame-1',
        message: '',
        newConversation: true,
      }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: 'webchat:send',
        provider: 'unsupported',
        message: 'Continue',
        newConversation: false,
      }),
    ).toBe(false);
  });
});
