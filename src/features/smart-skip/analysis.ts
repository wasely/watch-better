import type {
  TranscriptDocument,
  TranscriptSegment,
} from '@/features/transcript/domain';

import {
  SMART_SKIP_CATEGORIES,
  type SmartSkipAnalysis,
  type SmartSkipCategory,
  type SmartSkipConfiguration,
  type SmartSkipInterval,
} from './domain';

const DEFAULT_PROMPT_LIMIT = 22_000;
const PROMPT_RESERVE = 2_300;
const MAX_REASON_CHARACTERS = 180;
const MAX_ANALYSIS_CHUNKS = 10;
const categorySet = new Set<string>(SMART_SKIP_CATEGORIES);

export interface SmartSkipAnalysisChunk {
  readonly index: number;
  readonly total: number;
  readonly firstSegmentIndex: number;
  readonly lastSegmentIndex: number;
  readonly prompt: string;
}

interface RawCut {
  readonly start: number;
  readonly end: number;
  readonly category: SmartSkipCategory;
  readonly reason: string;
  readonly confidence: number;
}

export interface SmartSkipAnalysisResult {
  readonly intervals: readonly SmartSkipInterval[];
  readonly reviewRequired: boolean;
}

const cleanText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const formatSegment = (segment: TranscriptSegment, index: number): string =>
  `${index}|${segment.startSeconds.toFixed(2)}|${segment.endSeconds.toFixed(2)}|${cleanText(segment.text)}`;

const analysisPrompt = (
  lines: readonly string[],
  configuration: SmartSkipConfiguration,
  chunkIndex: number,
  chunkTotal: number,
): string =>
  [
    'You are the ruthless but accurate editor behind Smart Skip. Shorten the video by removing every span that adds no new viewer value without losing its promised information, reasoning, evidence, or instructions.',
    `This is chunk ${chunkIndex + 1} of ${chunkTotal}. Judge every supplied line, including material buried in the middle.`,
    `Cut policy: ${{ conservative: 'safe', balanced: 'strict', aggressive: 'maximum' }[configuration.strictness]}.`,
    `Allowed categories: ${configuration.categories.join(', ')}.`,
    '',
    'Return JSON only in exactly this shape:',
    '{"cuts":[{"start":12,"end":18,"category":"sponsor","reason":"Paid promotion","confidence":0.96}]}',
    '',
    'Rules:',
    '- start and end are inclusive transcript line indexes from the first column.',
    '- Join adjacent lines belonging to one unnecessary section.',
    '- Scan the entire chunk. Do not focus only on intros, sponsors, and outros.',
    '- Cut redundant restatements, disposable tangents or anecdotes, housekeeping, technical fumbling, false starts, verbal filler, engagement bait, sponsor transitions, and conclusions that only repeat earlier points.',
    '- Include complete low-value spans around an obvious cut, not only the single line containing a keyword.',
    '- Treat channel updates, production commentary, repeated setup, unnecessary recaps, and self-referential chatter as removable unless later content depends on them.',
    '- Preserve explanations, evidence, examples that teach something, necessary transitions, caveats, and context needed to understand later material.',
    '- Ramble means a coherent span whose removal makes the surrounding useful content connect naturally. Informal speech alone is not ramble.',
    '- Repetition requires the same substantive point to have already been made; keep the clearest version.',
    '- Strict should remove likely low-value material whenever the surrounding useful sections reconnect cleanly. Safe cuts only explicit non-content. Maximum also removes marginal asides and overlong examples.',
    '- Prefer complete thoughts and natural edit boundaries. Never cut half of a useful sentence.',
    '- Reasons must be specific and 3 to 10 words, such as "Repeats the previous workflow explanation".',
    '- Use confidence from 0 to 1. Include a likely removable span at 0.72 or above under Strict, and 0.62 or above under Maximum.',
    '- Never invent indexes or categories. Return {"cuts":[]} when nothing qualifies.',
    '',
    'TRANSCRIPT LINES (index|start seconds|end seconds|text)',
    ...lines,
  ].join('\n');

