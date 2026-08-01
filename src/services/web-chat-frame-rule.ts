import { WEB_CHAT_PROVIDERS, type WebChatProviderId } from '@/services/web-chat';

export const frameRuleId = (tabId: number, providerId: WebChatProviderId): number => {
  let hash = 2_166_136_261;
  for (const character of `${tabId}:${providerId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return 1_000_000 + ((hash >>> 0) % 1_000_000_000);
};

export const buildFrameRule = (tabId: number, providerId: WebChatProviderId) => ({
  id: frameRuleId(tabId, providerId),
  priority: 1,
  action: {
    type: 'modifyHeaders' as const,
    responseHeaders: [
      { header: 'x-frame-options', operation: 'remove' as const },
      { header: 'frame-options', operation: 'remove' as const },
      { header: 'content-security-policy', operation: 'remove' as const },
      {
        header: 'content-security-policy-report-only',
        operation: 'remove' as const,
      },
      { header: 'cross-origin-opener-policy', operation: 'remove' as const },
      { header: 'cross-origin-embedder-policy', operation: 'remove' as const },
      { header: 'cross-origin-resource-policy', operation: 'remove' as const },
    ],
    requestHeaders: [
      { header: 'sec-fetch-dest', operation: 'remove' as const },
      { header: 'sec-fetch-mode', operation: 'remove' as const },
      { header: 'sec-fetch-site', operation: 'remove' as const },
    ],
  },
  condition: {
    tabIds: [tabId],
    requestDomains: [new URL(WEB_CHAT_PROVIDERS[providerId].url).hostname],
    resourceTypes: ['sub_frame' as const],
  },
});
