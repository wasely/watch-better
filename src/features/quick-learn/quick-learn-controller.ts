import { parseYouTubeVideoUrl } from '@/adapters/youtube/youtube-url';
import { isWebChatImageUrl } from '@/services/web-chat';

/**
 * Every video link, regardless of layout. YouTube renames its lockup classes freely
 * (`__content-image`, `__content-image-link`, `-wiz__content-image-link`, …), so the
 * thumbnail is identified by structure — a video link that wraps an image — rather
 * than by any class name that can be renamed out from under us.
 */
const VIDEO_LINK_SELECTOR = 'a[href*="/watch?"], a[href*="/shorts/"]';

/** What makes a link the thumbnail rather than the title or the channel. */
const IMAGE_SELECTOR = 'img, yt-image, yt-thumbnail-view-model, ytd-thumbnail';

const CARD_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-reel-item-renderer',
  'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model',
].join(',');

// The element the button is placed inside. On classic cards it is an ancestor of the
// thumbnail link; in the newer lockup layout the thumbnail lives *inside* the link.
const THUMBNAIL_BOX_SELECTOR = [
  'ytd-thumbnail',
  'yt-thumbnail-view-model',
  'ytd-reel-item-renderer',
  'ytm-shorts-lockup-view-model',
].join(',');

const BUTTON_ATTRIBUTE = 'data-watchbetter-quick-learn-button';
const STYLE_ATTRIBUTE = 'data-watchbetter-quick-learn-style';
const POPUP_ATTRIBUTE = 'data-watchbetter-quick-learn-popup';
const OVERLAY_OWNER = 'watch-better';
const OVERLAY_OWNER_ATTRIBUTE = 'data-kai-youtube-overlay-owner';
const OVERLAY_SLOT_ATTRIBUTE = 'data-kai-youtube-overlay-slot';
const ANCHOR_OWNERS_ATTRIBUTE = 'data-kai-youtube-overlay-anchor-owners';
const ANCHOR_PATCHED_ATTRIBUTE = 'data-kai-youtube-overlay-anchor-patched';
const ANCHOR_ORIGINAL_ATTRIBUTE = 'data-kai-youtube-overlay-anchor-original';
const CONTROL_INSET = 8;
const COMPACT_CONTROL_INSET = 6;
const CONTROL_SIZE = 34;
const COMPACT_CONTROL_SIZE = 30;
const CONTROL_WIDTH = 122;
const COMPACT_CONTROL_WIDTH = 116;
const CONTROL_GAP = 6;
const COMPACT_CONTROL_GAP = 4;
const COMPACT_HOST_WIDTH = 240;

const overlayOwners = (host: Element): Set<string> =>
  new Set(
    (host.getAttribute(ANCHOR_OWNERS_ATTRIBUTE) ?? '').split(/\s+/).filter(Boolean),
  );

const writeOverlayOwners = (host: Element, owners: Set<string>): void => {
  if (owners.size)
    host.setAttribute(ANCHOR_OWNERS_ATTRIBUTE, [...owners].sort().join(' '));
  else host.removeAttribute(ANCHOR_OWNERS_ATTRIBUTE);
};

const isElementNode = (node: unknown): node is Element =>
  (node as Node | null)?.nodeType === 1;

const isHtmlElementNode = (node: Element): node is HTMLElement =>
  'style' in node && 'dataset' in node;

export interface QuickLearnOverlayRequest {
  readonly videoId: string;
  readonly videoKind: 'watch' | 'shorts';
  readonly videoUrl: string;
  readonly videoTitle: string;
  readonly thumbnailUrl: string;
}

export type QuickLearnOverlayOpener = (
  request: QuickLearnOverlayRequest,
) => Promise<void>;

