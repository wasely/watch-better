import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Watch Better',
    minimum_chrome_version: '111',
    description:
      'Navigate YouTube transcripts and ask ChatGPT, Gemini, or DeepSeek from one focused companion.',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    permissions: ['storage', 'declarativeNetRequest', 'webNavigation'],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
      'https://chat.deepseek.com/*',
    ],
    action: {
      default_title: 'Watch Better',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
  },
});
