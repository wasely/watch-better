export interface QuickLearnQuestionInput {
  readonly videoTitle: string;
}

/** The answer a viewer wants before deciding whether the video's hook earns a click. */
export const buildQuickLearnQuestion = ({
  videoTitle,
}: QuickLearnQuestionInput): string =>
  [
    "Answer the obvious question or curiosity created by this video's title.",
    '',
    `TITLE HOOK: ${videoTitle}`,
    '',
    'Use the title and transcript together. Give the viewer the answer they wanted before clicking.',
    'If the title asks what happened, state the change, outcome, and main cause. If it asks for the best tool, skill, method, or example, name it immediately and explain what it does.',
    '',
    'RESPONSE',
    '- Answer only in English. Translate non-English transcript evidence into English instead of reproducing it verbatim.',
    '- Return exactly one short paragraph of 2–4 sentences and no more than 80 words.',
    '- The first sentence must give the direct answer implied by the title. State the specific person, tool, change, cause, or result immediately.',
    '- Use the remaining sentences for only the one or two concrete facts needed to understand that answer.',
    '- Use at most one transcript timestamp, and only when it materially increases trust.',
    '- No headings, bullets, preamble, analysis framing, recommendations, links, follow-up questions, or phrases such as “the video explains” and “based on the transcript.”',
    '- If the supplied transcript does not establish the answer, say so plainly in the same short paragraph instead of guessing.',
  ]
    .filter(Boolean)
    .join('\n');
