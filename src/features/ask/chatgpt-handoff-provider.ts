import type {
  AIProvider,
  AIContextRequest,
  GeneratedPrompt,
} from '@/features/ask/ai-provider';
import type {
  TranscriptDocument,
  TranscriptSegment,
} from '@/features/transcript/domain';
import {
  findActiveSegmentIndex,
  formatTimestamp,
} from '@/features/transcript/transcript-utils';

const DEFAULT_CONTEXT_CHARACTER_LIMIT = 20_000;
const CURRENT_SECTION_RADIUS = 8;
const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'for',
  'from',
  'have',
  'how',
  'into',
  'list',
  'that',
  'the',
  'their',
  'this',
  'video',
  'what',
  'when',
  'where',
  'which',
  'with',
]);

const formatSegment = (segment: TranscriptSegment): string =>
  `[${formatTimestamp(segment.startSeconds)}] ${segment.text.trim()}`;

const queryTerms = (question: string): readonly string[] =>
  Array.from(
    new Set(
      question
        .normalize('NFKC')
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}_-]{3,}/gu)
        ?.filter((term) => !STOP_WORDS.has(term)) ?? [],
    ),
  );

const relevantIndexes = (
  document: TranscriptDocument,
  question: string,
): readonly number[] => {
  const terms = queryTerms(question);
  if (terms.length === 0) return [];

  return document.segments
    .map((segment, index) => {
      const text = segment.text.normalize('NFKC').toLocaleLowerCase();
      const score = terms.reduce(
        (total, term) => total + (text.includes(term) ? term.length : 0),
        0,
      );
      return { index, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ index }) => index);
};

const stratifiedIndexes = (length: number, targetCount: number): readonly number[] => {
  if (length <= targetCount) return Array.from({ length }, (_, index) => index);
  if (targetCount <= 1) return [0];

  return Array.from({ length: targetCount }, (_, index) =>
    Math.round((index * (length - 1)) / (targetCount - 1)),
  );
};

const expandRelevantIndexes = (
  ranked: readonly number[],
  segmentCount: number,
): readonly number[] => {
  const expanded = new Set<number>();
  for (const index of ranked) {
    expanded.add(index);
    if (index > 0) expanded.add(index - 1);
    if (index + 1 < segmentCount) expanded.add(index + 1);
  }
  return Array.from(expanded).sort((left, right) => left - right);
};

const sectionCenterIndex = (
  segments: readonly TranscriptSegment[],
  currentTimeSeconds: number | null,
): number => {
  if (segments.length === 0) return -1;
  const requestedTime =
    currentTimeSeconds !== null && Number.isFinite(currentTimeSeconds)
      ? Math.max(0, currentTimeSeconds)
      : 0;
  const activeIndex = findActiveSegmentIndex(segments, requestedTime);
  if (activeIndex >= 0) return activeIndex;

  const nextIndex = segments.findIndex(
    (segment) => segment.startSeconds > requestedTime,
  );
  if (nextIndex < 0) return segments.length - 1;
  return Math.max(0, nextIndex - 1);
};

const indexesForRequest = (request: AIContextRequest): readonly number[] => {
  const segments = request.transcript.segments;

  if (request.scope === 'selection') {
    return segments
      .map((segment, index) =>
        request.selectedSegmentIds.has(segment.id) ? index : -1,
      )
      .filter((index) => index >= 0);
  }

  if (request.scope === 'current-section') {
    const center = sectionCenterIndex(segments, request.currentTimeSeconds);
    if (center < 0) return [];
    const start = Math.max(0, center - CURRENT_SECTION_RADIUS);
    const end = Math.min(segments.length, center + CURRENT_SECTION_RADIUS + 1);
    return Array.from({ length: end - start }, (_, offset) => start + offset);
  }

  return Array.from({ length: segments.length }, (_, index) => index);
};

interface ContextSelection {
  readonly lines: readonly string[];
  readonly includedCount: number;
  readonly omittedCount: number;
  readonly truncated: boolean;
}

