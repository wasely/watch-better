// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

describe('production privacy and permission audit', () => {
  it('keeps fixtures out of production entrypoints', () => {
    for (const path of [
      'src/entrypoints/youtube.content.tsx',
      'src/entrypoints/background.ts',
      'src/app/WatchBetterRuntime.tsx',
    ])
      expect(read(path)).not.toMatch(/@\/test|src\/test|fixtures\//);
  });

  it('never opens a browser tab or window on its own', () => {
    // The pop-out card lives inside the YouTube page. Nothing in the panel, the
    // content script, or an automatic background path may spawn a tab or window.
    for (const path of [
      'src/entrypoints/youtube.content.tsx',
      'src/app/WatchBetterRuntime.tsx',
      'src/app/WatchBetterApp.tsx',
      'src/features/ask/AskPanel.tsx',
      'src/features/detach/detached-video.ts',
    ])
      expect(read(path)).not.toMatch(/tabs\.create|windows\.create|window\.open/);

    const background = read('src/entrypoints/background.ts');
    // Background tab creation survives only behind explicit user actions.
    const tabCreations = background.match(/browser\.tabs\.create/g) ?? [];
    expect(tabCreations).toHaveLength(2);
    expect(background).not.toContain('browser.windows.create');
    expect(background).toContain("case 'webchat:open'");
    expect(background).toContain('chrome://extensions/?id=');
    expect(background).not.toContain('preloadProviderTab');
    expect(background).not.toContain("case 'webchat:preload'");
  });

  it('limits web chat to explicit typed provider actions', () => {
    const messages = read('src/messaging/messages.ts');
    const background = read('src/entrypoints/background.ts');
    expect(messages).toContain("readonly type: 'webchat:send'");
    expect(messages).toContain("readonly type: 'webchat:analyze'");
    expect(messages).toContain('readonly newConversation: boolean');
    expect(background).toContain("case 'webchat:send'");
    expect(background).toContain("case 'webchat:analyze'");
    expect(background).toContain('sendToProviderPage');
  });

  it('requests storage, scoped frame rules, and only supported hosts', () => {
    const config = read('wxt.config.ts');
    expect(config).toContain("minimum_chrome_version: '133'");
    expect(config).toContain(
      "permissions: ['storage', 'declarativeNetRequest', 'webNavigation']",
    );
    expect(config).toContain("'https://www.youtube.com/*'");
    expect(config).toContain("'https://chatgpt.com/*'");
    expect(config).toContain("'https://gemini.google.com/*'");
    expect(config).not.toContain('chat.deepseek.com');
    expect(config).not.toContain('api.openai.com');
    expect(config).not.toMatch(
      /tabCapture|scripting|<all_urls>|clipboardWrite|cookies|browsingData|webRequest/,
    );
  });

  it('declares cross-platform and high-contrast release safeguards', () => {
    const workflow = read('.github/workflows/ci.yml');
    const tokens = read('src/styles/tokens.css');
    expect(workflow).toContain('os: [ubuntu-latest, windows-latest, macos-latest]');
    expect(tokens).toContain('@media (prefers-contrast: more)');
    expect(tokens).toContain('@media (forced-colors: active)');
  });

  it('limits anti-frame rules to one prepared tab and provider frame', () => {
    const background = read('src/entrypoints/background.ts');
    const frameRule = read('src/services/web-chat-frame-rule.ts');
    expect(background).toContain('updateSessionRules');
    expect(frameRule).toContain('tabIds: [tabId]');
    expect(frameRule).toContain("resourceTypes: ['sub_frame' as const]");
    expect(frameRule).toContain("header: 'cross-origin-resource-policy'");
    expect(background).toContain('resetEmbeddedFramesForTab');
    expect(background).not.toContain('removeFrameRule(binding.ruleId)');
    expect(background).toContain('frame.parentFrameId !== 0');
    expect(background).toContain('`${tabId}:${providerId}:${sessionId}`');
    expect(background).toContain('loadEmbeddedFrame(tabId, providerId, sessionId)');
    expect(background).not.toMatch(/<all_urls>|main_frame|api\.openai/);
    expect(read('src/entrypoints/web-chat-frame-bypass.content.ts')).toContain(
      '#watchbetter-frame=',
    );
    expect(read('src/entrypoints/web-chat-frame-bypass.content.ts')).not.toContain(
      'chat.deepseek.com',
    );
    expect(read('src/services/web-chat.ts')).not.toMatch(/deepseek/i);
  });

  it('has no direct provider API or credential handling', () => {
    const production = [
      'src/entrypoints/background.ts',
      'src/entrypoints/web-chat.content.ts',
      'src/entrypoints/web-chat-frame-bypass.content.ts',
      'src/features/ask/AskPanel.tsx',
      'src/services/web-chat.ts',
    ]
      .map(read)
      .join('\n');
    expect(production).not.toMatch(
      /api\.openai\.com|generativelanguage\.googleapis|Authorization\s*:|Bearer\s|apiKey|credential|chrome\.cookies/,
    );
  });

  it('keeps transcript prompt construction free of network calls', () => {
    for (const path of [
      'src/features/ask/AskPanel.tsx',
      'src/features/ask/transcript-prompt-provider.ts',
    ])
      expect(read(path)).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/);
  });
});
