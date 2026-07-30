import type { SkipConfiguration, SkipPresetId } from '@/features/skip/skip-engine';

export interface SkipPresetDefinition {
  readonly id: SkipPresetId;
  readonly label: string;
  readonly description: string;
  readonly configuration: Omit<SkipConfiguration, 'enabled'>;
}

export const SKIP_PRESETS: readonly SkipPresetDefinition[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Only clearer, longer gaps',
    configuration: {
      preset: 'conservative',
      minimumGapSeconds: 2.5,
      leadingPaddingSeconds: 0.35,
      trailingPaddingSeconds: 0.25,
      speechPlaybackRate: 1,
      gapPlaybackRate: 2,
      jumpLongGaps: false,
      jumpThresholdSeconds: 8,
    },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'More gaps, speech unchanged',
    configuration: {
      preset: 'balanced',
      minimumGapSeconds: 1.8,
      leadingPaddingSeconds: 0.25,
      trailingPaddingSeconds: 0.2,
      speechPlaybackRate: 1,
      gapPlaybackRate: 3,
      jumpLongGaps: false,
      jumpThresholdSeconds: 8,
    },
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Short gaps and long-gap jumps',
    configuration: {
      preset: 'aggressive',
      minimumGapSeconds: 1.2,
      leadingPaddingSeconds: 0.15,
      trailingPaddingSeconds: 0.15,
      speechPlaybackRate: 1,
      gapPlaybackRate: 4,
      jumpLongGaps: true,
      jumpThresholdSeconds: 7,
    },
  },
];

export const getSkipPreset = (id: SkipPresetId): SkipPresetDefinition => {
  const preset = SKIP_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown skip preset: ${id}`);
  return preset;
};

export const configurationForSkipPreset = (
  id: SkipPresetId,
  enabled: boolean,
): SkipConfiguration => ({
  enabled,
  ...getSkipPreset(id).configuration,
});

const comparableKeys = [
  'minimumGapSeconds',
  'leadingPaddingSeconds',
  'trailingPaddingSeconds',
  'speechPlaybackRate',
  'gapPlaybackRate',
  'jumpLongGaps',
  'jumpThresholdSeconds',
] as const satisfies readonly (keyof SkipConfiguration)[];

export const findMatchingSkipPreset = (
  configuration: SkipConfiguration,
): SkipPresetId | null =>
  SKIP_PRESETS.find((preset) =>
    comparableKeys.every((key) => preset.configuration[key] === configuration[key]),
  )?.id ?? null;
