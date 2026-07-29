import type {
  TranscriptDocument,
  TranscriptSegmentId,
} from '@/features/transcript/domain';

export type AIContextScope = 'entire-video' | 'current-section' | 'selection';

export interface AIContextRequest {
  readonly transcript: TranscriptDocument;
  readonly scope: AIContextScope;
  readonly currentTimeSeconds: number | null;
  readonly selectedSegmentIds: ReadonlySet<TranscriptSegmentId>;
  readonly question: string;
}

export interface GeneratedPrompt {
  readonly text: string;
  readonly characterCount: number;
  readonly includedSegmentCount: number;
  readonly omittedSegmentCount: number;
  readonly wasTruncated: boolean;
}

export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  buildPrompt(request: AIContextRequest): GeneratedPrompt;
}
