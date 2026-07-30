import type { AIContextScope } from '@/features/ask/ai-provider';

export type SuggestedAskActionId =
  | 'summarize'
  | 'key-ideas'
  | 'action-items'
  | 'explain-section'
  | 'tools-resources'
  | 'find-topic'
  | 'structured-notes';

export interface SuggestedAskAction {
  readonly id: SuggestedAskActionId;
  readonly label: string;
  readonly question: string;
  readonly scope: AIContextScope;
}

export const SUGGESTED_ASK_ACTIONS: readonly SuggestedAskAction[] = [
  {
    id: 'summarize',
    label: 'Summarize this video',
    question:
      'Summarize this video for a creator or researcher. Preserve the main argument, strongest evidence, important caveats, and useful timestamp references.',
    scope: 'entire-video',
  },
  {
    id: 'key-ideas',
    label: 'List the key ideas',
    question:
      'List the key ideas in priority order. Explain why each matters and cite its strongest timestamped evidence.',
    scope: 'entire-video',
  },
  {
    id: 'action-items',
    label: 'Extract action items',
    question:
      'Extract concrete action items, instructions, or next steps. Separate explicit recommendations from reasonable inference and cite timestamps.',
    scope: 'entire-video',
  },
  {
    id: 'explain-section',
    label: 'Explain this section',
    question:
      'Explain this section in plain language, including the claim, supporting reasoning, assumptions, and any terms that need context.',
    scope: 'current-section',
  },
  {
    id: 'tools-resources',
    label: 'List tools and resources',
    question:
      'List every tool, product, paper, website, person, or resource mentioned. Explain the stated use and cite the timestamp.',
    scope: 'entire-video',
  },
  {
    id: 'find-topic',
    label: 'Find where they discuss a topic',
    question: 'Find where they discuss ',
    scope: 'entire-video',
  },
  {
    id: 'structured-notes',
    label: 'Turn this into structured notes',
    question:
      'Turn this transcript context into structured research notes with headings, claims, evidence, caveats, and timestamp references.',
    scope: 'entire-video',
  },
];
