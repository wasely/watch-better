export interface PlaybackSnapshot {
  readonly currentTimeSeconds: number;
  readonly durationSeconds: number | null;
  readonly playbackRate: number;
  readonly paused: boolean;
  readonly adActive: boolean;
  readonly supported: boolean;
}

export interface PlaybackController {
  readonly snapshot: PlaybackSnapshot;
  seek(seconds: number): void;
  setPlaybackRate(rate: number): void;
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
  dispose(): void;
}
