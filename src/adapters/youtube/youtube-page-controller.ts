export type YouTubePageKind = 'watch' | 'unsupported';

export interface YouTubePageSnapshot {
  readonly kind: YouTubePageKind;
  readonly url: string;
  readonly videoId: string | null;
  readonly generation: number;
}

export interface YouTubePageController {
  readonly snapshot: YouTubePageSnapshot;
  start(): void;
  subscribe(listener: (snapshot: YouTubePageSnapshot) => void): () => void;
  dispose(): void;
}
