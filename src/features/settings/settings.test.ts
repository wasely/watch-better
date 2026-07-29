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
      pause: {
        enabled: true,
        preset: 'aggressive',
        minimumGapSeconds: -4,
        leadingPaddingSeconds: 99,
        trailingPaddingSeconds: 1.2,
        speechPlaybackRate: 100,
        gapPlaybackRate: 0,
        jumpLongGaps: true,
        jumpThresholdSeconds: 900,
      },
      chatgptHandoff: 'copy-only',
      transcriptCachePolicy: 'session',
    });

    expect(settings).toMatchObject({
      extensionEnabled: false,
      defaultTab: 'ask',
      transcriptFontSize: 'large',
      theme: 'light',
      panelCollapsed: true,
      chatgptHandoff: 'copy-only',
      transcriptCachePolicy: 'session',
      pause: {
        enabled: true,
        preset: 'aggressive',
        minimumGapSeconds: 0.5,
        leadingPaddingSeconds: 3,
        trailingPaddingSeconds: 1.2,
        speechPlaybackRate: 3,
        gapPlaybackRate: 1,
        jumpLongGaps: true,
        jumpThresholdSeconds: 60,
      },
    });
  });

  it('drops unknown enum values', () => {
    const settings = normalizeSettings({
      defaultTab: 'analytics',
      theme: 'neon',
      pause: { preset: 'reckless' },
    });

    expect(settings.defaultTab).toBe(DEFAULT_SETTINGS.defaultTab);
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.pause.preset).toBe(DEFAULT_SETTINGS.pause.preset);
  });
});
