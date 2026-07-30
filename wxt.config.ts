import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'CutThrough',
    description:
      'Navigate YouTube transcripts, ask ChatGPT, and conservatively jump caption gaps.',
    permissions: ['storage'],
    host_permissions: ['https://www.youtube.com/*', 'https://api.openai.com/*'],
    action: {
      default_title: 'CutThrough',
    },
  },
});
