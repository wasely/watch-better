export type TranscriptSegmentId = string;

export interface TranscriptSegment {
  readonly id: TranscriptSegmentId;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly text: string;
}

export interface TranscriptTrack {
  readonly id: string;
  readonly languageCode: string;
  readonly languageLabel: string;
  readonly isAutomatic: boolean | null;
}

export interface TranscriptDocument {
  readonly videoId: string;
  readonly videoTitle: string;
  readonly languageCode: string;
  readonly languageLabel: string;
  readonly isAutomatic: boolean | null;
  readonly durationSeconds: number | null;
  readonly segments: readonly TranscriptSegment[];
}

export interface TranscriptRequest {
  readonly videoId: string;
  readonly trackId: string | null;
}

export type TranscriptFailureCode =
  'disabled' | 'unavailable' | 'extraction-failed' | 'invalid-data';

export class TranscriptProviderError extends Error {
  public readonly code: TranscriptFailureCode;

  public constructor(code: TranscriptFailureCode, message: string) {
    super(message);
    this.name = 'TranscriptProviderError';
    this.code = code;
  }
}

export interface TranscriptProvider {
  listTracks(videoId: string, signal: AbortSignal): Promise<readonly TranscriptTrack[]>;
  load(request: TranscriptRequest, signal: AbortSignal): Promise<TranscriptDocument>;
}