export const buildSmartSkipAnalysisChunks = (
  document: TranscriptDocument,
  configuration: SmartSkipConfiguration,
  promptLimit = DEFAULT_PROMPT_LIMIT,
): readonly SmartSkipAnalysisChunk[] => {
  const lineLimit = Math.max(600, promptLimit - PROMPT_RESERVE);
  const groups: { lines: string[]; indexes: number[] }[] = [];
  let current = { lines: [] as string[], indexes: [] as number[] };
  let length = 0;

  document.segments.forEach((segment, index) => {
    const line = formatSegment(segment, index);
    if (current.lines.length > 0 && length + line.length + 1 > lineLimit) {
      groups.push(current);
      const overlapLine = current.lines.at(-1);
      const overlapIndex = current.indexes.at(-1);
      const keepOverlap =
        overlapLine !== undefined &&
        overlapIndex !== undefined &&
        overlapLine.length + line.length + 2 <= lineLimit;
      current = {
        lines: keepOverlap ? [overlapLine] : [],
        indexes: keepOverlap ? [overlapIndex] : [],
      };
      length = keepOverlap ? overlapLine.length + 1 : 0;
    }
    current.lines.push(line.slice(0, lineLimit));
    current.indexes.push(index);
    length += line.length + 1;
  });
  if (current.lines.length > 0) groups.push(current);

  if (groups.length > MAX_ANALYSIS_CHUNKS)
    throw new Error(
      `This transcript needs ${groups.length} analysis passes. Smart Skip supports up to ${MAX_ANALYSIS_CHUNKS}.`,
    );

  return groups.map((group, index) => {
    const firstSegmentIndex = group.indexes[0];
    const lastSegmentIndex = group.indexes.at(-1);
    if (firstSegmentIndex === undefined || lastSegmentIndex === undefined)
      throw new Error('Smart Skip produced an empty analysis chunk.');
    const prompt = analysisPrompt(group.lines, configuration, index, groups.length);
    if (prompt.length > promptLimit)
      throw new Error('A transcript line is too large for Smart Skip analysis.');
    return {
      index,
      total: groups.length,
      firstSegmentIndex,
      lastSegmentIndex,
      prompt,
    };
  });
};

const parseJson = (text: string): unknown => {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart)
    candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart)
    candidates.push(trimmed.slice(arrayStart, arrayEnd + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next bounded JSON candidate.
    }
  }
  throw new Error('The AI response did not contain valid Smart Skip JSON.');
};

const rawCutsFrom = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object' || value === null)
    throw new Error('The AI response did not contain a Smart Skip action list.');
  const cuts = (value as { readonly cuts?: unknown }).cuts;
  if (!Array.isArray(cuts))
    throw new Error('The AI response did not contain a Smart Skip action list.');
  return cuts;
};

export const parseSmartSkipAnalysisResponse = (
  text: string,
  chunk: SmartSkipAnalysisChunk,
): readonly RawCut[] =>
  rawCutsFrom(parseJson(text)).flatMap((value): RawCut[] => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
    const cut = value as Record<string, unknown>;
    const start = cut.start;
    const end = cut.end;
    const category = cut.category;
    const reason = cut.reason;
    const confidence = cut.confidence;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      start < chunk.firstSegmentIndex ||
      end > chunk.lastSegmentIndex ||
      end < start ||
      typeof category !== 'string' ||
      !categorySet.has(category) ||
      typeof reason !== 'string' ||
      !reason.trim() ||
      typeof confidence !== 'number' ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    )
      return [];
    return [
      {
        start,
        end,
        category: category as SmartSkipCategory,
        reason: cleanText(reason).slice(0, MAX_REASON_CHARACTERS),
        confidence,
      },
    ];
  });

