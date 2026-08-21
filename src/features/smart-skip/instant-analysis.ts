import type { TranscriptDocument } from '@/features/transcript/domain';

import type {
  SmartSkipAnalysis,
  SmartSkipCategory,
  SmartSkipConfiguration,
  SmartSkipInterval,
} from './domain';
import { transcriptFingerprint } from './analysis';

const OPENING_SECONDS: Readonly<Record<SmartSkipConfiguration['strictness'], number>> =
  Object.freeze({
    conservative: 4,
    balanced: 12,
    aggressive: 18,
  });

const INTRO_PATTERNS = [
  /\bwelcome (?:back|to)\b/i,
  /\bin (?:today'?s|this) video\b/i,
  /\btoday (?:i|we)(?:'| a)?(?:m|re| are| will|\u2019ll|'ll)\b/i,
  /\bbefore we (?:begin|get started|jump in)\b/i,
  /\blet'?s (?:get|jump|dive) (?:into|in)\b/i,
  /\bmy name is\b/i,
  /\b(?:first|quickly),? (?:a little|some) (?:background|context) about me\b/i,
  /\bif you(?:'re| are) new (?:here|to the channel)\b/i,
];

const SPONSOR_PATTERNS = [
  /\b(?:sponsor(?:ed)?|paid promotion|brand partner)\b/i,
  /\b(?:brought to you|thanks? to .{1,50} for sponsoring)\b/i,
  /\b(?:use|with) (?:the )?(?:code|promo code)\b/i,
  /\blink (?:is )?in the description\b/i,
  /\b(?:free trial|special offer|exclusive discount)\b/i,
  /\b(?:affiliate link|partnered with|support(?:s|ing) (?:the|this) channel)\b/i,
  /\b(?:visit|go to|download) [\w.-]+(?: dot com|\.com)\b/i,
];

const CTA_PATTERNS = [
  /\b(?:like|share) (?:this|the) video\b/i,
  /\b(?:hit|click|smash) (?:the )?(?:like|subscribe|bell)\b/i,
  /\bsubscribe (?:to|for|if|and)\b/i,
  /\b(?:leave|drop) (?:a )?comment\b/i,
  /\bfollow me (?:on|for)\b/i,
  /\b(?:join|support) (?:my|the) (?:patreon|channel|membership)\b/i,
  /\b(?:sign up|subscribe) (?:for|to) (?:my|the) newsletter\b/i,
];

const OUTRO_PATTERNS = [
  /\bthanks? for watching\b/i,
  /\bsee you (?:in the next|next time|soon)\b/i,
  /\buntil next time\b/i,
  /\bthat(?:'s| is) (?:all|it) for (?:today|this video)\b/i,
  /\bcheck out (?:this|the next|another) video\b/i,
];

const RAMBLE_PATTERNS = [
  /\b(?:i digress|what was i saying|where was i|long story short)\b/i,
  /\b(?:random|quick) (?:side note|tangent)\b/i,
  /\banyway,? (?:back to|moving on)\b/i,
  /\b(?:give me|hang on|hold on) (?:a|one) (?:second|minute)\b/i,
  /\b(?:let me (?:think|find|look|pull)|lost my train of thought)\b/i,
  /\b(?:technical difficult|camera died|microphone|had to re-?record)\b/i,
  /\b(?:without further ado|enough of (?:me )?(?:talking|rambling))\b/i,
];

const REPETITION_PATTERNS = [
  /\b(?:as|like) i (?:said|mentioned|explained) (?:before|earlier)\b/i,
  /\bas we (?:said|mentioned|covered) (?:before|earlier)\b/i,
  /\b(?:again|to reiterate|to repeat|the point is),?\b/i,
];

const FILLER_PATTERNS = [
  /^(?:(?:um+|uh+|erm+|hmm+|okay|right|well|so|anyway|you know|i mean|kind of|sort of|basically|literally)[,.!?\s]*)+$/i,
  /\b(?:so yeah|yeah so|that(?:'s| is) pretty much it|you get the idea)\b/i,
];

const STOP_WORDS = new Set([
  'about',
  'again',
  'also',
  'and',
  'are',
  'basically',
  'because',
  'been',
  'being',
  'but',
  'can',
  'could',
  'for',
  'from',
  'have',
  'here',
  'into',
  'just',
  'like',
  'mean',
  'really',
  'that',
  'the',
  'then',
  'there',
  'they',
  'this',
  'was',
  'well',
  'were',
  'what',
  'when',
  'which',
  'with',
  'would',
  'you',
  'your',
]);

const matchesAny = (text: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(text));

const tokens = (text: string): readonly string[] =>
  text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const similarity = (left: string, right: string): number => {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (leftTokens.size < 3 || rightTokens.size < 3) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  const jaccard = intersection / new Set([...leftTokens, ...rightTokens]).size;
  const containment = intersection / Math.min(leftTokens.size, rightTokens.size);
  return Math.max(jaccard, containment * 0.86);
};

const looksLikeFiller = (text: string): boolean => {
  if (matchesAny(text, FILLER_PATTERNS)) return true;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > 18) return false;
  const contentWords = tokens(text);
  return (
    contentWords.length <= 2 &&
    /\b(?:um+|uh+|you know|i mean|kind of|sort of|basically|anyway|so yeah)\b/i.test(
      text,
    )
  );
};

const openingEnd = (
  durationSeconds: number | null,
  strictness: SmartSkipConfiguration['strictness'],
): number => {
  const requested = OPENING_SECONDS[strictness];
  if (!durationSeconds || !Number.isFinite(durationSeconds)) return requested;
  return Math.min(
    requested,
    Math.max(2, durationSeconds * 0.12),
    durationSeconds - 0.5,
  );
};

export const createInstantOpeningInterval = (
  videoId: string,
  durationSeconds: number | null,
  configuration: SmartSkipConfiguration,
): SmartSkipInterval | null => {
  if (!configuration.categories.includes('intro')) return null;
  const endSeconds = openingEnd(durationSeconds, configuration.strictness);
  if (!Number.isFinite(endSeconds) || endSeconds < 1.5) return null;
  return {
    id: `${videoId}:instant-opening`,
    startSegmentIndex: 0,
    endSegmentIndex: 0,
    startSeconds: 0,
    endSeconds,
    category: 'intro',
    reason: 'Fast start',
    confidence: 1,
    enabled: true,
    source: 'instant',
  };
};

interface ClassifiedSegment {
  readonly index: number;
  readonly category: SmartSkipCategory;
  readonly reason: string;
  readonly confidence: number;
}

const classifySegments = (
  document: TranscriptDocument,
  configuration: SmartSkipConfiguration,
): readonly ClassifiedSegment[] => {
  const enabled = new Set(configuration.categories);
  const duration =
    document.durationSeconds ?? document.segments.at(-1)?.endSeconds ?? 0;
  const introWindow = { conservative: 35, balanced: 60, aggressive: 90 }[
    configuration.strictness
  ];
  const outroStart = Math.max(duration * 0.8, duration - 90);
  const repeatThreshold = { conservative: 0.9, balanced: 0.68, aggressive: 0.55 }[
    configuration.strictness
  ];
  const repeatWindow = { conservative: 4, balanced: 10, aggressive: 16 }[
    configuration.strictness
  ];

  return document.segments.flatMap((segment, index): ClassifiedSegment[] => {
    const text = segment.text.trim();
    let match: Omit<ClassifiedSegment, 'index'> | null = null;
    if (enabled.has('sponsor') && matchesAny(text, SPONSOR_PATTERNS))
      match = { category: 'sponsor', reason: 'Promotion', confidence: 0.98 };
    else if (
      enabled.has('outro') &&
      segment.startSeconds >= outroStart &&
      matchesAny(text, OUTRO_PATTERNS)
    )
      match = { category: 'outro', reason: 'Outro', confidence: 0.97 };
    else if (enabled.has('call-to-action') && matchesAny(text, CTA_PATTERNS))
      match = {
        category: 'call-to-action',
        reason: 'Call to action',
        confidence: 0.96,
      };
    else if (
      enabled.has('intro') &&
      segment.startSeconds < introWindow &&
      matchesAny(text, INTRO_PATTERNS)
    )
      match = { category: 'intro', reason: 'Introduction', confidence: 0.94 };
    else if (
      enabled.has('ramble') &&
      (matchesAny(text, RAMBLE_PATTERNS) ||
        (configuration.strictness !== 'conservative' && looksLikeFiller(text)))
    )
      match = { category: 'ramble', reason: 'Low-value filler', confidence: 0.93 };
    else if (enabled.has('repetition')) {
      const previous = document.segments.slice(
        Math.max(0, index - repeatWindow),
        index,
      );
      if (
        matchesAny(text, REPETITION_PATTERNS) ||
        previous.some(
          (candidate) => similarity(candidate.text, text) >= repeatThreshold,
        )
      )
        match = { category: 'repetition', reason: 'Repeated point', confidence: 0.9 };
    }
    return match ? [{ index, ...match }] : [];
  });
};

const emptySpaceIntervals = (
  document: TranscriptDocument,
  configuration: SmartSkipConfiguration,
): readonly SmartSkipInterval[] => {
  if (!configuration.categories.includes('ramble')) return [];
  const threshold = { conservative: 5, balanced: 2, aggressive: 1.2 }[
    configuration.strictness
  ];
  const padding = configuration.strictness === 'aggressive' ? 0.08 : 0.14;
  const intervals = document.segments.slice(0, -1).flatMap((segment, index) => {
    const next = document.segments[index + 1];
    if (!next) return [];
    const startSeconds = segment.endSeconds + padding;
    const endSeconds = next.startSeconds - padding;
    if (
      next.startSeconds - segment.endSeconds < threshold ||
      endSeconds - startSeconds < 0.8
    )
      return [];
    return [
      {
        id: `${document.videoId}:instant-gap-${index}`,
        startSegmentIndex: index,
        endSegmentIndex: index,
        startSeconds,
        endSeconds,
        category: 'ramble' as const,
        reason: 'Dead air',
        confidence: 0.99,
        enabled: true,
        source: 'instant' as const,
      },
    ];
  });
  const last = document.segments.at(-1);
  const duration = document.durationSeconds ?? last?.endSeconds ?? 0;
  if (last && duration - last.endSeconds >= threshold) {
    const startSeconds = last.endSeconds + padding;
    const endSeconds = duration - padding;
    if (endSeconds - startSeconds >= 0.8)
      intervals.push({
        id: `${document.videoId}:instant-gap-end`,
        startSegmentIndex: document.segments.length - 1,
        endSegmentIndex: document.segments.length - 1,
        startSeconds,
        endSeconds,
        category: 'ramble',
        reason: 'Dead air',
        confidence: 0.99,
        enabled: true,
        source: 'instant',
      });
  }
  return intervals;
};

const intervalsFromClassifications = (
  document: TranscriptDocument,
  classifications: readonly ClassifiedSegment[],
): readonly SmartSkipInterval[] => {
  const intervals: SmartSkipInterval[] = [];
  for (const item of classifications) {
    const segment = document.segments[item.index];
    if (!segment || segment.endSeconds - segment.startSeconds < 0.5) continue;
    const previous = intervals.at(-1);
    if (
      previous &&
      previous.category === item.category &&
      segment.startSeconds <= previous.endSeconds + 1.25
    ) {
      intervals[intervals.length - 1] = {
        ...previous,
        id: `${document.videoId}:instant-${item.category}-${previous.startSegmentIndex}-${item.index}`,
        endSegmentIndex: item.index,
        endSeconds: segment.endSeconds,
        confidence: Math.max(previous.confidence, item.confidence),
      };
      continue;
    }
    intervals.push({
      id: `${document.videoId}:instant-${item.category}-${item.index}`,
      startSegmentIndex: item.index,
      endSegmentIndex: item.index,
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
      category: item.category,
      reason: item.reason,
      confidence: item.confidence,
      enabled: true,
      source: 'instant',
    });
  }
  return intervals;
};

const mergeIntervals = (
  videoId: string,
  intervals: readonly SmartSkipInterval[],
): readonly SmartSkipInterval[] => {
  const categoryPriority: Readonly<Record<SmartSkipCategory, number>> = {
    sponsor: 6,
    'call-to-action': 5,
    outro: 4,
    intro: 3,
    repetition: 2,
    ramble: 1,
  };
  const sorted = [...intervals].sort(
    (left, right) => left.startSeconds - right.startSeconds,
  );
  const merged: SmartSkipInterval[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    const overlapsPrevious = previous && interval.startSeconds < previous.endSeconds;
    const joinsPreviousCategory =
      previous &&
      interval.category === previous.category &&
      interval.startSeconds <= previous.endSeconds + 0.25;
    if (!previous || (!overlapsPrevious && !joinsPreviousCategory)) {
      merged.push(interval);
      continue;
    }
    const keepOpening = previous.id.endsWith(':instant-opening');
    const descriptive =
      categoryPriority[interval.category] > categoryPriority[previous.category]
        ? interval
        : previous;
    merged[merged.length - 1] = {
      ...(keepOpening || previous.confidence >= interval.confidence
        ? previous
        : interval),
      id: `${videoId}:instant-${Math.min(previous.startSegmentIndex, interval.startSegmentIndex)}-${Math.max(previous.endSegmentIndex, interval.endSegmentIndex)}`,
      startSegmentIndex: Math.min(
        previous.startSegmentIndex,
        interval.startSegmentIndex,
      ),
      endSegmentIndex: Math.max(previous.endSegmentIndex, interval.endSegmentIndex),
      startSeconds: Math.min(previous.startSeconds, interval.startSeconds),
      endSeconds: Math.max(previous.endSeconds, interval.endSeconds),
      confidence: Math.max(previous.confidence, interval.confidence),
      category: descriptive.category,
      reason: descriptive.reason,
    };
  }
  return merged;
};

export const buildInstantSmartSkipAnalysis = (
  document: TranscriptDocument,
  trackId: string,
  configuration: SmartSkipConfiguration,
): SmartSkipAnalysis => {
  const opening = createInstantOpeningInterval(
    document.videoId,
    document.durationSeconds,
    configuration,
  );
  const duration =
    document.durationSeconds ?? document.segments.at(-1)?.endSeconds ?? 0;
  const intervals = mergeIntervals(document.videoId, [
    ...(opening ? [opening] : []),
    ...intervalsFromClassifications(
      document,
      classifySegments(document, configuration),
    ),
    ...emptySpaceIntervals(document, configuration),
  ]).map((interval) =>
    interval.category === 'outro' && duration > interval.endSeconds
      ? { ...interval, endSeconds: Math.max(interval.endSeconds, duration - 0.25) }
      : interval,
  );
  const cutDuration = intervals.reduce(
    (total, interval) => total + interval.endSeconds - interval.startSeconds,
    0,
  );
  return {
    schemaVersion: 1,
    videoId: document.videoId,
    trackId,
    transcriptFingerprint: transcriptFingerprint(document),
    provider: configuration.provider,
    strictness: configuration.strictness,
    categories: configuration.categories,
    intervals,
    analyzedAt: Date.now(),
    reviewRequired: duration > 0 && cutDuration / duration > 0.35,
  };
};
