import { describe, expect, it } from 'vitest';

import { buildQuickLearnQuestion } from './quick-learn-prompt';

describe('buildQuickLearnQuestion', () => {
  it('turns the title and thumbnail hook into a direct viewer briefing', () => {
    const question = buildQuickLearnQuestion({
      videoTitle: 'This new Google AI Studio update is wild',
      thumbnailUrl: 'https://i.ytimg.com/vi/update/hqdefault.jpg',
    });

    expect(question).toContain('This new Google AI Studio update is wild');
    expect(question).toContain('https://i.ytimg.com/vi/update/hqdefault.jpg');
    expect(question).toMatch(/why.*wild/i);
    expect(question).toMatch(/title.*thumbnail/i);
    expect(question).toMatch(/official links/i);
    expect(question).toMatch(/worth watching/i);
    expect(question).not.toContain('Reply only READY');
  });
});
