import { describe, expect, it } from 'vitest';

import { buildFrameRule, frameRuleId } from './web-chat-frame-rule';

describe('embedded provider frame rules', () => {
  it('creates deterministic provider-specific session rule IDs', () => {
    expect(frameRuleId(42, 'chatgpt')).toBe(frameRuleId(42, 'chatgpt'));
    expect(frameRuleId(42, 'chatgpt')).not.toBe(frameRuleId(42, 'gemini'));
    expect(frameRuleId(42, 'chatgpt')).not.toBe(frameRuleId(43, 'chatgpt'));
  });

  it.each([
    ['chatgpt', 'chatgpt.com'],
    ['gemini', 'gemini.google.com'],
  ] as const)('limits %s to its exact provider subframe', (provider, hostname) => {
    const rule = buildFrameRule(73, provider);

    expect(rule.condition).toEqual({
      tabIds: [73],
      requestDomains: [hostname],
      resourceTypes: ['sub_frame'],
    });
    expect(rule.action.responseHeaders.map(({ header }) => header)).toEqual([
      'x-frame-options',
      'frame-options',
      'content-security-policy',
      'content-security-policy-report-only',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
    ]);
    expect(rule.action.requestHeaders.map(({ header }) => header)).toEqual([
      'sec-fetch-dest',
      'sec-fetch-mode',
      'sec-fetch-site',
    ]);
  });
});
