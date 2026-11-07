import type { WebChatProviderDefinition } from './web-chat';

const MAX_IMAGE_BYTES = 5_000_000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_FETCH_TIMEOUT_MS = 3_000;
const ATTACHMENT_CONFIRM_TIMEOUT_MS = 3_000;
const DIRECT_PASTE_CONFIRM_TIMEOUT_MS = 750;
const ATTACHMENT_POLL_INTERVAL_MS = 60;

const ATTACHMENT_SELECTORS = [
  'file-preview',
  'image-preview',
  'upload-image',
  'mat-chip',
  '[data-testid*="attachment" i]',
  '[data-test-id*="attachment" i]',
  '[class*="image-preview" i]',
  '[class*="file-preview" i]',
  'img[src^="blob:"]',
  'img[src^="data:image"]',
  'button[aria-label*="remove attached" i]',
  'button[aria-label*="remove image" i]',
] as const;

const IMAGE_UPLOAD_CONTROL_SELECTORS = [
  'button[aria-label*="add file" i]',
  'button[aria-label*="attach file" i]',
  'button[aria-label*="upload" i]',
  'button[aria-label*="add image" i]',
  '[role="button"][aria-label*="add file" i]',
  '[role="button"][aria-label*="attach file" i]',
  '[role="button"][aria-label*="upload" i]',
  '[data-testid*="upload" i]',
  '[data-test-id*="upload" i]',
] as const;
const IMAGE_UPLOAD_MENU_PATTERN =
  /(?:add|attach|upload)(?: an?)? (?:file|files|image|photo)|from (?:computer|device)/i;

const imageExtension = (mimeType: string): string => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
};

export const fetchImageFile = async (
  imageUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<File | null> => {
  try {
    const response = await fetcher(imageUrl, {
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const declaredType = response.headers.get('content-type')?.split(';')[0]?.trim();
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES)
      return null;
    const blob = await response.blob();
    const mimeType = declaredType || blob.type;
    if (!ALLOWED_IMAGE_TYPES.has(mimeType) || blob.size > MAX_IMAGE_BYTES) return null;
    return new File([blob], `youtube-thumbnail.${imageExtension(mimeType)}`, {
      type: mimeType,
    });
  } catch {
    return null;
  }
};

const transferFor = (file: File): DataTransfer => {
  if (typeof DataTransfer === 'function') {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    return transfer;
  }
  return {
    files: [file],
    items: [{ getAsFile: () => file, kind: 'file', type: file.type }],
    types: ['Files'],
    clearData: () => undefined,
    dropEffect: 'none',
    effectAllowed: 'all',
    getData: () => '',
    setData: () => true,
    setDragImage: () => undefined,
  } as unknown as DataTransfer;
};

const dispatchImagePaste = (composer: HTMLElement, file: File): boolean => {
  const transfer = transferFor(file);
  const event =
    typeof ClipboardEvent === 'function'
      ? new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer,
          composed: true,
        })
      : Object.assign(
          new Event('paste', { bubbles: true, cancelable: true, composed: true }),
          { clipboardData: transfer },
        );
  composer.dispatchEvent(event);
  return true;
};

export interface ClipboardImagePasteDependencies {
  readonly clipboard: Pick<Clipboard, 'read' | 'write'>;
  readonly createClipboardItem: (blob: Blob) => ClipboardItem;
  readonly convertToPng: (file: File) => Promise<Blob>;
  readonly paste: () => boolean;
}

const convertImageToPng = async (file: File): Promise<Blob> => {
  if (file.type === 'image/png') return file;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion is unavailable.');
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('Image conversion failed.')),
        'image/png',
      );
    });
  } finally {
    bitmap.close();
  }
};

const defaultClipboardDependencies = (): ClipboardImagePasteDependencies => ({
  clipboard: navigator.clipboard,
  createClipboardItem: (blob) =>
    new ClipboardItem({ [blob.type]: blob }, { presentationStyle: 'attachment' }),
  convertToPng: convertImageToPng,
  paste: () => document.execCommand('paste'),
});

/** Gemini has no scriptable file input, so a real clipboard paste is its upload path. */
export const pasteImageFromSystemClipboard = async (
  composer: HTMLElement,
  file: File,
  dependencies: ClipboardImagePasteDependencies = defaultClipboardDependencies(),
): Promise<boolean> => {
  const previous = await dependencies.clipboard.read();
  const blob = await dependencies.convertToPng(file);
  const item = dependencies.createClipboardItem(blob);
  let staged = false;
  try {
    await dependencies.clipboard.write([item]);
    staged = true;
    composer.focus({ preventScroll: true });
    if (dependencies.paste()) return true;
    const pastedFile = new File(
      [blob],
      `youtube-thumbnail.${imageExtension(blob.type)}`,
      { type: blob.type },
    );
    return dispatchImagePaste(composer, pastedFile);
  } finally {
    if (staged) await dependencies.clipboard.write(previous);
  }
};

const attachmentRootFor = (composer: HTMLElement, root: ParentNode): ParentNode =>
  composer.closest(
    'input-area-v2, bard-text-input, form, .input-area-container, .input-area-v2',
  ) ?? root;

