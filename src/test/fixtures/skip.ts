import type {
  SkipConfiguration,
  SkipEngineSnapshot,
} from '@/features/skip/skip-engine';
import { configurationForSkipPreset } from '@/features/skip/skip-presets';

export type SkipFixtureId =
  'off' | 'waiting' | 'ready' | 'active' | 'aggressive' | 'unsupported' | 'error';

export interface SkipFixture {
  readonly label: string;
  readonly configuration: SkipConfiguration;
  readonly snapshot: SkipEngineSnapshot;
  readonly advancedOpen?: boolean;
}

export const skipFixtures: Readonly<Record<SkipFixtureId, SkipFixture>> = {
  off: {
    label: 'Off by default',
    configuration: configurationForSkipPreset('conservative', false),
    snapshot: {
      state: 'disabled',
      timeSavedSeconds: 0,
      message: 'No playback changes are active.',
    },
  },
  waiting: {
    label: 'Waiting for transcript',
    configuration: configurationForSkipPreset('conservative', true),
    snapshot: {
      state: 'waiting-for-transcript',
      timeSavedSeconds: 0,
      message: 'Waiting for stable caption timing before acting.',
    },
  },
  ready: {
    label: 'Ready',
    configuration: configurationForSkipPreset('conservative', true),
    snapshot: {
      state: 'ready',
      timeSavedSeconds: 0,
      message: 'Candidate gaps are ready; speech remains at 1×.',
    },
  },
  active: {
    label: 'Active balanced',
    configuration: configurationForSkipPreset('balanced', true),
    snapshot: {
      state: 'active',
      timeSavedSeconds: 73,
      message: 'Compressing a reliable caption gap at 3×.',
    },
    advancedOpen: true,
  },
  aggressive: {
    label: 'Aggressive warning',
    configuration: configurationForSkipPreset('aggressive', true),
    snapshot: {
      state: 'ready',
      timeSavedSeconds: 314,
      message: 'Aggressive candidate timing is ready.',
    },
  },
  unsupported: {
    label: 'Unsupported player',
    configuration: configurationForSkipPreset('conservative', false),
    snapshot: {
      state: 'unsupported',
      timeSavedSeconds: 0,
      message: 'Live, ad, and unsupported player states are never modified.',
    },
  },
  error: {
    label: 'Safe error',
    configuration: configurationForSkipPreset('balanced', true),
    snapshot: {
      state: 'error',
      timeSavedSeconds: 41,
      message: 'Timing became invalid. Playback was restored and detection stopped.',
    },
  },
};
