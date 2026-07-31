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
    expect(isExtensionRequest({ type: 'webchat:get-status', provider: 'gemini' })).toBe(
      true,
    );
    expect(
      isExtensionRequest({
        type: 'webchat:send',
        provider: 'chatgpt',
        message: 'Use the transcript.',
        newConversation: true,
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: 'webchat:send',
        provider: 'chatgpt',
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
