import type { TranscriptDocument } from '@/features/transcript/domain';

import type {
  SmartSkipAnalysis,
  SmartSkipCategory,
  SmartSkipConfiguration,
  SmartSkipInterval,
} from './domain';
import { transcriptFingerprint } from './analysis';

const INTRO_PATTERNS = [
  /\bwelcome (?:back|to)\b/i,
  /\bbefore we (?:begin|get started|jump in)\b/i,
  /\blet'?s (?:get|jump|dive) (?:into|in)\b/i,
  /\bmy name is\b/i,
  /\bif you(?:'re| are) new (?:here|to the channel)\b/i,
];

/** Intro detection plus generic greeting phrasing used by growth. */
const INTRO_GROWTH_PATTERNS = [
  ...INTRO_PATTERNS,
  /\bhey (?:guys|everyone|folks|there|y'all)\b/i,
  /\bwhat(?:'?s| is) up\b/i,
  /\bwelcome\b/i,
  /\btoday (?:we|i)'?(?:re|ll|m| am| are| will)\b/i,
  /\bin this (?:video|episode)\b/i,
];

const SPONSOR_PATTERNS = [
  /\b(?:sponsor(?:ed)?|paid promotion|brand partner|paid partnership)\b/i,
  /\b(?:today'?s|this (?:video|week|episode)'?s) (?:video )?sponsor\b/i,
  /\b(?:brought to you|thanks? to .{1,50} for sponsoring)\b/i,
  /\bsponsoring this (?:video|channel|episode|show)\b/i,
  /\b(?:quick|short) (?:word|message|break) from our sponsors?\b/i,
  /\bspecial thanks to\b/i,
  /\b(?:use|with) (?:the )?(?:code|promo code)\b/i,
  /\blink (?:is )?in the description\b/i,
  /\b(?:free trial|special offer|exclusive discount)\b/i,
  /\b(?:affiliate link|partnered with|support(?:s|ing) (?:the|this) channel)\b/i,
  /\b(?:visit|go to|download) [\w.-]+(?: dot com|\.com)\b/i,
];

const CTA_PATTERNS = [
  /\b(?:like|share) (?:this|the) video\b/i,
  /\b(?:hit|click|smash) (?:the )?(?:like|subscribe|bell)(?: button)?\b/i,
  /\bsubscribe (?:to (?:my|the|this) channel|for more|if you|and (?:hit|click|turn on))\b/i,
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
  /\b(?:technical difficult|camera died|had to re-?record)\b/i,
  /\b(?:my|the) microphone (?:died|failed|cut out|stopped working|wasn'?t working)\b/i,
  /\b(?:without further ado|enough of (?:me )?(?:talking|rambling))\b/i,
];

const REPETITION_PATTERNS = [
  /\b(?:as|like) i (?:said|mentioned|explained) (?:before|earlier)\b/i,
  /\bas we (?:said|mentioned|covered) (?:before|earlier)\b/i,
  /\b(?:to reiterate|to repeat|as a reminder)\b/i,
];

const FILLER_PATTERNS = [
  /^(?:(?:um+|uh+|erm+|hmm+|okay|right|well|so|anyway|you know|i mean|kind of|sort of|basically|literally)[,.!?\s]*)+$/i,
  /\b(?:so yeah|yeah so|that(?:'s| is) pretty much it|you get the idea)\b/i,
];

const VISUAL_PAUSE_PATTERNS = [
  /\b(?:as you can see|look at (?:this|that|the (?:screen|result|demo|example))|on (?:the )?screen|watch (?:this|what)|let me show|i(?:'ll| will) show|here(?:'s| is) (?:what|how))\b/i,
  /\b(?:listen to|play) (?:this|that|the (?:clip|audio|sound|video|recording))\b/i,
  /\bwait for (?:it|this|that|the (?:result|animation|transition|render))\b/i,
  /\b(?:demo(?:nstrate|nstration)?|walkthrough|timelapse|before and after)\b/i,
];

/**
 * Recurring sponsor names. A mention alone is weak evidence used to grow cut
 * boundaries; combined with promotional wording in the same neighborhood it can
 * seed a sponsor jump even when the word "sponsor" is never spoken.
 */
const SPONSOR_BRANDS: readonly string[] = [
  'nord(?:vpn|security|pass)',
  'surfshark',
  'expressvpn',
  'cyber ?ghost',
  'mullvad',
  'dashlane',
  'lastpass',
  '1password',
  'bitwarden',
  'squarespace',
  'wix\\.com?',
  'shopify',
  'big ?cartel',
  'skillshare',
  'brilliant(?:\\.org)?',
  'curiosity ?stream',
  'ground ?news',
  'opera ?gx',
  'raycon',
  'manscaped',
  'dollar shave club',
  'hello ?fresh',
  'blue ?apron',
  'home ?chef',
  'every ?plate',
  'butcher ?box',
  'magic ?spoon',
  'trade ?coffee',
  'athletic ?greens',
  '\\bag ?1\\b',
  'liquid ?i\\.?v\\.?',
  'established titles',
  'ridge(?: wallet)?',
  'dbrand',
  'popsockets',
  'displate',
  'govee',
  'hostinger',
  'honey',
  'capital one shopping',
  'rocket money',
  'truebill',
  'incogni',
  'delete ?me',
  'kanopy',
  'blinkist',
  'shortform',
  'audible',
  'great courses plus',
];

const SPONSOR_BRAND_PATTERN = new RegExp(`\\b(?:${SPONSOR_BRANDS.join('|')})\\b`, 'i');

/**
 * Promotional wording that is weak evidence on its own but marks the rest of a
 * sponsor section once a strong seed exists nearby.
 */
const PROMO_SUPPORT_PATTERNS = [
  /\b\d{1,3}\s?(?:%|percent)\s?off\b/i,
  /\b(?:discount|promo|coupon|referral) code\b/i,
  /\buse (?:my |the )?(?:code|link|promo)\b/i,
  /\bmy (?:code|link) (?:is|below)\b/i,
  /\b[\w.-]+\s?dot\s?(?:com|net|io|org|tv|gg|ai|app|dev)\b/i,
  /\b(?:at|visit|go to|check out|head (?:over )?to|available (?:at|on))\s+(?:https?:\/\/\S+|www\.\S+|[\w.-]+\.(?:com|net|io|co|ai|org|tv|gg|me|app|dev))/i,
  /\b(?:link|links) (?:are )?(?:down )?(?:below|in the description)/i,
  /\bfree (?:trial|shipping|stock|month|year|account|plan|gift)\b/i,
  /\bmoney[- ]back guarantee\b/i,
  /\bfirst \d+ (?:(?:people|users|customers|signups|viewers)\b|get\b)/i,
  /\bexclusive (?:(?:discount|deal|offer)|for (?:my|watchbetter) viewers)\b/i,
  /\bsign ?up (?:for|with|using|through|at)\b/i,
  /\baffiliate links?\b/i,
  /\bpartnered with\b/i,
  /\bpaid partnership\b/i,
];

/** Self-promotion phrasing treated as calls to action. */
const SELF_PROMO_PATTERNS = [
  /\b(?:check out|grab|pick up) (?:my|the|our) (?:course|book|template|notion|app|extension|bootcamp|program|community|merch|store|shop)\b/i,
  /\b(?:my|our|the) (?:merch|store|shop) (?:link|drop|is out|is live|shelf)\b/i,
  /\bjoin (?:my|our|the) (?:discord|patreon|membership|community|newsletter|mailing list)\b/i,
  /\b(?:course|bootcamp|program) (?:is )?(?:now )?(?:live|out|available|enrolling)\b/i,
  /\bmembers(?:hip)? (?:only|get|perks)\b/i,
  /\bearly (?:access|drops?)\b/i,
  /\bshameless plug\b/i,
];

/** Story, rant, and hot-take markers ("bad takes"). */
const TANGENT_PATTERNS = [
  /\bhot take\b/i,
  /\bunpopular opinion\b/i,
  /\bcontroversial (?:opinion|take|statement)\b/i,
  /\b(?:mini |quick |little )?rant\b/i,
  /\bstory ?time\b/i,
  /\b(?:true|funny|quick|little|short) story\b/i,
  /\bside (?:note|quest|bar|track)\b/i,
  /\bdon'?t get me started\b/i,
  /\bnot to (?:be negative|dump on|hate on|yuck someone'?s yum)\b/i,
  /\bthis (?:is|might be|may be) (?:going to be )?controversial\b/i,
  /\bi(?:'m| am) going to (?:get|be) (?:hate|flamed|cancelled) for (?:this|saying)/i,
];

const FILLER_TOKEN_PATTERN =
  /\b(?:um+|uh+|erm+|hmm+|you know|i mean|kinda|sorta|kind of|sort of|basically|literally|anyway|so yeah|alright|okay so)\b/gi;

const fillerStatistics = (
  text: string,
): { readonly words: number; readonly fillers: number } => {
  const fillers = text.match(FILLER_TOKEN_PATTERN)?.length ?? 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return { words, fillers };
};

const isFillerDominant = (text: string): boolean => {
  const { words, fillers } = fillerStatistics(text);
  if (words < 5) return looksLikeFiller(text);
  return fillers > 0 && fillers / words >= 0.34;
};

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

const unmatchedTokens = (
  text: string,
  patterns: readonly RegExp[],
): readonly string[] => {
  let remainder = text;
  for (const pattern of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    remainder = remainder.replace(new RegExp(pattern.source, flags), ' ');
  }
  return tokens(remainder);
};

const mostlyLowValue = (
  text: string,
  patterns: readonly RegExp[],
  maximumUnmatchedTokens: number,
): boolean =>
  matchesAny(text, patterns) &&
  unmatchedTokens(text, patterns).length <= maximumUnmatchedTokens;

const semanticMarkers = (text: string): readonly string[] => {
  const normalized = text.toLocaleLowerCase();
  const urls =
    normalized.match(
      /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/g,
    ) ?? [];
  const numbers = normalized.match(/\b\d+(?:[.,]\d+)*(?:%|x)?\b/g) ?? [];
  const negations =
    normalized.match(
      /\b(?:no|not|never|neither|without|cannot|can'?t|won'?t|don'?t|doesn'?t|didn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|shouldn'?t|wouldn'?t|couldn'?t)\b/g,
    ) ?? [];
  return [
    ...new Set([
      ...urls.map((value) => `url:${value.replace(/[),.!?]+$/, '')}`),
      ...numbers.map((value) => `number:${value}`),
      ...negations.map((value) => `negation:${value}`),
    ]),
  ].sort();
};

const carriesNoNovelContent = (earlier: string, repeated: string): boolean => {
  if (semanticMarkers(earlier).join('|') !== semanticMarkers(repeated).join('|'))
    return false;
  const known = new Set(tokens(earlier));
  const current = [...new Set(tokens(repeated))];
  if (current.length < 3) return false;
  const novel = current.filter((token) => !known.has(token));
  return novel.length <= 1 || novel.length / current.length <= 0.15;
};

const looksLikeFiller = (text: string): boolean => {
  if (FILLER_PATTERNS[0]?.test(text)) return true;
  if (mostlyLowValue(text, FILLER_PATTERNS.slice(1), 2)) return true;
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

interface ClassifiedSegment {
  readonly index: number;
  readonly category: SmartSkipCategory;
  readonly reason: string;
  readonly confidence: number;
}

const promoSupportNearby = (document: TranscriptDocument, index: number): boolean => {
  for (let offset = -1; offset <= 1; offset += 1) {
    const neighbor = document.segments[index + offset];
    if (neighbor && matchesAny(neighbor.text, PROMO_SUPPORT_PATTERNS)) return true;
  }
  return false;
};

export const classifySegments = (
  document: TranscriptDocument,
  configuration: SmartSkipConfiguration,
): readonly ClassifiedSegment[] => {
  const enabled = new Set(configuration.categories);
  const duration =
    document.durationSeconds ?? document.segments.at(-1)?.endSeconds ?? 0;
  const baseIntroWindow = { conservative: 35, balanced: 60, aggressive: 90 }[
    configuration.strictness
  ];
  const shortIntroFraction = {
    conservative: 0.2,
    balanced: 0.28,
    aggressive: 0.35,
  }[configuration.strictness];
  const introWindow =
    duration > 0 && duration <= 180
      ? Math.min(baseIntroWindow, Math.max(4, duration * shortIntroFraction))
      : baseIntroWindow;
  const outroStart = Math.max(duration * 0.8, duration - 90);
  const repeatThreshold = { conservative: 0.94, balanced: 0.82, aggressive: 0.72 }[
    configuration.strictness
  ];
  const repeatWindow = { conservative: 4, balanced: 10, aggressive: 16 }[
    configuration.strictness
  ];

  /** Repetition compares each segment against a window of earlier ones; caching
   * token sets keeps that linear in practice instead of rebuilding sets per pair. */
  const tokenSetCache = new Map<number, Set<string>>();
  const tokenSetFor = (index: number): Set<string> => {
    let cached = tokenSetCache.get(index);
    if (!cached) {
      cached = new Set(tokens(document.segments[index]?.text ?? ''));
      tokenSetCache.set(index, cached);
    }
    return cached;
  };

  const classifications = document.segments.flatMap(
    (segment, index): ClassifiedSegment[] => {
      const text = segment.text.trim();
      let match: Omit<ClassifiedSegment, 'index'> | null = null;
      if (
        enabled.has('sponsor') &&
        (mostlyLowValue(
          text,
          SPONSOR_PATTERNS,
          configuration.strictness === 'aggressive' ? 9 : 4,
        ) ||
          // A known sponsor name plus promotional wording in the neighborhood is
          // enough to seed a cut even when "sponsor" itself is never said.
          (SPONSOR_BRAND_PATTERN.test(text) && promoSupportNearby(document, index)))
      )
        match = { category: 'sponsor', reason: 'Promotion', confidence: 0.98 };
      else if (
        enabled.has('outro') &&
        segment.startSeconds >= outroStart &&
        mostlyLowValue(
          text,
          OUTRO_PATTERNS,
          configuration.strictness === 'aggressive' ? 4 : 2,
        )
      )
        match = { category: 'outro', reason: 'Outro', confidence: 0.97 };
      else if (
        enabled.has('call-to-action') &&
        (mostlyLowValue(
          text,
          CTA_PATTERNS,
          configuration.strictness === 'aggressive' ? 6 : 3,
        ) ||
          mostlyLowValue(
            text,
            SELF_PROMO_PATTERNS,
            configuration.strictness === 'aggressive' ? 7 : 3,
          ))
      )
        match = {
          category: 'call-to-action',
          reason: 'Call to action',
          confidence: 0.96,
        };
      else if (
        enabled.has('intro') &&
        segment.startSeconds < introWindow &&
        mostlyLowValue(
          text,
          INTRO_PATTERNS,
          configuration.strictness === 'aggressive' ? 4 : 2,
        )
      )
        match = { category: 'intro', reason: 'Introduction', confidence: 0.94 };
      else if (
        enabled.has('ramble') &&
        (mostlyLowValue(
          text,
          RAMBLE_PATTERNS,
          configuration.strictness === 'aggressive' ? 5 : 2,
        ) ||
          (configuration.strictness !== 'conservative' && looksLikeFiller(text)))
      )
        match = { category: 'ramble', reason: 'Low-value filler', confidence: 0.93 };
      else if (
        enabled.has('ramble') &&
        configuration.strictness !== 'conservative' &&
        matchesAny(text, TANGENT_PATTERNS) &&
        mostlyLowValue(
          text,
          TANGENT_PATTERNS,
          configuration.strictness === 'aggressive' ? 8 : 5,
        )
      )
        match = { category: 'ramble', reason: 'Tangent', confidence: 0.88 };
      else if (enabled.has('repetition')) {
        const currentTokens = tokenSetFor(index);
        if (currentTokens.size >= 3) {
          const explicitlyRepeated = matchesAny(text, REPETITION_PATTERNS);
          const threshold = repeatThreshold - (explicitlyRepeated ? 0.12 : 0);
          for (
            let cursor = Math.max(0, index - repeatWindow);
            cursor < index;
            cursor += 1
          ) {
            const candidateText = document.segments[cursor]?.text ?? '';
            if (!carriesNoNovelContent(candidateText, text)) continue;
            const previousTokens = tokenSetFor(cursor);
            if (previousTokens.size < 3) continue;
            let intersection = 0;
            for (const token of previousTokens)
              if (currentTokens.has(token)) intersection += 1;
            const union = new Set([...previousTokens, ...currentTokens]).size;
            const jaccard = intersection / union;
            const containment = intersection / previousTokens.size;
            if (Math.max(jaccard, containment * 0.86) >= threshold) {
              match = {
                category: 'repetition',
                reason: 'Repeated point',
                confidence: 0.9,
              };
              break;
            }
          }
        }
      }
      return match ? [{ index, ...match }] : [];
    },
  );

  if (enabled.has('ramble') && configuration.strictness !== 'conservative') {
    // Filler-dominant runs ("um... basically like... you know...") that no single
    // pattern catches become ramble seeds so their whole span can jump.
    const classified = new Set(classifications.map((item) => item.index));
    let run: number[] = [];
    const flushRun = () => {
      if (run.length >= 2)
        for (const index of run) {
          classifications.push({
            index,
            category: 'ramble',
            reason: 'Low-value filler',
            confidence: 0.9,
          });
          classified.add(index);
        }
      run = [];
    };
    document.segments.forEach((segment, index) => {
      if (classified.has(index)) {
        flushRun();
        return;
      }
      if (isFillerDominant(segment.text)) run.push(index);
      else flushRun();
    });
    flushRun();
  }

  return classifications.sort((left, right) => left.index - right.index);
};

/** Weak evidence per category used to extend a seed cut across its whole section. */
const GROWTH_MATCHERS: Readonly<Partial<Record<SmartSkipCategory, readonly RegExp[]>>> =
  {
    sponsor: [...PROMO_SUPPORT_PATTERNS, SPONSOR_BRAND_PATTERN],
    'call-to-action': [
      ...SELF_PROMO_PATTERNS,
      /\b(?:like|subscribe|comment below|let me know in)\b/i,
      /\b(?:follow|find me) (?:me )?(?:on|at|over at)\b/i,
    ],
    outro: [
      ...OUTRO_PATTERNS,
      /\b(?:farewell|peace out|catch you (?:later|next)|see ya)\b/i,
      /\bsubscribe\b/i,
      /\bmerch\b/i,
      /\bnext (?:video|time|week)\b/i,
    ],
    intro: INTRO_GROWTH_PATTERNS,
  };

type SmartSkipStrictnessName = SmartSkipConfiguration['strictness'];

const GROWTH_LIMITS: Readonly<
  Record<SmartSkipStrictnessName, { segments: number; seconds: number }>
> = {
  conservative: { segments: 3, seconds: 15 },
  balanced: { segments: 10, seconds: 60 },
  aggressive: { segments: 18, seconds: 110 },
};

/**
 * Sponsor reads, intros, and outros span many caption lines while only one or two
 * contain a strong keyword. Grow each classified run outward through neighbors that
 * still carry weak category evidence so the entire section jumps, not one caption.
 */
export const growClassifications = (
  document: TranscriptDocument,
  classifications: readonly ClassifiedSegment[],
  configuration: SmartSkipConfiguration,
): readonly ClassifiedSegment[] => {
  const byIndex = new Map(classifications.map((item) => [item.index, item]));
  const sorted = [...classifications].sort((a, b) => a.index - b.index);
  const runs: { start: number; end: number }[] = [];
  for (const item of sorted) {
    const lastRun = runs.at(-1);
    if (lastRun && item.index === lastRun.end + 1) lastRun.end = item.index;
    else runs.push({ start: item.index, end: item.index });
  }
  const limits = GROWTH_LIMITS[configuration.strictness];

  const segmentDuration = (index: number): number => {
    const segment = document.segments[index];
    return segment ? Math.max(0, segment.endSeconds - segment.startSeconds) : 0;
  };

  for (const run of runs) {
    const seed = byIndex.get(run.start);
    if (!seed) continue;
    const weak = GROWTH_MATCHERS[seed.category];
    if (!weak || weak.length === 0) continue;
    const seedSegment = document.segments[run.start];
    if (!seedSegment) continue;

    const growReason =
      seed.category === 'sponsor'
        ? 'Promotion'
        : seed.category === 'outro'
          ? 'Outro'
          : seed.category === 'intro'
            ? 'Introduction'
            : 'Call to action';
    const adopt = (index: number): void => {
      byIndex.set(index, {
        index,
        category: seed.category,
        reason: growReason,
        confidence: 0.9,
      });
    };

    let span = seedSegment.endSeconds - seedSegment.startSeconds;
    let count = 0;
    for (let cursor = run.start - 1; cursor >= 0; cursor -= 1) {
      const segment = document.segments[cursor];
      if (!segment || !matchesAny(segment.text, weak)) break;
      span += segmentDuration(cursor);
      count += 1;
      if (count > limits.segments || span > limits.seconds) break;
      adopt(cursor);
    }
    span = seedSegment.endSeconds - seedSegment.startSeconds;
    count = 0;
    for (let cursor = run.end + 1; cursor < document.segments.length; cursor += 1) {
      const segment = document.segments[cursor];
      if (!segment || !matchesAny(segment.text, weak)) break;
      span += segmentDuration(cursor);
      count += 1;
      if (count > limits.segments || span > limits.seconds) break;
      adopt(cursor);
    }
  }

  return [...byIndex.values()].sort((a, b) => a.index - b.index);
};

const pacingRanges = (document: TranscriptDocument) => {
  const source =
    document.speechRanges && document.speechRanges.length > 0
      ? document.speechRanges
      : document.segments;
  const ordered = [...source]
    .filter(
      (range) =>
        Number.isFinite(range.startSeconds) &&
        Number.isFinite(range.endSeconds) &&
        range.startSeconds >= 0 &&
        range.endSeconds > range.startSeconds,
    )
    .sort((left, right) => left.startSeconds - right.startSeconds);
  const ranges: { startSeconds: number; endSeconds: number }[] = [];
  for (const range of ordered) {
    const previous = ranges.at(-1);
    if (!previous || range.startSeconds > previous.endSeconds + 0.04) {
      ranges.push({
        startSeconds: range.startSeconds,
        endSeconds: range.endSeconds,
      });
      continue;
    }
    ranges[ranges.length - 1] = {
      startSeconds: previous.startSeconds,
      endSeconds: Math.max(previous.endSeconds, range.endSeconds),
    };
  }
  return ranges;
};

const segmentIndexAt = (document: TranscriptDocument, seconds: number): number => {
  let match = 0;
  for (let index = 0; index < document.segments.length; index += 1) {
    const segment = document.segments[index];
    if (!segment || segment.startSeconds > seconds) break;
    match = index;
  }
  return match;
};

const emptySpaceIntervals = (
  document: TranscriptDocument,
  configuration: SmartSkipConfiguration,
): readonly SmartSkipInterval[] => {
  if (!configuration.categories.includes('ramble')) return [];
  const threshold = { conservative: 0.8, balanced: 0.4, aggressive: 0.24 }[
    configuration.strictness
  ];
  const padding = { conservative: 0.12, balanced: 0.08, aggressive: 0.05 }[
    configuration.strictness
  ];
  const jumpThreshold = { conservative: 2.5, balanced: 1.6, aggressive: 1 }[
    configuration.strictness
  ];
  const maximumJumpGap = { conservative: 6, balanced: 8, aggressive: 10 }[
    configuration.strictness
  ];
  const ranges = pacingRanges(document);
  const intervals = ranges.slice(0, -1).flatMap((range, index) => {
    const next = ranges[index + 1];
    if (!next || next.startSeconds - range.endSeconds < threshold) return [];
    const startSeconds = range.endSeconds + padding;
    const endSeconds = next.startSeconds - padding;
    const gapDuration = endSeconds - startSeconds;
    if (gapDuration < 0.12) return [];
    const segmentIndex = segmentIndexAt(document, range.endSeconds);
    const nextSegmentIndex = segmentIndexAt(document, next.startSeconds);
    const visualContext = [
      document.segments[segmentIndex]?.text ?? '',
      document.segments[nextSegmentIndex]?.text ?? '',
    ].some((text) => matchesAny(text, VISUAL_PAUSE_PATTERNS));
    // Caption-only analysis cannot prove that a long silence lacks visual information.
    // Leave visual/extended gaps alone; jump only bounded dead air.
    if (gapDuration < jumpThreshold || gapDuration > maximumJumpGap || visualContext)
      return [];
    return [
      {
        id: `${document.videoId}:instant-gap-${index}`,
        startSegmentIndex: segmentIndex,
        endSegmentIndex: segmentIndex,
        startSeconds,
        endSeconds,
        category: 'ramble' as const,
        reason: 'Dead air',
        confidence: 0.99,
        enabled: true,
        action: 'skip' as const,
        source: 'instant' as const,
      },
    ];
  });
  return intervals;
};

const intervalsFromClassifications = (
  document: TranscriptDocument,
  classifications: readonly ClassifiedSegment[],
): readonly SmartSkipInterval[] => {
  const intervals: SmartSkipInterval[] = [];
  const classifiedIndexes = new Set(classifications.map(({ index }) => index));
  for (const item of classifications) {
    const segment = document.segments[item.index];
    if (!segment) continue;
    const precedingUseful = !classifiedIndexes.has(item.index - 1)
      ? document.segments[item.index - 1]
      : null;
    const followingUseful = !classifiedIndexes.has(item.index + 1)
      ? document.segments[item.index + 1]
      : null;
    const startSeconds = Math.max(
      segment.startSeconds,
      precedingUseful?.endSeconds ?? segment.startSeconds,
    );
    const endSeconds = Math.min(
      segment.endSeconds,
      followingUseful?.startSeconds ?? segment.endSeconds,
    );
    if (endSeconds - startSeconds < 0.5) continue;
    const previous = intervals.at(-1);
    if (
      previous &&
      item.index === previous.endSegmentIndex + 1 &&
      previous.category === item.category &&
      startSeconds <= previous.endSeconds + 1.25
    ) {
      intervals[intervals.length - 1] = {
        ...previous,
        id: `${document.videoId}:instant-${item.category}-${previous.startSegmentIndex}-${item.index}`,
        endSegmentIndex: item.index,
        endSeconds,
        confidence: Math.max(previous.confidence, item.confidence),
      };
      continue;
    }
    intervals.push({
      id: `${document.videoId}:instant-${item.category}-${item.index}`,
      startSegmentIndex: item.index,
      endSegmentIndex: item.index,
      startSeconds,
      endSeconds,
      category: item.category,
      reason: item.reason,
      confidence: item.confidence,
      enabled: true,
      action: 'skip',
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
    const preferred = previous.confidence >= interval.confidence ? previous : interval;
    const descriptive =
      categoryPriority[interval.category] > categoryPriority[previous.category]
        ? interval
        : previous;
    merged[merged.length - 1] = {
      ...preferred,
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
      reason: preferred.reason,
      action: 'skip',
    };
  }
  return merged;
};

export const buildInstantSmartSkipAnalysis = (
  document: TranscriptDocument,
  trackId: string,
  configuration: SmartSkipConfiguration,
): SmartSkipAnalysis => {
  const duration =
    document.durationSeconds ?? document.segments.at(-1)?.endSeconds ?? 0;
  const intervals = mergeIntervals(document.videoId, [
    ...intervalsFromClassifications(
      document,
      growClassifications(
        document,
        classifySegments(document, configuration),
        configuration,
      ),
    ),
    ...emptySpaceIntervals(document, configuration),
  ]);
  const cutDuration = intervals.reduce(
    (total, interval) => total + interval.endSeconds - interval.startSeconds,
    0,
  );
  const reviewRequired = duration > 0 && cutDuration / duration > 0.35;
  let safeIntervals = intervals;
  if (reviewRequired) {
    let remainingDuration = duration * 0.35;
    const enabledSkipIds = new Set<string>();
    for (const interval of [...intervals]
      .filter((candidate) => (candidate.action ?? 'skip') === 'skip')
      .sort((left, right) => right.confidence - left.confidence)) {
      const candidateDuration = interval.endSeconds - interval.startSeconds;
      if (candidateDuration > remainingDuration) continue;
      enabledSkipIds.add(interval.id);
      remainingDuration -= candidateDuration;
    }
    safeIntervals = intervals.map((interval) =>
      (interval.action ?? 'skip') === 'skip'
        ? { ...interval, enabled: enabledSkipIds.has(interval.id) }
        : interval,
    );
  }
  return {
    schemaVersion: 1,
    videoId: document.videoId,
    trackId,
    transcriptFingerprint: transcriptFingerprint(document),
    provider: configuration.provider,
    strictness: configuration.strictness,
    categories: configuration.categories,
    intervals: safeIntervals,
    analyzedAt: Date.now(),
    reviewRequired,
  };
};
