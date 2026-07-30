import { describe, expect, it } from 'vitest';

import { configurationForSkipPreset, findMatchingSkipPreset } from './skip-presets';

describe('skip presets', () => {
  it('creates complete immutable-style configurations with requested enablement', () => {
    const configuration = configurationForSkipPreset('balanced', true);

    expect(configuration).toMatchObject({
      enabled: true,
      preset: 'balanced',
      minimumGapSeconds: 1.8,
      speechPlaybackRate: 1,
      gapPlaybackRate: 3,
      jumpLongGaps: false,
    });
  });

  it('recognizes exact presets and rejects customized timing', () => {
    const configuration = configurationForSkipPreset('conservative', false);

    expect(findMatchingSkipPreset(configuration)).toBe('conservative');
    expect(
      findMatchingSkipPreset({ ...configuration, minimumGapSeconds: 2.2 }),
    ).toBeNull();
  });
});