const selectContext = (request: AIContextRequest, limit: number): ContextSelection => {
  const allIndexes = indexesForRequest(request);
  let candidateIndexes = allIndexes;

  if (request.scope === 'entire-video') {
    const fullContextLength = allIndexes.reduce((total, index) => {
      const segment = request.transcript.segments[index];
      return segment ? total + formatSegment(segment).length + 1 : total;
    }, 0);
    const relevant =
      fullContextLength > limit
        ? relevantIndexes(request.transcript, request.question)
        : [];
    if (relevant.length > 0) {
      candidateIndexes = expandRelevantIndexes(
        relevant,
        request.transcript.segments.length,
      );
    }
  }

  const lines: string[] = [];
  let characterCount = 0;
  let truncatedLine = false;

  for (const index of candidateIndexes) {
    const segment = request.transcript.segments[index];
    if (!segment) continue;
    const line = formatSegment(segment);
    const remaining = limit - characterCount;
    if (remaining <= 0) break;

    if (line.length + 1 > remaining) {
      if (remaining > 40) {
        const shortenedLine = `${line.slice(0, remaining - 2).trimEnd()}…`;
        lines.push(shortenedLine);
        characterCount += shortenedLine.length + 1;
        truncatedLine = true;
      }
      break;
    }

    lines.push(line);
    characterCount += line.length + 1;
  }

  if (
    request.scope === 'entire-video' &&
    candidateIndexes.length === allIndexes.length &&
    lines.length < allIndexes.length
  ) {
    const averageLineLength = Math.max(
      1,
      Math.round(characterCount / Math.max(1, lines.length)),
    );
    const targetCount = Math.max(2, Math.floor(limit / averageLineLength));
    const sampleIndexes = stratifiedIndexes(allIndexes.length, targetCount);
    lines.length = 0;
    characterCount = 0;
    for (const index of sampleIndexes) {
      const segment = request.transcript.segments[index];
      if (!segment) continue;
      const line = formatSegment(segment);
      if (characterCount + line.length + 1 > limit) break;
      lines.push(line);
      characterCount += line.length + 1;
    }
    candidateIndexes = sampleIndexes;
  }

  const includedCount = lines.length;
  const sourceCount =
    request.scope === 'entire-video'
      ? request.transcript.segments.length
      : allIndexes.length;

  return {
    lines,
    includedCount,
    omittedCount: Math.max(0, sourceCount - includedCount),
    truncated:
      truncatedLine ||
      includedCount < sourceCount ||
      candidateIndexes.length < allIndexes.length,
  };
};

const scopeLabel = (scope: AIContextRequest['scope']): string => {
  switch (scope) {
    case 'entire-video':
      return 'Entire video';
    case 'current-section':
      return 'Current section';
    case 'selection':
      return 'Selected transcript rows';
  }
};

export class ChatGPTHandoffProvider implements AIProvider {
  public readonly id = 'chatgpt-handoff';
  public readonly displayName = 'ChatGPT handoff';
  readonly #contextCharacterLimit: number;

  public constructor(contextCharacterLimit = DEFAULT_CONTEXT_CHARACTER_LIMIT) {
    this.#contextCharacterLimit = Math.max(1_000, contextCharacterLimit);
  }

  public buildPrompt(request: AIContextRequest): GeneratedPrompt {
    const context = selectContext(request, this.#contextCharacterLimit);
    const sourceUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(
      request.transcript.videoId,
    )}`;
    const limitation = context.truncated
      ? '\nCONTEXT LIMITATION\nCutThrough omitted some transcript content to keep this handoff bounded. Do not imply that missing context was checked. Ask for more context when needed.\n'
      : '';
    const text = [
      'You are helping a creator or researcher analyze a YouTube video.',
      '',
      'SOURCE',
      `Title: ${request.transcript.videoTitle}`,
      `URL: ${sourceUrl}`,
      `Context scope: ${scopeLabel(request.scope)}`,
      '',
      'TASK',
      request.question.trim(),
      '',
      'RULES',
      '- Use only the supplied transcript context for video-specific claims.',
      '- Cite claims with the supplied [timestamp] markers.',
      '- Separate direct evidence from inference.',
      '- Say when the supplied context is insufficient.',
      limitation.trim(),
      'TRANSCRIPT CONTEXT',
      ...context.lines,
    ]
      .filter((line, index, values) => line !== '' || values[index - 1] !== '')
      .join('\n')
      .trim();

    return {
      text,
      characterCount: text.length,
      includedSegmentCount: context.includedCount,
      omittedSegmentCount: context.omittedCount,
      wasTruncated: context.truncated,
    };
  }
}