const confidenceThreshold = (
  category: SmartSkipCategory,
  strictness: SmartSkipConfiguration['strictness'],
): number => {
  const subjective = category === 'ramble' || category === 'repetition';
  if (strictness === 'conservative') return subjective ? 0.95 : 0.9;
  if (strictness === 'aggressive') return subjective ? 0.62 : 0.6;
  return subjective ? 0.72 : 0.68;
};

export const normalizeSmartSkipIntervals = (
  rawCuts: readonly RawCut[],
  document: TranscriptDocument,
  configuration: SmartSkipConfiguration,
): SmartSkipAnalysisResult => {
  const enabledCategories = new Set(configuration.categories);
  const candidates = rawCuts.flatMap((cut): SmartSkipInterval[] => {
    const startSegment = document.segments[cut.start];
    const endSegment = document.segments[cut.end];
    if (
      !startSegment ||
      !endSegment ||
      !enabledCategories.has(cut.category) ||
      cut.confidence < confidenceThreshold(cut.category, configuration.strictness)
    )
      return [];
    const startSeconds = startSegment.startSeconds;
    const endSeconds = endSegment.endSeconds;
    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      endSeconds - startSeconds < 1.5
    )
      return [];
    return [
      {
        id: `${document.videoId}:${cut.start}-${cut.end}`,
        startSegmentIndex: cut.start,
        endSegmentIndex: cut.end,
        startSeconds,
        endSeconds,
        category: cut.category,
        reason: cut.reason,
        confidence: cut.confidence,
        enabled: true,
        action: 'skip',
        source: 'deep',
      },
    ];
  });

  candidates.sort(
    (left, right) =>
      left.startSeconds - right.startSeconds || right.confidence - left.confidence,
  );
  const intervals: SmartSkipInterval[] = [];
  for (const candidate of candidates) {
    const previous = intervals.at(-1);
    if (!previous || candidate.startSeconds > previous.endSeconds + 0.25) {
      intervals.push(candidate);
      continue;
    }
    const preferred = candidate.confidence > previous.confidence ? candidate : previous;
    intervals[intervals.length - 1] = {
      ...preferred,
      id: `${document.videoId}:${Math.min(previous.startSegmentIndex, candidate.startSegmentIndex)}-${Math.max(previous.endSegmentIndex, candidate.endSegmentIndex)}`,
      startSegmentIndex: Math.min(
        previous.startSegmentIndex,
        candidate.startSegmentIndex,
      ),
      endSegmentIndex: Math.max(previous.endSegmentIndex, candidate.endSegmentIndex),
      startSeconds: Math.min(previous.startSeconds, candidate.startSeconds),
      endSeconds: Math.max(previous.endSeconds, candidate.endSeconds),
    };
  }

  const cutDuration = intervals.reduce(
    (total, interval) => total + interval.endSeconds - interval.startSeconds,
    0,
  );
  const duration =
    document.durationSeconds ?? document.segments.at(-1)?.endSeconds ?? 0;
  return {
    intervals,
    reviewRequired: duration > 0 && cutDuration / duration > 0.35,
  };
};

const overlapSeconds = (left: SmartSkipInterval, right: SmartSkipInterval): number =>
  Math.max(
    0,
    Math.min(left.endSeconds, right.endSeconds) -
      Math.max(left.startSeconds, right.startSeconds),
  );

