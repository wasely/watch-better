import type {
  TranscriptDocument,
  TranscriptSegment,
  TranscriptTrack,
} from '@/features/transcript/domain';
import type { TranscriptViewState } from '@/features/transcript/transcript-view-state';

const tutorialLines = [
  'Today we are going to build a repeatable research workflow for long technical videos.',
  'Start by deciding what evidence would make the video useful before you press play.',
  'A timestamped transcript gives you a map of the argument instead of a wall of text.',
  'Search for the specific tool, claim, person, or process that brought you to the video.',
  'When you find a promising section, jump to it and listen with the surrounding context.',
  'Select the lines that contain the actual evidence rather than copying the whole video.',
  'Good notes preserve the source title, URL, and timestamps so every claim is traceable.',
  'The fastest workflow still keeps the user in control of what gets copied or shared.',
  'Automatic captions can contain mistakes, especially for names and technical language.',
  'That means the interface should label the source and make uncertainty visible.',
  'Pause compression is different from semantic skipping because it does not judge ideas.',
  'A conservative setting should preserve a little audio before and after each sentence.',
  'If timing data looks malformed, the safest action is to leave playback untouched.',
  'The same safety rule applies while an advertisement or unsupported player is active.',
  'A useful tool can be compact without hiding its current mode, state, or consequences.',
  'Keyboard navigation and visible focus matter when the transcript contains many rows.',
  'Long translated phrases should wrap naturally instead of pushing controls off screen.',
  'When search returns several matches, previous and next controls should preserve context.',
  'Manual scrolling should suspend automatic following so the interface does not fight you.',
  'An explicit resume control makes that state easy to understand and reverse.',
  'The Ask workflow should build a structured prompt with only the requested context.',
  'Opening ChatGPT is separate from copying, and Watch Better never claims to be the model.',
  'Every loading or failure state should explain what happened without inventing content.',
  'Once the foundation is predictable, richer analysis can be added without redesigning it.',
  'The final check is simple: can a researcher reach useful evidence faster and trust it?',
] as const;

const podcastTopics = [
  'research planning',
  'source evaluation',
  'creative constraints',
  'product decisions',
  'technical tradeoffs',
  'user interviews',
  'editing workflows',
  'learning systems',
] as const;

const createSegments = (
  count: number,
  secondsPerSegment: number,
  textForIndex: (index: number) => string,
  prefix: string,
): readonly TranscriptSegment[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index.toString().padStart(4, '0')}`,
    startSeconds: index * secondsPerSegment,
    endSeconds: (index + 1) * secondsPerSegment - 0.35,
    text: textForIndex(index),
  }));

const makeDocument = (
  videoId: string,
  title: string,
  segments: readonly TranscriptSegment[],
  options: {
    readonly languageCode?: string;
    readonly languageLabel?: string;
    readonly isAutomatic?: boolean | null;
  } = {},
): TranscriptDocument => ({
  videoId,
  videoTitle: title,
  languageCode: options.languageCode ?? 'en',
  languageLabel: options.languageLabel ?? 'English',
  isAutomatic: options.isAutomatic ?? false,
  durationSeconds: segments.at(-1)?.endSeconds ?? null,
  segments,
});

export const tutorialTranscript = makeDocument(
  'fixture-tutorial',
  'Build a faster research workflow from long videos',
  createSegments(
    tutorialLines.length,
    12,
    (index) => tutorialLines[index] ?? tutorialLines[0],
    'tutorial',
  ),
);

export const podcastTranscript = makeDocument(
  'fixture-podcast',
  'Two-hour creator research roundtable',
  createSegments(
    720,
    10,
    (index) => {
      const topic = podcastTopics[index % podcastTopics.length] ?? 'research';
      const chapter = Math.floor(index / 60) + 1;
      return `In chapter ${chapter}, the panel returns to ${topic} and compares a practical example with the assumptions behind it. This is transcript segment ${index + 1}.`;
    },
    'podcast',
  ),
);

export const fragmentedTranscript = makeDocument(
  'fixture-fragments',
  'Automatic captions with many short fragments',
  createSegments(
    150,
    2.1,
    (index) =>
      [
        'and then',
        'we test the next part',
        'right here',
        'before moving on',
        'to the actual result',
      ][index % 5] ?? 'caption fragment',
    'fragment',
  ),
  { isAutomatic: true },
);

const longTechnicalLine =
  'The adapter receives playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks, validates every baseUrl, languageCode, kind, and vssId field, then normalizes timing without allowing a malformed payload or extremely_long_unbroken_identifier_like_this_one_to_expand_the_panel_beyond_its_available_width.';

export const technicalTranscript = makeDocument(
  'fixture-technical',
  'Caption extraction architecture review',
  createSegments(
    32,
    11,
    (index) =>
      `${longTechnicalLine} Review point ${index + 1} keeps the source boundary explicit.`,
    'technical',
  ),
);

export const spanishTranscript = makeDocument(
  'fixture-tutorial',
  'Crear un flujo de investigación más rápido con videos largos',
  createSegments(
    tutorialLines.length,
    12,
    (index) =>
      `Sección ${index + 1}: usa la transcripción con marcas de tiempo para encontrar evidencia útil sin perder el contexto del video.`,
    'spanish',
  ),
  { languageCode: 'es', languageLabel: 'Español' },
);

export const englishTrack: TranscriptTrack = {
  id: 'en-human',
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: false,
};

export const spanishTrack: TranscriptTrack = {
  id: 'es-human',
  languageCode: 'es',
  languageLabel: 'Español',
  isAutomatic: false,
};

export const automaticEnglishTrack: TranscriptTrack = {
  id: 'en-auto',
  languageCode: 'en',
  languageLabel: 'English',
  isAutomatic: true,
};

export const readyTranscriptState = (
  document: TranscriptDocument = tutorialTranscript,
  tracks: readonly TranscriptTrack[] = [englishTrack],
  selectedTrackId = tracks[0]?.id ?? 'en-human',
): TranscriptViewState => ({
  kind: 'ready',
  document,
  tracks,
  selectedTrackId,
});

export const transcriptFixtureStates = {
  tutorial: readyTranscriptState(),
  podcast: readyTranscriptState(podcastTranscript),
  fragments: readyTranscriptState(
    fragmentedTranscript,
    [automaticEnglishTrack],
    'en-auto',
  ),
  technical: readyTranscriptState(technicalTranscript),
  multilingual: readyTranscriptState(
    tutorialTranscript,
    [englishTrack, spanishTrack, automaticEnglishTrack],
    englishTrack.id,
  ),
  loading: { kind: 'loading' },
  unavailable: { kind: 'unavailable' },
  disabled: { kind: 'disabled' },
  error: {
    kind: 'error',
    message:
      'YouTube returned caption metadata, but the selected track could not be read.',
  },
} satisfies Record<string, TranscriptViewState>;

export type TranscriptFixtureId = keyof typeof transcriptFixtureStates;
