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
      'src/app/CutThroughRuntime.tsx',
    ]) {
      expect(read(path)).not.toMatch(/@\/test|src\/test|fixtures\//);
    }
  });

  it('keeps ChatGPT handoff explicit and content-free', () => {
    const messages = read('src/messaging/messages.ts');
    const background = read('src/entrypoints/background.ts');
    expect(messages).toContain("{ readonly type: 'chatgpt:open' }");
    expect(background).toContain(
      "browser.tabs.create({ url: 'https://chatgpt.com/' })",
    );
    expect(background).not.toMatch(/chatgpt.*prompt|prompt.*chatgpt/is);
  });

  it('requests only storage and the YouTube host', () => {
    const config = read('wxt.config.ts');
    expect(config).toContain("permissions: ['storage']");
    expect(config).toContain("host_permissions: ['https://www.youtube.com/*']");
    expect(config).not.toMatch(/tabCapture|scripting|<all_urls>|clipboardWrite/);
  });

  it('has no network call in Ask feature code', () => {
    for (const path of [
      'src/features/ask/AskPanel.tsx',
      'src/features/ask/chatgpt-handoff-provider.ts',
    ])
      expect(read(path)).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/);
  });
});
