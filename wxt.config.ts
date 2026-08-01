import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'WatchBetter',
    description:
      'Navigate YouTube transcripts, ask ChatGPT or Gemini, and conservatively jump caption gaps.',
    permissions: ['storage', 'declarativeNetRequest', 'webNavigation'],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
    ],
    action: {
      default_title: 'WatchBetter',
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: 'provider_frame_rules',
          enabled: true,
          path: 'rules/provider-frame-rules.json',
        },
      ],
    },
  },
});
