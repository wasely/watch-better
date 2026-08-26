export interface QuickLearnQuestionInput {
  readonly videoTitle: string;
  readonly thumbnailUrl?: string;
}

/** The answer a viewer wants before deciding whether the video's hook earns a click. */
export const buildQuickLearnQuestion = ({
  videoTitle,
  thumbnailUrl,
}: QuickLearnQuestionInput): string =>
  [
    "Give the viewer the useful answer behind this video's click-worthy premise before they decide whether to watch.",
    '',
    `TITLE HOOK: ${videoTitle}`,
    thumbnailUrl ? `THUMBNAIL IMAGE: ${thumbnailUrl}` : '',
    '',
    'Use the title, attached thumbnail (including its visible words and visual claims), and transcript together.',
    'Infer the main questions a reasonable viewer has after seeing that title and thumbnail, then answer them directly.',
    'Explain why the subject matters and whether the video is worth watching.',
    'For a hook such as “this update is wild,” explain exactly what changed, why it is wild or important, and whether the video supports the claim.',
    '',
    'RESPONSE',
    '- Lead with a concise direct answer to the click question. Do not describe this task or ask the viewer to wait.',
    '- Explain what the video is actually about, the important claims/features/examples, why they matter, and any caveats.',
    '- Say who will find it useful and whether it is worth watching.',
    '- Include useful official links for products, tools, papers, or resources presented. Never invent a URL; omit any link you cannot identify confidently.',
    '- Use transcript timestamps for video-specific claims and distinguish evidence from inference.',
    '- Briefly note if the thumbnail or title overstates what the transcript establishes.',
  ]
    .filter(Boolean)
    .join('\n');
