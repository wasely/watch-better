import { describe, expect, it, vi } from 'vitest';

import { WEB_CHAT_PROVIDERS } from './web-chat';
import {
  composerText,
  fillComposer,
  focusComposerAtEnd,
  responseTexts,
  submitComposer,
} from './web-chat-dom';

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

  it('focuses the provider composer with the caret at the end', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Transcript context\n\nQUESTION\n';
    document.body.append(textarea);

    focusComposerAtEnd(textarea);

    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });

  it('submits through the provider send button and falls back to Enter', () => {
    document.body.innerHTML =
      '<textarea></textarea><button class="send-button">Send</button>';
    const composer = document.querySelector('textarea');
    const sendButton = document.querySelector('button');
    if (!composer || !sendButton) throw new Error('Expected composer controls.');
    const click = vi.fn();
    sendButton.addEventListener('click', click);

    submitComposer(WEB_CHAT_PROVIDERS.gemini, composer);
    expect(click).toHaveBeenCalledOnce();

    sendButton.disabled = true;
    const enter = vi.fn();
    composer.addEventListener('keydown', enter);
    submitComposer(WEB_CHAT_PROVIDERS.gemini, composer);
    expect(enter).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter', code: 'Enter' }),
    );
  });
});
