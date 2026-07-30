import type { TranscriptDocument, TranscriptTrack } from '@/features/transcript/domain';

export type TranscriptViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'disabled' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready';
      readonly document: TranscriptDocument;
      readonly tracks: readonly TranscriptTrack[];
      readonly selectedTrackId: string;
    };

export const LOADING_TRANSCRIPT_STATE: TranscriptViewState = Object.freeze({
  kind: 'loading',
});