/** Merges a later semantic pass into the already-active local map. */
export const mergeSmartSkipAnalyses = (
  instant: SmartSkipAnalysis,
  deep: SmartSkipAnalysisResult,
  durationSeconds?: number | null,
): SmartSkipAnalysis => {
  const ordered = [...instant.intervals, ...deep.intervals].sort(
    (left, right) =>
      left.startSeconds - right.startSeconds || right.confidence - left.confidence,
  );
  const merged: SmartSkipInterval[] = [];

  for (const interval of ordered) {
    const candidate = {
      ...interval,
      source:
        interval.source ?? (interval.id.includes(':instant-') ? 'instant' : 'deep'),
    } satisfies SmartSkipInterval;
    const previous = merged.at(-1);
    const touches =
      previous &&
      (overlapSeconds(previous, candidate) > 0 ||
        (previous.source === candidate.source &&
          previous.category === candidate.category &&
          candidate.startSeconds <= previous.endSeconds + 0.35));
    if (!previous || !touches) {
      merged.push(candidate);
      continue;
    }

    const preferred =
      candidate.source === 'deep' || candidate.confidence > previous.confidence
        ? candidate
        : previous;
    const source = preferred.source === 'instant' ? 'instant' : 'deep';
    merged[merged.length - 1] = {
      ...preferred,
      id: `${instant.videoId}:${source}-${Math.min(previous.startSegmentIndex, candidate.startSegmentIndex)}-${Math.max(previous.endSegmentIndex, candidate.endSegmentIndex)}`,
      startSegmentIndex: Math.min(
        previous.startSegmentIndex,
        candidate.startSegmentIndex,
      ),
      endSegmentIndex: Math.max(previous.endSegmentIndex, candidate.endSegmentIndex),
      startSeconds: Math.min(previous.startSeconds, candidate.startSeconds),
      endSeconds: Math.max(previous.endSeconds, candidate.endSeconds),
      confidence: Math.max(previous.confidence, candidate.confidence),
      enabled: previous.enabled && candidate.enabled,
      action: 'skip',
      source,
    };
  }

  const duration =
    typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : 0;
  const maximumEnabledDuration = duration * 0.35;
  const instantDuration = merged.reduce(
    (total, interval) =>
      interval.enabled &&
      interval.source !== 'deep' &&
      (interval.action ?? 'skip') === 'skip'
        ? total + interval.endSeconds - interval.startSeconds
        : total,
    0,
  );
  let remainingDeepDuration = Math.max(0, maximumEnabledDuration - instantDuration);
  const enabledDeepIds = new Set<string>();
  for (const interval of [...merged]
    .filter((candidate) => candidate.enabled && candidate.source === 'deep')
    .sort((left, right) => right.confidence - left.confidence)) {
    const intervalDuration = interval.endSeconds - interval.startSeconds;
    if (duration <= 0) {
      enabledDeepIds.add(interval.id);
      continue;
    }
    if (intervalDuration > remainingDeepDuration) continue;
    enabledDeepIds.add(interval.id);
    remainingDeepDuration -= intervalDuration;
  }
  const intervals = merged.map((interval) =>
    interval.source === 'deep'
      ? { ...interval, enabled: interval.enabled && enabledDeepIds.has(interval.id) }
      : interval,
  );
  const safetyCapApplied = intervals.some(
    (interval, index) => interval.enabled !== merged[index]?.enabled,
  );
  return {
    ...instant,
    intervals,
    analyzedAt: Date.now(),
    reviewRequired: instant.reviewRequired || deep.reviewRequired || safetyCapApplied,
  };
};

export const transcriptFingerprint = (document: TranscriptDocument): string => {
  let hash = 0x811c9dc5;
  const update = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
  };

  update(`duration|${document.durationSeconds ?? 'unknown'}\n`);
  for (const range of document.speechRanges ?? [])
    update(`speech|${range.startSeconds}|${range.endSeconds}\n`);
  for (const segment of document.segments)
    update(`${segment.startSeconds}|${segment.endSeconds}|${segment.text}\n`);
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const smartSkipAnalysisCacheKey = (
  document: TranscriptDocument,
  trackId: string,
  configuration: SmartSkipConfiguration,
): string =>
  [
    document.videoId,
    trackId,
    transcriptFingerprint(document),
    configuration.provider,
    configuration.strictness,
    [...configuration.categories].sort().join(','),
    'skip-v9',
  ].join(':');
