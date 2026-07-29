import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'CutThrough',
    description:
      'Navigate YouTube transcripts, prepare ChatGPT prompts, and conservatively compress pauses.',
    permissions: ['storage'],
    host_permissions: ['https://www.youtube.com/*'],
    action: {
      default_title: 'CutThrough',
    },
  },
});
