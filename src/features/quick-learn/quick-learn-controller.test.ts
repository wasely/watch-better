import { describe, expect, it, vi } from 'vitest';

import { QuickLearnController } from './quick-learn-controller';

const card = (videoId: string, title: string, thumbnailUrl = ''): string => `
  <ytd-rich-item-renderer>
    <ytd-thumbnail>
      <a id="thumbnail" href="https://www.youtube.com/watch?v=${videoId}"><img alt=""${thumbnailUrl ? ` src="${thumbnailUrl}"` : ''} /></a>
    </ytd-thumbnail>
    <a id="video-title" title="${title}">${title}</a>
  </ytd-rich-item-renderer>`;

/** The newer search/related layout: the thumbnail lives inside the link. */
const lockupCard = (videoId: string, title: string): string => `
  <yt-lockup-view-model>
    <a class="yt-lockup-view-model-wiz__content-image-link" href="https://www.youtube.com/watch?v=${videoId}">
      <yt-thumbnail-view-model><img alt="" /></yt-thumbnail-view-model>
    </a>
    <div class="yt-lockup-metadata-view-model__title">${title}</div>
  </yt-lockup-view-model>`;

/** A lockup whose link is the image frame itself, with no inner thumbnail element. */
const bareLockupCard = (videoId: string, title: string): string => `
  <yt-lockup-view-model>
    <a class="some-future-class-name" href="https://www.youtube.com/watch?v=${videoId}">
      <img alt="" />
    </a>
    <div class="yt-lockup-metadata-view-model__title">${title}</div>
  </yt-lockup-view-model>`;

const shortCard = (videoId: string, title: string): string => `
  <ytd-reel-item-renderer>
    <a id="thumbnail" href="https://www.youtube.com/shorts/${videoId}">
      <img alt="" />
    </a>
    <a id="video-title" title="${title}">${title}</a>
  </ytd-reel-item-renderer>`;

