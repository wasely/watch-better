import { describe, expect, it, vi } from 'vitest';

import { QuickLearnController } from './quick-learn-controller';

const card = (videoId: string, title: string): string => `
  <ytd-rich-item-renderer>
    <ytd-thumbnail>
      <a id="thumbnail" href="https://www.youtube.com/watch?v=${videoId}"><img alt="" /></a>
    </ytd-thumbnail>
    <a id="video-title" title="${title}">${title}</a>
  </ytd-rich-item-renderer>`;

const popupText = (): string =>
  document
    .querySelector<HTMLElement>('[data-watchbetter-quick-learn-popup]')
    ?.shadowRoot?.textContent?.replace(/\s+/g, ' ')
    .trim() ?? '';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('QuickLearnController', () => {
  it('opens an in-page overlay for the thumbnail without navigating YouTube', async () => {
    document.body.innerHTML = card('alpha', 'Battery guide');
    const openOverlay = vi.fn(() => Promise.resolve());
    const controller = new QuickLearnController(document, openOverlay);
    controller.start();

    const button = document.querySelector<HTMLButtonElement>(
      '[data-watchbetter-quick-learn-button]',
    );
    expect(button).toHaveAccessibleName('Quick Learn: Battery guide');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(button?.dispatchEvent(click)).toBe(false);
    await flush();

    expect(openOverlay).toHaveBeenCalledWith({
      videoId: 'alpha',
      videoKind: 'watch',
      videoTitle: 'Battery guide',
      videoUrl: 'https://www.youtube.com/watch?v=alpha',
    });
    expect(popupText()).toBe('');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    controller.dispose();
  });

  it('discovers videos added by YouTube after initial page load', async () => {
    document.body.innerHTML = '<main></main>';
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();
    document
      .querySelector('main')
      ?.insertAdjacentHTML('beforeend', card('alpha', 'New'));
    await flush();

    expect(
      document.querySelector('[data-watchbetter-quick-learn-button]'),
    ).not.toBeNull();
    controller.dispose();
  });

  it('shows an overlay creation error and supports Escape', async () => {
    document.body.innerHTML = card('missing', 'Silent video');
    const controller = new QuickLearnController(document, () =>
      Promise.reject(new Error('Mount failed')),
    );
    controller.start();
    const button = document.querySelector<HTMLButtonElement>(
      '[data-watchbetter-quick-learn-button]',
    );
    button?.click();
    await flush();

    expect(popupText()).toMatch(/could not open quick learn/i);
    expect(popupText()).toMatch(/in-page gemini card/i);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(
      document.querySelector<HTMLElement>('[data-watchbetter-quick-learn-popup]')?.style
        .display,
    ).toBe('none');
    controller.dispose();
  });
});