const attachmentCount = (root: ParentNode): number => {
  const matches = new Set<Element>();
  for (const selector of ATTACHMENT_SELECTORS)
    root.querySelectorAll(selector).forEach((element) => matches.add(element));
  return [...matches].filter(visible).length;
};

const waitForAttachment = async (
  root: ParentNode,
  beforeCount: number,
  timeoutMs = ATTACHMENT_CONFIRM_TIMEOUT_MS,
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  do {
    if (attachmentCount(root) > beforeCount) return true;
    await new Promise((resolve) =>
      window.setTimeout(resolve, ATTACHMENT_POLL_INTERVAL_MS),
    );
  } while (Date.now() < deadline);
  return false;
};

const imageInputFrom = (roots: readonly ParentNode[]): HTMLInputElement | null => {
  const inputs = new Set<HTMLInputElement>();
  roots.forEach((inputRoot) =>
    inputRoot
      .querySelectorAll<HTMLInputElement>('input[type="file"]')
      .forEach((candidate) => inputs.add(candidate)),
  );
  return (
    [...inputs].find(
      (candidate) => !candidate.accept || candidate.accept.includes('image'),
    ) ?? null
  );
};

const waitForImageInput = async (
  roots: readonly ParentNode[],
  timeoutMs = DIRECT_PASTE_CONFIRM_TIMEOUT_MS,
): Promise<HTMLInputElement | null> => {
  const deadline = Date.now() + timeoutMs;
  do {
    const input = imageInputFrom(roots);
    if (input) return input;
    await new Promise((resolve) =>
      window.setTimeout(resolve, ATTACHMENT_POLL_INTERVAL_MS),
    );
  } while (Date.now() < deadline);
  return null;
};

const visibleControl = (element: Element): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

const uploadMenuItemFrom = (
  roots: readonly ParentNode[],
  control: HTMLElement,
): HTMLElement | null => {
  const menuItems = new Set<HTMLElement>();
  for (const root of roots)
    root
      .querySelectorAll('[role="menuitem"], [role="option"], button, [role="button"]')
      .forEach((candidate) => {
        if (candidate !== control && visibleControl(candidate))
          menuItems.add(candidate);
      });
  return (
    [...menuItems].find((candidate) =>
      IMAGE_UPLOAD_MENU_PATTERN.test(
        `${candidate.getAttribute('aria-label') ?? ''} ${candidate.getAttribute('title') ?? ''} ${candidate.textContent ?? ''}`,
      ),
    ) ?? null
  );
};

const openProviderImageInput = async (
  roots: readonly ParentNode[],
): Promise<HTMLInputElement | null> => {
  const controls = new Set<HTMLElement>();
  for (const root of roots)
    for (const selector of IMAGE_UPLOAD_CONTROL_SELECTORS)
      root.querySelectorAll(selector).forEach((candidate) => {
        if (visibleControl(candidate)) controls.add(candidate);
      });
  const control = [...controls][0];
  if (!control) return null;
  control.focus({ preventScroll: true });
  control.click();
  const deadline = Date.now() + DIRECT_PASTE_CONFIRM_TIMEOUT_MS;
  do {
    const directInput = imageInputFrom(roots);
    if (directInput) return directInput;
    const uploadItem = uploadMenuItemFrom(roots, control);
    if (uploadItem) {
      uploadItem.focus({ preventScroll: true });
      uploadItem.click();
      return waitForImageInput(roots);
    }
    await new Promise((resolve) =>
      window.setTimeout(resolve, ATTACHMENT_POLL_INTERVAL_MS),
    );
  } while (Date.now() < deadline);
  return null;
};

const attachThroughInput = async (
  input: HTMLInputElement,
  transfer: DataTransfer,
  attachmentRoot: ParentNode,
  beforeCount: number,
): Promise<boolean> => {
  try {
    input.files = transfer.files;
  } catch {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: transfer.files,
    });
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return waitForAttachment(attachmentRoot, beforeCount);
};

export const attachImageFile = async (
  composer: HTMLElement,
  file: File,
  root: ParentNode = document,
): Promise<boolean> => {
  const attachmentRoot = attachmentRootFor(composer, root);
  const beforeCount = attachmentCount(attachmentRoot);
  const transfer = transferFor(file);
  const inputRoots = attachmentRoot === root ? [root] : [attachmentRoot, root];
  const input =
    imageInputFrom(inputRoots) ?? (await openProviderImageInput(inputRoots));
  if (input) return attachThroughInput(input, transfer, attachmentRoot, beforeCount);

  dispatchImagePaste(composer, file);
  if (
    await waitForAttachment(
      attachmentRoot,
      beforeCount,
      DIRECT_PASTE_CONFIRM_TIMEOUT_MS,
    )
  )
    return true;

  try {
    if (!(await pasteImageFromSystemClipboard(composer, file))) return false;
    return waitForAttachment(attachmentRoot, beforeCount);
  } catch {
    return false;
  }
};