const SPARK_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.8c.5 4.3 2.5 6.4 6.2 7.2-3.7.8-5.7 3-6.2 7.2-.5-4.2-2.5-6.4-6.2-7.2C9.5 9.2 11.5 7.1 12 2.8Z" />
    <path d="M5.1 13.4c.2 2 1.2 3.1 3 3.5-1.8.4-2.8 1.5-3 3.5-.3-2-1.3-3.1-3.1-3.5 1.8-.4 2.8-1.5 3.1-3.5Z" />
  </svg>`;

const PAGE_STYLES = `
  [${BUTTON_ATTRIBUTE}] {
    all: initial !important;
    align-items: center !important;
    backdrop-filter: blur(12px) saturate(1.2) !important;
    background: rgba(11, 14, 19, .9) !important;
    border: 1px solid rgba(244, 241, 236, .34) !important;
    border-radius: 999px !important;
    box-shadow: 0 5px 18px rgba(0, 0, 0, .35) !important;
    bottom: auto !important;
    box-sizing: border-box !important;
    color: #f4f1ec !important;
    cursor: pointer !important;
    display: flex !important;
    font: 600 12px/1 Arial, sans-serif !important;
    gap: 7px !important;
    height: var(--kai-youtube-overlay-control-size, 34px) !important;
    justify-content: center !important;
    inset-inline-start: 8px !important;
    left: auto !important;
    max-width: var(--kai-youtube-overlay-control-width, 122px) !important;
    min-width: var(--kai-youtube-overlay-control-width, 122px) !important;
    overflow: hidden !important;
    padding: 7px 10px !important;
    pointer-events: auto !important;
    position: absolute !important;
    top: var(--kai-youtube-overlay-block-start, 8px) !important;
    transition: border-color 150ms ease, background 150ms ease !important;
    white-space: nowrap !important;
    width: var(--kai-youtube-overlay-control-width, 122px) !important;
    z-index: 60 !important;
  }
  [${BUTTON_ATTRIBUTE}] svg {
    display: block !important;
    fill: none !important;
    flex: 0 0 18px !important;
    height: 18px !important;
    overflow: visible !important;
    stroke: currentColor !important;
    stroke-linecap: round !important;
    stroke-linejoin: round !important;
    stroke-width: 1.55 !important;
    width: 18px !important;
  }
  [${BUTTON_ATTRIBUTE}] span {
    all: initial !important;
    color: inherit !important;
    font: inherit !important;
    opacity: 1 !important;
    white-space: nowrap !important;
  }
  [${BUTTON_ATTRIBUTE}]:hover,
  [${BUTTON_ATTRIBUTE}]:focus-visible,
  [${BUTTON_ATTRIBUTE}][aria-expanded="true"] {
    background: rgba(21, 26, 34, .97) !important;
    border-color: #f5b64a !important;
  }
  [${BUTTON_ATTRIBUTE}]:focus-visible {
    outline: 2px solid #f5b64a !important;
    outline-offset: 2px !important;
  }
  [${BUTTON_ATTRIBUTE}][data-loading="true"] svg {
    animation: watchbetter-quick-learn-radar 850ms linear infinite !important;
    color: #65cbe2 !important;
  }
  @keyframes watchbetter-quick-learn-radar {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    [${BUTTON_ATTRIBUTE}] { transition: none !important; }
    [${BUTTON_ATTRIBUTE}][data-loading="true"] svg { animation: none !important; }
  }
  [${BUTTON_ATTRIBUTE}][data-compact="true"] {
    inset-inline-start: 6px !important;
    font-size: 11px !important;
    padding: 6px 8px !important;
  }
