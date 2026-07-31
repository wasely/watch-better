import type { WebChatProviderDefinition } from './web-chat';

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

export const composerText = (input: HTMLElement): string =>
  (input instanceof HTMLTextAreaElement
    ? input.value
    : (input.textContent ?? '')
  ).trim();

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
