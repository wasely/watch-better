import { parseYouTubeVideoUrl } from '@/adapters/youtube/youtube-url';

const THUMBNAIL_SELECTOR = [
  'ytd-thumbnail a[href*="/watch?"]',
  'ytd-thumbnail a[href*="/shorts/"]',
  'a#thumbnail[href*="/watch?"]',
  'a#thumbnail[href*="/shorts/"]',
  'a.yt-lockup-view-model__content-image[href*="/watch?"]',
  'a.yt-lockup-view-model__content-image[href*="/shorts/"]',
  'yt-thumbnail-view-model a[href*="/watch?"]',
  'yt-thumbnail-view-model a[href*="/shorts/"]',
  'ytd-reel-item-renderer a[href*="/shorts/"]',
  'ytm-shorts-lockup-view-model a[href*="/shorts/"]',
].join(',');

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

const BUTTON_ATTRIBUTE = 'data-watchbetter-quick-learn-button';
const STYLE_ATTRIBUTE = 'data-watchbetter-quick-learn-style';
const POPUP_ATTRIBUTE = 'data-watchbetter-quick-learn-popup';

export interface QuickLearnOverlayRequest {
  readonly videoId: string;
  readonly videoKind: 'watch' | 'shorts';
  readonly videoUrl: string;
  readonly videoTitle: string;
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
    box-sizing: border-box !important;
    color: #f4f1ec !important;
    cursor: pointer !important;
    display: flex !important;
    font: 600 12px/1 Arial, sans-serif !important;
    gap: 7px !important;
    height: 34px !important;
    justify-content: flex-start !important;
    left: 8px !important;
    max-width: 34px !important;
    overflow: hidden !important;
    padding: 7px !important;
    pointer-events: auto !important;
    position: absolute !important;
    top: 8px !important;
    transition: max-width 150ms ease, border-color 150ms ease, background 150ms ease !important;
    white-space: nowrap !important;
    z-index: 2147483000 !important;
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
    opacity: 0 !important;
    transition: opacity 100ms ease !important;
  }
  [${BUTTON_ATTRIBUTE}]:hover,
  [${BUTTON_ATTRIBUTE}]:focus-visible,
  [${BUTTON_ATTRIBUTE}][aria-expanded="true"] {
    background: rgba(21, 26, 34, .97) !important;
    border-color: #f5b64a !important;
    max-width: 112px !important;
    outline: none !important;
  }
  [${BUTTON_ATTRIBUTE}]:hover span,
  [${BUTTON_ATTRIBUTE}]:focus-visible span,
  [${BUTTON_ATTRIBUTE}][aria-expanded="true"] span {
    opacity: 1 !important;
  }
  [${BUTTON_ATTRIBUTE}][data-loading="true"] svg {
    animation: watchbetter-quick-learn-radar 850ms linear infinite !important;
    color: #65cbe2 !important;
  }
  @keyframes watchbetter-quick-learn-radar {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    [${BUTTON_ATTRIBUTE}], [${BUTTON_ATTRIBUTE}] span { transition: none !important; }
    [${BUTTON_ATTRIBUTE}][data-loading="true"] svg { animation: none !important; }
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
        if (record.type === 'attributes' && record.target instanceof Element)
          this.#scanRoots.add(record.target);
        for (const node of record.addedNodes)
          if (node instanceof Element) this.#scanRoots.add(node);
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
    const anchors = new Set<HTMLAnchorElement>();
    if (root instanceof HTMLAnchorElement && root.matches(THUMBNAIL_SELECTOR))
      anchors.add(root);
    root
      .querySelectorAll<HTMLAnchorElement>(THUMBNAIL_SELECTOR)
      .forEach((anchor) => anchors.add(anchor));
    for (const anchor of anchors) this.#addButton(anchor);
  }

  #addButton(anchor: HTMLAnchorElement): void {
    const thumbnail = anchor.closest(
      'ytd-thumbnail, yt-thumbnail-view-model, ytd-reel-item-renderer, ytm-shorts-lockup-view-model',
    );
    if (
      anchor.querySelector(`[${BUTTON_ATTRIBUTE}]`) ||
      thumbnail?.querySelector(`[${BUTTON_ATTRIBUTE}]`) ||
      !parseYouTubeVideoUrl(anchor.href)
    )
      return;
    const button = this.documentRef.createElement('button');
    button.type = 'button';
    button.setAttribute(BUTTON_ATTRIBUTE, '');
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
    anchor.append(button);
  }

  async #toggle(anchor: HTMLAnchorElement, button: HTMLButtonElement): Promise<void> {
    const page = parseYouTubeVideoUrl(anchor.href);
    if (!page) return;
    if (this.#activeButton === button && this.#activeVideoId === page.videoId) {
      this.#close(true);
      return;
    }

    this.#close(false);
    this.#activeButton = button;
    this.#activeVideoId = page.videoId;
    this.#activeRequest = {
      videoId: page.videoId,
      videoKind: page.kind,
      videoUrl: anchor.href,
      videoTitle: cardTitleFor(anchor),
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
    if (!this.#activeButton || this.#positionScheduled) return;
    this.#positionScheduled = true;
    this.#window.requestAnimationFrame(() => {
      this.#positionScheduled = false;
      this.#position();
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