export interface OptionalImageComposerDependencies {
  readonly fetchImage: typeof fetchImageFile;
  readonly attachImage: typeof attachImageFile;
}

const visible = (element: Element): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

export const firstVisible = (
  selectors: readonly string[],
  root: ParentNode = document,
): HTMLElement | null => {
  for (const selector of selectors) {
    const match = Array.from(root.querySelectorAll(selector)).find(visible);
    if (match) return match;
  }
  return null;
};

export const responseTexts = (
  definition: WebChatProviderDefinition,
  root: ParentNode = document,
): readonly string[] => {
  const seen = new Set<Element>();
  const values: string[] = [];
  for (const selector of definition.responseSelectors) {
    for (const element of root.querySelectorAll(selector)) {
      if (seen.has(element) || !visible(element)) continue;
      seen.add(element);
      const text = element.textContent?.replace(/\s+/g, ' ').trim();
      if (text) values.push(text);
    }
  }
  return values;
};

const setTextAreaValue = (input: HTMLTextAreaElement, text: string): void => {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const insertEditableText = (input: HTMLElement, text: string): boolean => {
  try {
    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection?.removeAllRanges();
    selection?.addRange(range);
    return document.execCommand?.('insertText', false, text) ?? false;
  } catch {
    return false;
  }
};

const setEditableValue = (input: HTMLElement, text: string): void => {
  input.focus();
  const inserted = insertEditableText(input, text);
  if (!inserted) input.textContent = text;
  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: text,
      inputType: 'insertText',
    }),
  );
};

export const fillComposer = (input: HTMLElement, text: string): void => {
  if (input instanceof HTMLTextAreaElement) setTextAreaValue(input, text);
  else setEditableValue(input, text);
};

export const fillComposerWithOptionalImage = async (
  composer: HTMLElement,
  message: string,
  imageUrl?: string,
  root: ParentNode = document,
  dependencies: OptionalImageComposerDependencies = {
    fetchImage: fetchImageFile,
    attachImage: attachImageFile,
  },
): Promise<boolean> => {
  let attached = false;
  if (imageUrl)
    try {
      const image = await dependencies.fetchImage(imageUrl);
      if (image) attached = await dependencies.attachImage(composer, image, root);
    } catch {
      // The transcript remains useful when provider image UI changes or rejects upload.
    }
  fillComposer(composer, message);
  return attached;
};

export const composerText = (input: HTMLElement): string =>
  (input instanceof HTMLTextAreaElement
    ? input.value
    : input.innerText || input.textContent || ''
  ).trim();

export const focusComposerAtEnd = (input: HTMLElement): void => {
  input.focus();
  if (input instanceof HTMLTextAreaElement) {
    input.setSelectionRange(input.value.length, input.value.length);
    return;
  }
  const selection = document.getSelection();
  const range = document.createRange();
  range.selectNodeContents(input);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
};

export const isGenerating = (
  definition: WebChatProviderDefinition,
  root: ParentNode = document,
): boolean => Boolean(firstVisible(definition.generatingSelectors, root));

export const pressEnter = (input: HTMLElement): void => {
  for (const type of ['keydown', 'keypress', 'keyup'])
    input.dispatchEvent(
      new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        code: 'Enter',
        key: 'Enter',
      }),
    );
};

export const submitComposer = (
  definition: WebChatProviderDefinition,
  composer: HTMLElement,
  root: ParentNode = document,
): boolean => {
  const composerRoot =
    composer.closest(
      'input-area-v2, bard-text-input, form, .input-area-container, .input-area-v2',
    ) ?? root;
  const candidates = new Set<HTMLElement>();
  for (const searchRoot of composerRoot === root ? [root] : [composerRoot, root])
    for (const selector of definition.sendSelectors)
      searchRoot.querySelectorAll(selector).forEach((element) => {
        if (element instanceof HTMLElement && visible(element)) candidates.add(element);
      });
  const sendButton = [...candidates].find(
    (candidate) =>
      candidate.getAttribute('aria-disabled') !== 'true' &&
      candidate.getAttribute('aria-hidden') !== 'true' &&
      (!(candidate instanceof HTMLButtonElement) || !candidate.disabled),
  );
  if (sendButton) {
    sendButton.click();
    return true;
  }
  // A disabled send control means the provider is still reconciling editor state.
  // Gemini also swaps its microphone for Send asynchronously, so Enter is never its
  // fallback: wait for the actual arrow instead.
  if (candidates.size > 0 || definition.id === 'gemini') return false;
  pressEnter(composer);
  return true;
};

export const submitComposerWhenReady = async (
  definition: WebChatProviderDefinition,
  composer: HTMLElement,
  options: {
    readonly root?: ParentNode;
    readonly pollIntervalMs?: number;
    readonly timeoutMs?: number;
  } = {},
): Promise<boolean> => {
  const root = options.root ?? document;
  const pollIntervalMs = options.pollIntervalMs ?? 60;
  const deadline = Date.now() + (options.timeoutMs ?? 5_000);
  do {
    if (submitComposer(definition, composer, root)) return true;
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
  } while (Date.now() < deadline);
  return false;
};
