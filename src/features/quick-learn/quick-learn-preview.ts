import type {
  TranscriptDocument,
  TranscriptSegment,
} from '@/features/transcript/domain';

export interface QuickLearnPoint {
  readonly startSeconds: number;
  readonly text: string;
}

export interface QuickLearnPreview {
  readonly title: string;
  readonly summary: string;
  readonly points: readonly QuickLearnPoint[];
  readonly languageLabel: string;
}

interface CaptionWindow extends QuickLearnPoint {
  readonly endSeconds: number;
  readonly tokens: readonly string[];
  readonly score: number;
}

const STOP_WORDS = new Set(
  `a about actually after again all also am an and any are as at be because been before
  being between both but by can could did do does doing down during each even every few
  for from further get getting got had has have having he her here hers herself him
  himself his how i if in into is it its itself just like may me might more most my
  myself no nor not now of off on once only or other our ours ourselves out over own
  really right same she should so some such than that the their theirs them themselves
  then there these they thing things this those through to too under until up very was
  we were what when where which while who why will with would you your yours yourself
  yourselves gonna going kind know let look lot make many much one people pretty say
  see something take think time today use using want way well yeah`.split(/\s+/),
);

const PROMOTION_PATTERN =
  /\b(sponsor(?:ed)?|brought to you by|discount code|promo code|affiliate link|subscribe|hit the (?:like|bell)|thanks for watching)\b/i;

const cleanCaption = (text: string): string =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]{1,40}\]/g, ' ')
    .replace(/\([^)]*(?:music|applause|laughter)[^)]*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokensFor = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? []).filter(
    (token) => !STOP_WORDS.has(token) && !/^\d+$/.test(token),
  );

const finishSentence = (text: string, maximum = 240): string => {
  const cleaned = cleanCaption(text);
  if (!cleaned) return '';
  const clipped =
    cleaned.length <= maximum
      ? cleaned
      : `${cleaned.slice(0, maximum - 1).replace(/\s+\S*$/, '')}…`;
  const capitalized = clipped[0]?.toUpperCase() + clipped.slice(1);
  return /[.!?…]$/.test(capitalized) ? capitalized : `${capitalized}.`;
};

const uniqueSegments = (
  segments: readonly TranscriptSegment[],
): readonly TranscriptSegment[] => {
  let previous = '';
  return segments.filter((segment) => {
    const text = cleanCaption(segment.text);
    if (!text || text.toLowerCase() === previous.toLowerCase()) return false;
    previous = text;
    return true;
  });
};

const makeWindows = (
  document: TranscriptDocument,
  tokenFrequency: ReadonlyMap<string, number>,
  titleTokens: ReadonlySet<string>,
): readonly CaptionWindow[] => {
  const segments = uniqueSegments(document.segments);
  const windows: CaptionWindow[] = [];

  for (let index = 0; index < segments.length;) {
    const first = segments[index];
    if (!first) break;
    const parts: string[] = [];
    let cursor = index;
    let endSeconds = first.endSeconds;

    while (cursor < segments.length && parts.join(' ').length < 155) {
      const segment = segments[cursor];
      if (!segment || segment.startSeconds - first.startSeconds > 26) break;
      const text = cleanCaption(segment.text);
      if (text) parts.push(text);
      endSeconds = segment.endSeconds;
      cursor += 1;
      if (parts.join(' ').length >= 90 && /[.!?]$/.test(text)) break;
    }

    const text = finishSentence(parts.join(' '));
    const tokens = [...new Set(tokensFor(text))];
    if (text.length >= 36 && tokens.length >= 3) {
      const topicality = tokens.reduce(
        (total, token) => total + (tokenFrequency.get(token) ?? 0),
        0,
      );
      const titleOverlap = tokens.filter((token) => titleTokens.has(token)).length;
      windows.push({
        startSeconds: first.startSeconds,
        endSeconds,
        text,
        tokens,
        score:
          topicality / Math.sqrt(tokens.length) +
          titleOverlap * 3 -
          (PROMOTION_PATTERN.test(text) ? 20 : 0),
      });
    }
    index = Math.max(index + 1, cursor);
  }

  return windows;
};

