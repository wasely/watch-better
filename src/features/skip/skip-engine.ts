export type SkipPresetId = 'conservative' | 'balanced' | 'aggressive';

export interface SkipConfiguration {
  readonly enabled: boolean;
  readonly preset: SkipPresetId;
  readonly minimumGapSeconds: number;
  readonly leadingPaddingSeconds: number;
  readonly trailingPaddingSeconds: number;
  readonly speechPlaybackRate: number;
  readonly gapPlaybackRate: number;
  readonly jumpLongGaps: boolean;
  readonly jumpThresholdSeconds: number;
}

export type SkipDetectionState =
  'disabled' | 'waiting-for-transcript' | 'ready' | 'active' | 'unsupported' | 'error';

export interface SkipEngineSnapshot {
  readonly state: SkipDetectionState;
  readonly timeSavedSeconds: number;
  readonly message: string | null;
}

export interface SkipEngine {
  readonly snapshot: SkipEngineSnapshot;
  enable(configuration: SkipConfiguration): void;
  update(configuration: SkipConfiguration): void;
  disable(): void;
  subscribe(listener: (snapshot: SkipEngineSnapshot) => void): () => void;
  dispose(): void;
}
