import { describe, expect, it } from 'vitest';

import { buildQuickLearnQuestion } from './quick-learn-prompt';

describe('buildQuickLearnQuestion', () => {
  it('turns the title and transcript into a direct viewer briefing', () => {
    const question = buildQuickLearnQuestion({
      videoTitle: 'This new Google AI Studio update is wild',
    });

    expect(question).toContain('This new Google AI Studio update is wild');
    expect(question).toMatch(/title.*transcript/i);
    expect(question).toMatch(/asks what happened.*change.*outcome.*cause/i);
    expect(question).toMatch(/asks for the best tool.*name it immediately/i);
    expect(question).not.toMatch(/thumbnail/i);
    expect(question).toMatch(/answer only in English/i);
    expect(question).toMatch(/exactly one short paragraph/i);
    expect(question).toMatch(/no more than 80 words/i);
    expect(question).toMatch(/first sentence.*direct answer/i);
    expect(question).toMatch(/no headings/i);
    expect(question).not.toMatch(/official links/i);
    expect(question).not.toMatch(/worth watching/i);
    expect(question).not.toMatch(/initial analysis/i);
    expect(question).not.toContain('Reply only READY');
  });
});
