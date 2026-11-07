import { describe, expect, it, vi } from 'vitest';

import { WEB_CHAT_PROVIDERS } from './web-chat';
import {
  attachImageFile,
  composerText,
  fetchImageFile,
  fillComposer,
  fillComposerWithOptionalImage,
  focusComposerAtEnd,
  pasteImageFromSystemClipboard,
  responseTexts,
  submitComposer,
  submitComposerWhenReady,
} from './web-chat-dom';

describe('web chat DOM adapter', () => {
  it('fetches and attaches a YouTube thumbnail to the provider composer', async () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <input accept="image/*" type="file" />
    `;
    const composer = document.querySelector('textarea');
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!composer || !input) throw new Error('Expected provider attachment controls.');
    input.addEventListener('change', () =>
      document.body.append(document.createElement('file-preview')),
    );
    const fetcher = vi.fn(() =>
      Promise.resolve({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        blob: () => Promise.resolve(new Blob(['thumbnail'], { type: 'image/jpeg' })),
      } as unknown as Response),
    );

    const file = await fetchImageFile(
      'https://i.ytimg.com/vi/example/hqdefault.jpg',
      fetcher,
    );
    expect(file).toMatchObject({ name: 'youtube-thumbnail.jpg', type: 'image/jpeg' });
    expect(file && (await attachImageFile(composer, file))).toBe(true);
    expect(input.files?.[0]).toMatchObject({
      name: 'youtube-thumbnail.jpg',
      type: 'image/jpeg',
    });
  });

  it('rejects an oversized thumbnail before reading its body', async () => {
    const readBody = vi.fn(() =>
      Promise.resolve(new Blob(['not read'], { type: 'image/jpeg' })),
    );
    const fetcher = vi.fn(() =>
      Promise.resolve({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-length' ? '5000001' : 'image/jpeg'),
        },
        blob: readBody,
      } as unknown as Response),
    );

    await expect(
      fetchImageFile('https://i.ytimg.com/vi/example/hqdefault.jpg', fetcher),
    ).resolves.toBeNull();
    expect(readBody).not.toHaveBeenCalled();
  });

  it('uses a provider image input rendered outside the composer container', async () => {
    document.body.innerHTML = `
      <input-area-v2><textarea></textarea></input-area-v2>
      <input accept="image/*" type="file" />
    `;
    const composer = document.querySelector('textarea');
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const composerRoot = document.querySelector('input-area-v2');
    if (!composer || !input || !composerRoot)
      throw new Error('Expected provider attachment controls.');
    input.addEventListener('change', () =>
      composerRoot.append(document.createElement('file-preview')),
    );
    const file = new File(['thumbnail'], 'youtube-thumbnail.jpg', {
      type: 'image/jpeg',
    });

    await expect(attachImageFile(composer, file, document)).resolves.toBe(true);
    expect(input.files?.[0]).toMatchObject({
      name: 'youtube-thumbnail.jpg',
      type: 'image/jpeg',
    });
  });

  it('attaches through a direct file paste without system clipboard access', async () => {
    document.body.innerHTML = `
      <input-area-v2>
        <div aria-label="Enter a prompt here" contenteditable="true"></div>
      </input-area-v2>
    `;
    const composer = document.querySelector<HTMLElement>('[contenteditable="true"]');
    const composerRoot = document.querySelector('input-area-v2');
    if (!composer || !composerRoot) throw new Error('Expected Gemini composer.');
    let pastedFile: File | null = null;
    composer.addEventListener('paste', (event) => {
      pastedFile = event.clipboardData?.files[0] ?? null;
      composerRoot.append(document.createElement('file-preview'));
      event.preventDefault();
    });
    const file = new File(['thumbnail'], 'youtube-thumbnail.jpg', {
      type: 'image/jpeg',
    });

    await expect(attachImageFile(composer, file, document)).resolves.toBe(true);
    expect(pastedFile).toMatchObject({
      name: 'youtube-thumbnail.jpg',
      type: 'image/jpeg',
    });
  });

  it('opens Gemini Add files and uses the file input it creates', async () => {
    document.body.innerHTML = `
      <input-area-v2>
        <div aria-label="Enter a prompt here" contenteditable="true"></div>
        <button aria-label="Add files" type="button">Attach</button>
      </input-area-v2>
    `;
    const composer = document.querySelector<HTMLElement>('[contenteditable="true"]');
    const composerRoot = document.querySelector('input-area-v2');
    const addFiles = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Add files"]',
    );
    if (!composer || !composerRoot || !addFiles)
      throw new Error('Expected Gemini attachment controls.');
    addFiles.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () =>
        composerRoot.append(document.createElement('file-preview')),
      );
      document.body.append(input);
    });
    const file = new File(['thumbnail'], 'youtube-thumbnail.jpg', {
      type: 'image/jpeg',
    });

    await expect(attachImageFile(composer, file, document)).resolves.toBe(true);
    expect(addFiles).toHaveFocus();
    expect(
      document.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0],
    ).toMatchObject({ name: 'youtube-thumbnail.jpg', type: 'image/jpeg' });
  });

  it('uses Gemini upload menu as soon as it appears', async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = `
        <input-area-v2>
          <div aria-label="Enter a prompt here" contenteditable="true"></div>
          <button aria-label="Add files" type="button">Attach</button>
        </input-area-v2>
      `;
      const composer = document.querySelector<HTMLElement>('[contenteditable="true"]');
      const composerRoot = document.querySelector('input-area-v2');
      const addFiles = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Add files"]',
      );
      if (!composer || !composerRoot || !addFiles)
        throw new Error('Expected Gemini attachment controls.');
      addFiles.addEventListener('click', () => {
        const upload = document.createElement('button');
        upload.setAttribute('role', 'menuitem');
        upload.textContent = 'Upload files';
        upload.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.addEventListener('change', () =>
            composerRoot.append(document.createElement('file-preview')),
          );
          document.body.append(input);
        });
        document.body.append(upload);
      });
      const file = new File(['thumbnail'], 'youtube-thumbnail.jpg', {
        type: 'image/jpeg',
      });
      let result: boolean | undefined;

      void attachImageFile(composer, file, document).then((attached) => {
        result = attached;
      });
      await vi.advanceTimersByTimeAsync(120);

      expect(result).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

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

    sendButton.remove();
    const enter = vi.fn();
    composer.addEventListener('keydown', enter);
    submitComposer(WEB_CHAT_PROVIDERS.chatgpt, composer);
    expect(enter).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter', code: 'Enter' }),
    );
  });

  it('clicks the enabled Gemini arrow instead of a disabled duplicate', () => {
    document.body.innerHTML = `
      <button class="send-button" disabled>Hidden duplicate</button>
      <input-area-v2>
        <textarea></textarea>
        <button aria-label="Send message" class="send-button">Send</button>
      </input-area-v2>
    `;
    const composer = document.querySelector('textarea');
    const buttons = document.querySelectorAll<HTMLButtonElement>('button');
    if (!composer || buttons.length !== 2) throw new Error('Expected Gemini controls.');
    const click = vi.fn();
    buttons[1]?.addEventListener('click', click);

    submitComposer(WEB_CHAT_PROVIDERS.gemini, composer);

    expect(click).toHaveBeenCalledOnce();
  });

  it('waits for Gemini to enable its send arrow before clicking', async () => {
    document.body.innerHTML = `
      <input-area-v2>
        <textarea></textarea>
        <button aria-label="Send message" class="send-button" disabled>Send</button>
      </input-area-v2>
    `;
    const composer = document.querySelector('textarea');
    const sendButton = document.querySelector('button');
    if (!composer || !sendButton) throw new Error('Expected Gemini controls.');
    const click = vi.fn();
    sendButton.addEventListener('click', click);
    window.setTimeout(() => {
      sendButton.disabled = false;
    }, 10);

    await expect(
      submitComposerWhenReady(WEB_CHAT_PROVIDERS.gemini, composer, {
        pollIntervalMs: 5,
        timeoutMs: 100,
      }),
    ).resolves.toBe(true);
    expect(click).toHaveBeenCalledOnce();
  });

  it('waits for Gemini to render its send arrow instead of pressing Enter early', async () => {
    document.body.innerHTML = '<input-area-v2><textarea></textarea></input-area-v2>';
    const container = document.querySelector('input-area-v2');
    const composer = document.querySelector('textarea');
    if (!container || !composer) throw new Error('Expected Gemini composer.');
    const enter = vi.fn();
    const click = vi.fn();
    composer.addEventListener('keydown', enter);
    window.setTimeout(() => {
      const sendButton = document.createElement('button');
      sendButton.className = 'send-button';
      sendButton.addEventListener('click', click);
      container.append(sendButton);
    }, 10);

    await expect(
      submitComposerWhenReady(WEB_CHAT_PROVIDERS.gemini, composer, {
        pollIntervalMs: 5,
        timeoutMs: 100,
      }),
    ).resolves.toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(enter).not.toHaveBeenCalled();
  });

  it('stages an image on the system clipboard, pastes it, then restores the clipboard', async () => {
    const composer = document.createElement('div');
    composer.contentEditable = 'true';
    composer.tabIndex = 0;
    document.body.append(composer);
    const previous = [{ types: ['text/plain'] }] as unknown as ClipboardItems;
    const staged = { types: ['image/png'] } as unknown as ClipboardItem;
    const write = vi.fn(() => Promise.resolve());
    const paste = vi.fn(() => true);
    const file = new File(['thumbnail'], 'youtube-thumbnail.png', {
      type: 'image/png',
    });

    await expect(
      pasteImageFromSystemClipboard(composer, file, {
        clipboard: {
          read: () => Promise.resolve(previous),
          write,
        },
        createClipboardItem: () => staged,
        convertToPng: (image) => Promise.resolve(image),
        paste,
      }),
    ).resolves.toBe(true);

    expect(paste).toHaveBeenCalledOnce();
    expect(write).toHaveBeenNthCalledWith(1, [staged]);
    expect(write).toHaveBeenNthCalledWith(2, previous);
    expect(document.activeElement).toBe(composer);
  });

  it('dispatches an image paste when Chrome rejects execCommand paste', async () => {
    const composer = document.createElement('div');
    composer.contentEditable = 'true';
    document.body.append(composer);
    const previous = [{ types: ['text/plain'] }] as unknown as ClipboardItems;
    const staged = { types: ['image/png'] } as unknown as ClipboardItem;
    const write = vi.fn(() => Promise.resolve());
    const paste = vi.fn(() => false);
    const file = new File(['thumbnail'], 'youtube-thumbnail.png', {
      type: 'image/png',
    });
    let pastedFile: File | null = null;
    composer.addEventListener('paste', (event) => {
      pastedFile = event.clipboardData?.files[0] ?? null;
      event.preventDefault();
    });

    await expect(
      pasteImageFromSystemClipboard(composer, file, {
        clipboard: {
          read: () => Promise.resolve(previous),
          write,
        },
        createClipboardItem: () => staged,
        convertToPng: (image) => Promise.resolve(image),
        paste,
      }),
    ).resolves.toBe(true);

    expect(paste).toHaveBeenCalledOnce();
    expect(pastedFile).toMatchObject({
      name: 'youtube-thumbnail.png',
      type: 'image/png',
    });
    expect(write).toHaveBeenNthCalledWith(1, [staged]);
    expect(write).toHaveBeenNthCalledWith(2, previous);
  });

  it('fills the transcript prompt when thumbnail attachment fails', async () => {
    const composer = document.createElement('textarea');
    const image = new File(['thumbnail'], 'youtube-thumbnail.jpg', {
      type: 'image/jpeg',
    });
    const fetchImage = vi.fn(() => Promise.resolve(image));
    const attachImage = vi.fn(() => Promise.resolve(false));

    await expect(
      fillComposerWithOptionalImage(
        composer,
        'TRANSCRIPT CONTEXT\n[00:00] Opening claim',
        'https://i.ytimg.com/vi/example/hqdefault.jpg',
        document,
        { fetchImage, attachImage },
      ),
    ).resolves.toBe(false);

    expect(composerText(composer)).toContain('TRANSCRIPT CONTEXT');
    expect(fetchImage).toHaveBeenCalledOnce();
    expect(attachImage).toHaveBeenCalledOnce();
  });
});
