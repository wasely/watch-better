import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('returns safe defaults for unknown input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('invalid')).toEqual(DEFAULT_SETTINGS);
  });

  it('preserves valid settings and clamps unsafe numeric values', () => {
    const settings = normalizeSettings({
      extensionEnabled: false,
      defaultTab: 'ask',
      autoLoadTranscript: false,
      autoFollowTranscript: false,
      transcriptFontSize: 'large',
      theme: 'light',
      panelCollapsed: true,
      smartSkip: {
        provider: 'chatgpt',
        strictness: 'aggressive',
        categories: ['sponsor', 'ramble', 'unknown', 'sponsor'],
        autoSkip: false,
      },
      transcriptCachePolicy: 'session',
    });

    expect(settings).toMatchObject({
      extensionEnabled: false,
      defaultTab: 'ask',
      transcriptFontSize: 'large',
      theme: 'light',
      panelCollapsed: true,
      transcriptCachePolicy: 'session',
      smartSkip: {
        provider: 'chatgpt',
        strictness: 'aggressive',
        categories: ['sponsor', 'ramble'],
        autoSkip: false,
      },
    });
  });

  it('drops unknown enum values', () => {
    const settings = normalizeSettings({
      defaultTab: 'analytics',
      theme: 'neon',
      smartSkip: { provider: 'deepseek', strictness: 'reckless' },
    });

    expect(settings.defaultTab).toBe(DEFAULT_SETTINGS.defaultTab);
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.smartSkip).toEqual(DEFAULT_SETTINGS.smartSkip);
  });

  it('migrates the legacy skip tab to Smart Skip', () => {
    expect(normalizeSettings({ defaultTab: 'skip' }).defaultTab).toBe('smart-skip');
  });
});
