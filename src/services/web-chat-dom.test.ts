import { describe, expect, it } from 'vitest';

import { WEB_CHAT_PROVIDERS } from './web-chat';
import { composerText, fillComposer, responseTexts } from './web-chat-dom';

describe('web chat DOM adapter', () => {
  it('fills textarea and contenteditable composers', () => {
    const textarea = document.createElement('textarea');
    fillComposer(textarea, 'Transcript question');
    expect(composerText(textarea)).toBe('Transcript question');

    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.append(editable);
    fillComposer(editable, 'Grounded follow-up');
    expect(composerText(editable)).toBe('Grounded follow-up');
  });

  it('collects assistant text without executing or parsing markup', () => {
    document.body.innerHTML = `
      <div data-message-author-role="assistant"><p>Answer <strong>[01:20]</strong></p></div>
    `;
    expect(responseTexts(WEB_CHAT_PROVIDERS.chatgpt)).toEqual(['Answer [01:20]']);
  });
});