const buttons = (): readonly HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>(
    '[data-watchbetter-quick-learn-button]',
  ),
];

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
    document.body.innerHTML = card(
      'alpha',
      'Battery guide',
      'https://i.ytimg.com/vi/alpha/hqdefault.jpg',
    );
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
      thumbnailUrl: 'https://i.ytimg.com/vi/alpha/hqdefault.jpg',
    });
    expect(popupText()).toBe('');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    controller.dispose();
  });

  it('places the button inside the thumbnail of a lockup card', async () => {
    document.body.innerHTML = lockupCard('lockup', 'Lockup video');
    const openOverlay = vi.fn(() => Promise.resolve());
    const controller = new QuickLearnController(document, openOverlay);
    controller.start();

    const [button] = buttons();
    expect(button).toHaveAccessibleName('Quick Learn: Lockup video');
    expect(button?.closest('yt-thumbnail-view-model')).not.toBeNull();
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await flush();
    expect(openOverlay).toHaveBeenCalledWith({
      videoId: 'lockup',
      videoKind: 'watch',
      videoTitle: 'Lockup video',
      videoUrl: 'https://www.youtube.com/watch?v=lockup',
      thumbnailUrl: 'https://i.ytimg.com/vi/lockup/hqdefault.jpg',
    });
    controller.dispose();
  });

  it('adds exactly one button per card whichever layout YouTube used', () => {
    document.body.innerHTML = `${card('alpha', 'Classic')}${lockupCard('beta', 'Lockup')}`;
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();
    controller.start();

    expect(buttons()).toHaveLength(2);
    controller.dispose();
    expect(buttons()).toHaveLength(0);
  });

  it('positions an unpositioned thumbnail host and restores it on dispose', () => {
    document.body.innerHTML = lockupCard('lockup', 'Lockup video');
    const host = document.querySelector<HTMLElement>('yt-thumbnail-view-model');
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();

    expect(host?.style.position).toBe('relative');
    controller.dispose();
    expect(host?.style.position).toBe('');
    expect(host?.dataset.kaiYoutubeOverlayAnchorOwners).toBeUndefined();
  });

  it('shares thumbnail positioning without releasing another extension lease', () => {
    document.body.innerHTML = lockupCard('lockup', 'Lockup video');
    const host = document.querySelector<HTMLElement>('yt-thumbnail-view-model');
    if (!host) throw new Error('Missing thumbnail host');
    host.dataset.kaiYoutubeOverlayAnchorOwners = 'script-gen';
    host.dataset.kaiYoutubeOverlayAnchorPatched = 'true';
    host.dataset.kaiYoutubeOverlayAnchorOriginal = '';
    host.style.position = 'relative';

    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();

    expect(host.dataset.kaiYoutubeOverlayAnchorOwners?.split(' ').sort()).toEqual([
      'script-gen',
      'watch-better',
    ]);
    controller.dispose();
    expect(host.dataset.kaiYoutubeOverlayAnchorOwners).toBe('script-gen');
    expect(host.style.position).toBe('relative');
    expect(host.dataset.kaiYoutubeOverlayAnchorPatched).toBe('true');
  });

  it('declares its shared owner/slot and clears a top-start vidIQ control', () => {
    document.body.innerHTML = card('alpha', 'Battery guide');
    const host = document.querySelector<HTMLElement>('ytd-thumbnail');
    if (!host) throw new Error('Missing thumbnail host');
    host.innerHTML +=
      '<div class="vidiq-scope"><button aria-label="vidIQ action"></button></div>';
    host.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 320,
        bottom: 180,
        width: 320,
        height: 180,
      }) as DOMRect;
    const vidiq = host.querySelector<HTMLElement>('.vidiq-scope button');
    if (!vidiq) throw new Error('Missing vidIQ fixture');
    vidiq.getBoundingClientRect = () =>
      ({ left: 8, top: 8, right: 42, bottom: 42, width: 34, height: 34 }) as DOMRect;

    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();
    const [button] = buttons();

    expect(button?.dataset.kaiYoutubeOverlayOwner).toBe('watch-better');
    expect(button?.dataset.kaiYoutubeOverlaySlot).toBe('top-start');
    expect(
      Number.parseInt(
        button?.style.getPropertyValue('--kai-youtube-overlay-block-start') ?? '',
        10,
      ),
    ).toBeGreaterThan(8);
    controller.dispose();
  });

  it('leaves a thumbnail that is already positioned alone', () => {
    document.body.innerHTML = card('alpha', 'Battery guide');
    const host = document.querySelector<HTMLElement>('ytd-thumbnail');
    if (host) host.style.position = 'absolute';
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();

    expect(host?.style.position).toBe('absolute');
    controller.dispose();
    expect(host?.style.position).toBe('absolute');
  });

  it('finds the thumbnail by structure when YouTube renames its classes', async () => {
    document.body.innerHTML = bareLockupCard('renamed', 'Renamed classes');
    const openOverlay = vi.fn(() => Promise.resolve());
    const controller = new QuickLearnController(document, openOverlay);
    controller.start();

    const [button] = buttons();
    expect(button).toHaveAccessibleName('Quick Learn: Renamed classes');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(button?.dispatchEvent(click)).toBe(false);
    await flush();
    expect(openOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'renamed' }),
    );
    controller.dispose();
  });

  it('ignores title and channel links that carry no thumbnail', () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <a href="https://www.youtube.com/watch?v=alpha" id="video-title">Title link</a>
        <a href="https://www.youtube.com/@creator">Channel</a>
      </ytd-rich-item-renderer>`;
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();

    expect(buttons()).toHaveLength(0);
    controller.dispose();
  });

  it('gives a nested card its own button and never two for one card', () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <ytd-thumbnail>
          <a id="thumbnail" href="https://www.youtube.com/watch?v=outer"><img alt="" /></a>
        </ytd-thumbnail>
        <a id="video-title" title="Outer">Outer</a>
        ${lockupCard('inner', 'Inner')}
      </ytd-rich-item-renderer>`;
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();

    expect(buttons()).toHaveLength(2);
    expect(
      buttons()
        .map((button) => button.getAttribute('aria-label'))
        .sort(),
    ).toStrictEqual(['Quick Learn: Inner', 'Quick Learn: Outer']);
    controller.dispose();
  });

  it('coalesces repeated requests for the same video while its card opens', async () => {
    document.body.innerHTML = `${card('alpha', 'First copy')}${card('alpha', 'Second copy')}`;
    let resolveOverlay!: () => void;
    const openOverlay = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOverlay = resolve;
        }),
    );
    const controller = new QuickLearnController(document, openOverlay);
    controller.start();
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '[data-watchbetter-quick-learn-button]',
    );

    buttons[0]?.click();
    buttons[1]?.click();
    expect(openOverlay).toHaveBeenCalledTimes(1);
    resolveOverlay();
    await flush();
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

  it('restores its button when a YouTube hover update removes it', async () => {
    document.body.innerHTML = card('alpha', 'Hover preview');
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();
    const firstButton = buttons()[0];

    firstButton?.remove();
    await flush();

    expect(firstButton?.isConnected).toBe(false);
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]).not.toBe(firstButton);
    controller.dispose();
  });

  it('keeps a labeled Quick Learn pill visible on every Shorts card without hover', () => {
    document.body.innerHTML = [
      shortCard('short-a', 'First Short'),
      shortCard('short-b', 'Second Short'),
      shortCard('short-c', 'Third Short'),
    ].join('');
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();

    expect(buttons()).toHaveLength(3);
    for (const button of buttons()) {
      const label = button.querySelector('span');
      expect(label).toHaveTextContent('Quick Learn');
      expect(label).toBeVisible();
      expect(label ? getComputedStyle(label).whiteSpace : '').toBe('nowrap');
      expect(getComputedStyle(button).pointerEvents).toBe('auto');
      button
        .closest('ytd-reel-item-renderer')
        ?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      expect(label).toBeVisible();
    }

    controller.dispose();
  });

  it('uses the page realm while delivering a delayed hover mutation', async () => {
    document.body.innerHTML = card('alpha', 'Delayed hover preview');
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();

    vi.stubGlobal('Element', undefined);
    try {
      buttons()[0]?.remove();
      await flush();
      expect(buttons()).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
      controller.dispose();
    }
  });

  it('uses the thumbnail top-left slot away from hover download controls', () => {
    document.body.innerHTML = card('alpha', 'Collision-free control');
    const controller = new QuickLearnController(document, () => Promise.resolve());
    controller.start();
    const [button] = buttons();
    const style = button ? getComputedStyle(button) : null;

    expect(button?.style.getPropertyValue('--kai-youtube-overlay-block-start')).toBe(
      '8px',
    );
    expect(style?.insetInlineStart).toBe('8px');
    expect(style?.bottom).toBe('auto');
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