const similarity = (left: CaptionWindow, right: CaptionWindow): number => {
  const leftTokens = new Set(left.tokens);
  const shared = right.tokens.filter((token) => leftTokens.has(token)).length;
  return shared / Math.max(1, Math.min(left.tokens.length, right.tokens.length));
};

const pickSummary = (
  windows: readonly CaptionWindow[],
  durationSeconds: number,
): CaptionWindow => {
  const setupLimit = Math.min(120, Math.max(45, durationSeconds * 0.28));
  const setup = windows.filter(
    (window) =>
      window.startSeconds <= setupLimit && !PROMOTION_PATTERN.test(window.text),
  );
  const candidates = setup.length > 0 ? setup : windows;
  return [...candidates].sort((left, right) => {
    const leftEarlyBoost = Math.max(0, 3 - left.startSeconds / 30);
    const rightEarlyBoost = Math.max(0, 3 - right.startSeconds / 30);
    return right.score + rightEarlyBoost - (left.score + leftEarlyBoost);
  })[0]!;
};

const pickPoints = (
  windows: readonly CaptionWindow[],
  summary: CaptionWindow,
  durationSeconds: number,
): readonly QuickLearnPoint[] => {
  const desired = durationSeconds < 75 ? 2 : 3;
  const targets =
    desired === 2
      ? [durationSeconds * 0.3, durationSeconds * 0.72]
      : [durationSeconds * 0.2, durationSeconds * 0.5, durationSeconds * 0.8];
  const chosen: CaptionWindow[] = [];

  for (const target of targets) {
    const ranked = [...windows].sort((left, right) => {
      const leftDistance = Math.abs(left.startSeconds - target) / durationSeconds;
      const rightDistance = Math.abs(right.startSeconds - target) / durationSeconds;
      return right.score - rightDistance * 9 - (left.score - leftDistance * 9);
    });
    const candidate = ranked.find(
      (window) =>
        !PROMOTION_PATTERN.test(window.text) &&
        similarity(window, summary) < 0.62 &&
        chosen.every((other) => similarity(window, other) < 0.55),
    );
    if (candidate) chosen.push(candidate);
  }

  if (chosen.length === 0) chosen.push(summary);
  return chosen
    .sort((left, right) => left.startSeconds - right.startSeconds)
    .map(({ startSeconds, text }) => ({
      startSeconds,
      text: finishSentence(text, 170),
    }));
};

/** Builds a fast, extractive briefing entirely from the video's captions. */
export const buildQuickLearnPreview = (
  document: TranscriptDocument,
): QuickLearnPreview => {
  const allText = document.segments.map(({ text }) => cleanCaption(text)).join(' ');
  const frequency = new Map<string, number>();
  for (const token of tokensFor(allText))
    frequency.set(token, (frequency.get(token) ?? 0) + 1);

  const titleTokens = new Set(tokensFor(document.videoTitle));
  const durationSeconds = Math.max(
    1,
    document.durationSeconds ??
      document.segments.at(-1)?.endSeconds ??
      document.segments.at(-1)?.startSeconds ??
      1,
  );
  const windows = makeWindows(document, frequency, titleTokens);
  const fallback = finishSentence(allText, 240);
  if (windows.length === 0)
    return {
      title: document.videoTitle,
      summary:
        fallback || 'Captions are present, but there is not enough text to preview.',
      points: [],
      languageLabel: document.languageLabel,
    };

  const summary = pickSummary(windows, durationSeconds);
  return {
    title: document.videoTitle,
    summary: finishSentence(summary.text),
    points: pickPoints(windows, summary, durationSeconds),
    languageLabel: document.languageLabel,
  };
};