`;

const POPUP_STYLES = `
  :host { color-scheme: dark; }
  * { box-sizing: border-box; }
  .card {
    background: #0b0e13;
    border: 1px solid #343b48;
    border-radius: 16px;
    box-shadow: 0 18px 54px rgba(0, 0, 0, .48);
    color: #f4f1ec;
    font: 400 14px/1.45 Arial, sans-serif;
    max-height: min(560px, calc(100vh - 24px));
    overflow: auto;
    outline: none;
    width: 100%;
  }
  .topbar {
    align-items: flex-start;
    border-bottom: 1px solid #292f3a;
    display: flex;
    gap: 10px;
    padding: 15px 15px 13px;
  }
  .mark {
    align-items: center;
    background: #171c24;
    border: 1px solid #3a4351;
    border-radius: 9px;
    color: #f5b64a;
    display: flex;
    flex: 0 0 34px;
    height: 34px;
    justify-content: center;
  }
  .mark svg { fill: none; height: 19px; stroke: currentColor; stroke-width: 1.5; width: 19px; }
  .heading { min-width: 0; padding-top: 1px; }
  .eyebrow { color: #65cbe2; font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
  h2 { font-size: 15px; line-height: 1.3; margin: 4px 0 0; overflow-wrap: anywhere; }
  .close {
    appearance: none;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: #97a0af;
    cursor: pointer;
    flex: 0 0 30px;
    font: 24px/28px Arial, sans-serif;
    height: 30px;
    margin-left: auto;
    padding: 0;
  }
  .close:hover { background: #1b2029; color: #f4f1ec; }
  .close:focus-visible, .retry:focus-visible { outline: 2px solid #65cbe2; outline-offset: 2px; }
  .body { padding: 15px; }
  .status { align-items: center; color: #c4cad3; display: flex; gap: 12px; min-height: 74px; }
  .radar { border: 2px solid #3d4654; border-right-color: #65cbe2; border-radius: 50%; flex: 0 0 25px; height: 25px; animation: radar 800ms linear infinite; }
  @keyframes radar { to { transform: rotate(360deg); } }
  .label { color: #97a0af; font-size: 10px; font-weight: 700; letter-spacing: .13em; margin-bottom: 6px; text-transform: uppercase; }
  .summary { color: #e9e6e1; font-size: 14px; line-height: 1.55; margin: 0; }
  .divider { background: #292f3a; height: 1px; margin: 15px 0; }
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: grid; gap: 9px; grid-template-columns: 43px 1fr; padding: 9px 0; }
  li + li { border-top: 1px solid #222833; }
  time { color: #f5b64a; font: 700 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; padding-top: 2px; }
  li span { color: #cbd0d8; line-height: 1.45; }
  .error-title { font-size: 15px; font-weight: 700; margin-bottom: 5px; }
  .error-copy { color: #aeb6c2; margin: 0; }
  .retry { appearance: none; background: #f4f1ec; border: 0; border-radius: 9px; color: #11151b; cursor: pointer; font: 700 13px/1 Arial, sans-serif; margin-top: 13px; padding: 10px 13px; }
  .footer { align-items: center; border-top: 1px solid #292f3a; color: #858f9f; display: flex; font-size: 11px; justify-content: space-between; padding: 10px 15px; }
  .privacy { align-items: center; display: flex; gap: 6px; }
  .privacy::before { background: #65cbe2; border-radius: 50%; content: ''; height: 6px; width: 6px; }
  @media (prefers-reduced-motion: reduce) { .radar { animation: none; } }
`;

const cardTitleFor = (anchor: HTMLAnchorElement): string => {
  const card = anchor.closest(CARD_SELECTOR) ?? anchor.parentElement;
  const title = card?.querySelector<HTMLElement>(
    '#video-title, a#video-title, .yt-lockup-metadata-view-model__title, h3 a',
  );
  return (
    title?.getAttribute('title') ??
    title?.textContent ??
    anchor.getAttribute('aria-label') ??
    'this video'
  )
    .replace(/\s+/g, ' ')
    .trim();
};

const thumbnailUrlFor = (anchor: HTMLAnchorElement): string | undefined => {
  const image = anchor.querySelector<HTMLImageElement>('img');
  for (const candidate of [image?.currentSrc, image?.src, image?.getAttribute('src')]) {
    if (!candidate) continue;
    try {
      const absolute = new URL(candidate, anchor.ownerDocument.location.href).href;
      if (isWebChatImageUrl(absolute)) return absolute;
    } catch {
      // Keep looking: YouTube can leave a transient placeholder before the real image.
    }
  }
  return undefined;
};

const fallbackThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;

interface PopupElements {
  readonly host: HTMLElement;
  readonly frame: HTMLElement;
  readonly title: HTMLElement;
  readonly body: HTMLElement;
  readonly language: HTMLElement;
  readonly close: HTMLButtonElement;
}

/** Opens the existing in-page floating runtime from a video thumbnail. */
export class QuickLearnController {
  readonly #window: Window;
  #observer: MutationObserver | null = null;
  #style: HTMLStyleElement | null = null;
  #popup: PopupElements | null = null;
  #activeButton: HTMLButtonElement | null = null;
  #activeVideoId: string | null = null;
  #activeRequest: QuickLearnOverlayRequest | null = null;
  #scanScheduled = false;
  #scanRoots = new Set<Element>();
  #positionScheduled = false;

  public constructor(
    private readonly documentRef: Document,
    private readonly openOverlay: QuickLearnOverlayOpener,
  ) {
    const windowRef = documentRef.defaultView;
    if (!windowRef) throw new Error('Quick Learn requires a browser document.');
    this.#window = windowRef;
  }

  public start(): void {
    if (this.#observer) return;
    this.#installStyles();
    this.#scan(this.documentRef);
    const observer = new MutationObserver((records: readonly MutationRecord[]) => {
      for (const record of records) {
        if (isElementNode(record.target)) this.#scanRoots.add(record.target);
        for (const node of record.addedNodes)
          if (isElementNode(node)) this.#scanRoots.add(node);
      }
      if (this.#activeButton && !this.#activeButton.isConnected) this.#close(false);
      this.#scheduleScan();
    });
    this.#observer = observer;
    observer.observe(this.documentRef.documentElement, {
      attributes: true,
      attributeFilter: ['href'],
      childList: true,
      subtree: true,
    });
    this.documentRef.addEventListener('pointerdown', this.#onOutsidePointer, true);
    this.documentRef.addEventListener('keydown', this.#onKeyDown, true);
    this.#window.addEventListener('resize', this.#schedulePosition);
    this.#window.addEventListener('scroll', this.#schedulePosition, true);
  }

  public dispose(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.documentRef.removeEventListener('pointerdown', this.#onOutsidePointer, true);
    this.documentRef.removeEventListener('keydown', this.#onKeyDown, true);
    this.#window.removeEventListener('resize', this.#schedulePosition);
    this.#window.removeEventListener('scroll', this.#schedulePosition, true);
    this.documentRef
      .querySelectorAll<HTMLElement>(`[${BUTTON_ATTRIBUTE}]`)
      .forEach((button) => button.remove());
    this.documentRef
      .querySelectorAll<HTMLElement>(`[${ANCHOR_OWNERS_ATTRIBUTE}]`)
      .forEach((host) => this.#releaseHost(host));
    this.#style?.remove();
    this.#style = null;
    this.#popup?.host.remove();
    this.#popup = null;
    this.#activeButton = null;
    this.#activeVideoId = null;
    this.#activeRequest = null;
  }

  readonly #scheduleScan = (): void => {
    if (this.#scanScheduled || this.#scanRoots.size === 0) return;
    this.#scanScheduled = true;
    this.#window.requestAnimationFrame(() => {
      this.#scanScheduled = false;
      const roots = [...this.#scanRoots];
      this.#scanRoots.clear();
      for (const root of roots) this.#scan(root);
    });
  };

  #scan(root: ParentNode): void {
    const cards = new Set<Element>();
    if (isElementNode(root) && root.matches(CARD_SELECTOR)) cards.add(root);
    root.querySelectorAll(CARD_SELECTOR).forEach((card) => cards.add(card));
    if (isElementNode(root)) {
      const owner = root.closest(CARD_SELECTOR);
      if (owner) cards.add(owner);
    }
    for (const card of cards) {
      const anchor = this.#thumbnailLinkIn(card);
      if (anchor) this.#addButton(anchor);
    }
  }

  /**
   * The one link per card that points at the video and carries its image. Nested cards
   * are excluded so a shelf never claims the thumbnail of the card inside it.
   */
  #thumbnailLinkIn(card: Element): HTMLAnchorElement | null {
    const links = [...card.querySelectorAll<HTMLAnchorElement>(VIDEO_LINK_SELECTOR)];
    for (const link of links) {
      if (link.closest(CARD_SELECTOR) !== card) continue;
      if (!parseYouTubeVideoUrl(link.href)) continue;
      if (link.id === 'thumbnail' || link.querySelector(IMAGE_SELECTOR)) return link;
    }
    return null;
  }

  /**
   * Classic cards wrap the link in a thumbnail element; lockup cards put the thumbnail
   * inside the link. Resolving both keeps the button pinned to the image itself rather
   * than to whatever ancestor happens to be positioned.
   */
  #hostFor(anchor: HTMLAnchorElement): Element | null {
    return (
      anchor.closest(THUMBNAIL_BOX_SELECTOR) ??
      anchor.querySelector(THUMBNAIL_BOX_SELECTOR) ??
      // Lockup layouts make the link itself the image frame. Placing the button there
      // is safe: every pointer and click event it fires is stopped before YouTube
      // can navigate.
      (anchor.querySelector('img, yt-image') ? anchor : anchor.parentElement)
    );
  }

  /** Share the positioned thumbnail host with other extensions using the same contract. */
  #anchorHost(host: Element): void {
    if (!isHtmlElementNode(host)) return;
    const owners = overlayOwners(host);
    owners.add(OVERLAY_OWNER);
    writeOverlayOwners(host, owners);
    if (
      this.#window.getComputedStyle(host).position === 'static' &&
      !host.hasAttribute(ANCHOR_PATCHED_ATTRIBUTE)
    ) {
      host.setAttribute(ANCHOR_PATCHED_ATTRIBUTE, 'true');
      host.setAttribute(ANCHOR_ORIGINAL_ATTRIBUTE, host.style.position);
      host.style.position = 'relative';
    }
  }

  #releaseHost(host: HTMLElement): void {
    const owners = overlayOwners(host);
    if (!owners.delete(OVERLAY_OWNER)) return;
    writeOverlayOwners(host, owners);
    if (owners.size || !host.hasAttribute(ANCHOR_PATCHED_ATTRIBUTE)) return;
    if (host.style.position === 'relative') {
      const original = host.getAttribute(ANCHOR_ORIGINAL_ATTRIBUTE) ?? '';
      if (original) host.style.position = original;
      else host.style.removeProperty('position');
    }
    host.removeAttribute(ANCHOR_PATCHED_ATTRIBUTE);
    host.removeAttribute(ANCHOR_ORIGINAL_ATTRIBUTE);
  }

  #placeButton(host: Element, button: HTMLButtonElement): void {
    const hostRect = host.getBoundingClientRect();
    const compact = hostRect.width > 0 && hostRect.width < COMPACT_HOST_WIDTH;
    const size = compact ? COMPACT_CONTROL_SIZE : CONTROL_SIZE;
    const width = compact ? COMPACT_CONTROL_WIDTH : CONTROL_WIDTH;
    const inset = compact ? COMPACT_CONTROL_INSET : CONTROL_INSET;
    const gap = compact ? COMPACT_CONTROL_GAP : CONTROL_GAP;
    const rtl = this.#window.getComputedStyle(host).direction === 'rtl';
    const obstacleSelector = [
      `[${OVERLAY_OWNER_ATTRIBUTE}]`,
      '.vidiq-scope button',
      '.vidiq-scope [role="button"]',
      '.vidiq-scope a',
      'ytd-thumbnail-overlay-toggle-button-renderer',
    ].join(',');
    const obstacles = [...host.querySelectorAll<HTMLElement>(obstacleSelector)]
      .filter((item) => item !== button && !button.contains(item))
      .map((item) => item.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    let blockStart = inset;
    if (hostRect.width > 0 && hostRect.height > 0) {
      const inlineStart = rtl ? hostRect.right - inset - width : hostRect.left + inset;
      const maxStart = Math.max(inset, hostRect.height - size - inset);
      while (blockStart < maxStart) {
        const top = hostRect.top + blockStart;
        const candidate = {
          left: inlineStart,
          top,
          right: inlineStart + width,
          bottom: top + size,
        };
        const collisions = obstacles.filter(
          (rect) =>
            candidate.right > rect.left &&
            candidate.left < rect.right &&
            candidate.bottom > rect.top &&
            candidate.top < rect.bottom,
        );
        if (!collisions.length) break;
        blockStart = Math.min(
          maxStart,
          Math.max(
            ...collisions.map((rect) => Math.ceil(rect.bottom - hostRect.top + gap)),
          ),
        );
      }
    }
    button.dataset.compact = String(compact);
    button.style.setProperty('--kai-youtube-overlay-control-size', `${size}px`);
    button.style.setProperty('--kai-youtube-overlay-control-width', `${width}px`);
    button.style.setProperty('--kai-youtube-overlay-block-start', `${blockStart}px`);
  }

  #addButton(anchor: HTMLAnchorElement): void {
    const buttonHost = this.#hostFor(anchor);
    const card = anchor.closest(CARD_SELECTOR);
    if (!buttonHost || !parseYouTubeVideoUrl(anchor.href)) return;
    const existing =
      card?.querySelector<HTMLButtonElement>(`[${BUTTON_ATTRIBUTE}]`) ??
      buttonHost.querySelector<HTMLButtonElement>(`[${BUTTON_ATTRIBUTE}]`);
    this.#anchorHost(buttonHost);
    if (existing) {
      this.#placeButton(buttonHost, existing);
      return;
    }
    const button = this.documentRef.createElement('button');
    button.type = 'button';
    button.setAttribute(BUTTON_ATTRIBUTE, '');
    button.setAttribute(OVERLAY_OWNER_ATTRIBUTE, OVERLAY_OWNER);
    button.setAttribute(OVERLAY_SLOT_ATTRIBUTE, 'top-start');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `Quick Learn: ${cardTitleFor(anchor)}`);
    button.innerHTML = `${SPARK_ICON}<span>Quick Learn</span>`;
    for (const eventName of ['pointerdown', 'mousedown', 'mouseup', 'auxclick'])
      button.addEventListener(eventName, (event) => event.stopPropagation());
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void this.#toggle(anchor, button);
    });
    buttonHost.append(button);
    this.#placeButton(buttonHost, button);
  }

  async #toggle(anchor: HTMLAnchorElement, button: HTMLButtonElement): Promise<void> {
    const page = parseYouTubeVideoUrl(anchor.href);
    if (!page) return;
    if (
      this.#activeVideoId === page.videoId &&
      this.#activeButton?.dataset.loading === 'true'
    )
      return;
    if (this.#activeButton === button && this.#activeVideoId === page.videoId) {
      this.#close(true);
      return;
    }

    this.#close(false);
    this.#activeButton = button;
    this.#activeVideoId = page.videoId;
    const thumbnailUrl = thumbnailUrlFor(anchor) ?? fallbackThumbnailUrl(page.videoId);
    this.#activeRequest = {
      videoId: page.videoId,
      videoKind: page.kind,
      videoUrl: anchor.href,
      videoTitle: cardTitleFor(anchor),
      thumbnailUrl,
    };
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-busy', 'true');
    button.dataset.loading = 'true';
    await this.#launchOverlay(this.#activeRequest);
  }

  async #launchOverlay(request: QuickLearnOverlayRequest): Promise<void> {
    try {
      await this.openOverlay(request);
      if (this.#activeVideoId === request.videoId) this.#close(false);
    } catch {
      if (this.#activeVideoId === request.videoId) this.#renderError();
    }
  }

  #installStyles(): void {
    const existing = this.documentRef.querySelector<HTMLStyleElement>(
      `style[${STYLE_ATTRIBUTE}]`,
    );
    if (existing) {
      this.#style = existing;
      return;
    }
    const style = this.documentRef.createElement('style');
    style.setAttribute(STYLE_ATTRIBUTE, '');
    style.textContent = PAGE_STYLES;
    (this.documentRef.head ?? this.documentRef.documentElement).append(style);
    this.#style = style;
  }

  #ensurePopup(): PopupElements {
    if (this.#popup) return this.#popup;
    const host = this.documentRef.createElement('div');
    host.setAttribute(POPUP_ATTRIBUTE, '');
    host.style.cssText =
      'display:none;position:fixed;width:min(390px,calc(100vw - 24px));z-index:2147483646;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = this.documentRef.createElement('style');
    style.textContent = POPUP_STYLES;
    const frame = this.documentRef.createElement('section');
    frame.className = 'card';
    frame.setAttribute('role', 'dialog');
    frame.setAttribute('aria-modal', 'false');
    frame.setAttribute('aria-labelledby', 'watchbetter-quick-learn-title');
    frame.tabIndex = -1;
    const topbar = this.documentRef.createElement('header');
    topbar.className = 'topbar';
    const mark = this.documentRef.createElement('div');
    mark.className = 'mark';
    mark.innerHTML = SPARK_ICON;
    const heading = this.documentRef.createElement('div');
    heading.className = 'heading';
    const eyebrow = this.documentRef.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Quick Learn';
    const title = this.documentRef.createElement('h2');
    title.id = 'watchbetter-quick-learn-title';
    const close = this.documentRef.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.setAttribute('aria-label', 'Close Quick Learn');
    close.textContent = '×';
    close.addEventListener('click', () => this.#close(true));
    heading.append(eyebrow, title);
    topbar.append(mark, heading, close);
    const body = this.documentRef.createElement('div');
    body.className = 'body';
    const footer = this.documentRef.createElement('footer');
    footer.className = 'footer';
    const privacy = this.documentRef.createElement('span');
    privacy.className = 'privacy';
    privacy.textContent = 'Opens inside YouTube';
    const language = this.documentRef.createElement('span');
    footer.append(privacy, language);
    frame.append(topbar, body, footer);
    shadow.append(style, frame);
    (this.documentRef.body ?? this.documentRef.documentElement).append(host);
    this.#popup = { host, frame, title, body, language, close };
    return this.#popup;
  }

  #renderError(): void {
    const popup = this.#ensurePopup();
    const title = this.documentRef.createElement('div');
    title.className = 'error-title';
    title.textContent = 'Could not open Quick Learn';
    const copy = this.documentRef.createElement('p');
    copy.className = 'error-copy';
    copy.textContent = 'The in-page Gemini card did not open. Try once more.';
    const retry = this.documentRef.createElement('button');
    retry.type = 'button';
    retry.className = 'retry';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => {
      if (!this.#activeRequest) return;
      popup.host.style.display = 'none';
      if (this.#activeButton) {
        this.#activeButton.dataset.loading = 'true';
        this.#activeButton.setAttribute('aria-busy', 'true');
      }
      void this.#launchOverlay(this.#activeRequest);
    });
    popup.title.textContent = 'Quick Learn';
    popup.body.replaceChildren(title, copy, retry);
    popup.language.textContent = 'Overlay';
    popup.host.style.display = 'block';
    if (this.#activeButton) {
      delete this.#activeButton.dataset.loading;
      this.#activeButton.removeAttribute('aria-busy');
    }
    this.#schedulePosition();
    popup.frame.focus({ preventScroll: true });
  }

  readonly #schedulePosition = (): void => {
    if (this.#positionScheduled) return;
    this.#positionScheduled = true;
    this.#window.requestAnimationFrame(() => {
      this.#positionScheduled = false;
      this.documentRef
        .querySelectorAll<HTMLButtonElement>(`[${BUTTON_ATTRIBUTE}]`)
        .forEach((button) => {
          const host = button.parentElement;
          if (host) this.#placeButton(host, button);
        });
      if (this.#activeButton) this.#position();
    });
  };

  #position(): void {
    if (!this.#activeButton || !this.#popup) return;
    const rect = this.#activeButton.getBoundingClientRect();
    if (
      !this.#activeButton.isConnected ||
      rect.bottom < 0 ||
      rect.top > this.#window.innerHeight ||
      rect.right < 0 ||
      rect.left > this.#window.innerWidth
    ) {
      this.#close(false);
      return;
    }
    const width = Math.min(390, this.#window.innerWidth - 24);
    const height = Math.min(
      this.#popup.frame.getBoundingClientRect().height || 440,
      this.#window.innerHeight - 24,
    );
    const left = Math.max(
      12,
      Math.min(rect.left, this.#window.innerWidth - width - 12),
    );
    const below = rect.bottom + 10;
    const top =
      below + height <= this.#window.innerHeight - 12
        ? below
        : Math.max(12, rect.top - height - 10);
    this.#popup.host.style.left = `${left}px`;
    this.#popup.host.style.top = `${top}px`;
  }

  readonly #onOutsidePointer = (event: PointerEvent): void => {
    if (!this.#activeButton || !this.#popup) return;
    const path = event.composedPath();
    if (path.includes(this.#activeButton) || path.includes(this.#popup.host)) return;
    this.#close(false);
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.#activeButton) return;
    event.preventDefault();
    event.stopPropagation();
    this.#close(true);
  };

  #close(restoreFocus: boolean): void {
    const button = this.#activeButton;
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.removeAttribute('aria-busy');
      delete button.dataset.loading;
    }
    if (this.#popup) this.#popup.host.style.display = 'none';
    this.#activeButton = null;
    this.#activeVideoId = null;
    this.#activeRequest = null;
    if (restoreFocus && button?.isConnected) button.focus({ preventScroll: true });
  }
}
