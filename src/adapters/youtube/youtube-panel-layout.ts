import { parseYouTubeVideoUrl } from './youtube-url';

const setHostStyle = (host: HTMLElement, name: string, value: string): void =>
  host.style.setProperty(name, value, 'important');

export const applyYouTubePanelHostLayout = (
  host: HTMLElement,
  target: Element,
  url: string,
  documentRef: Document,
): void => {
  // The rail is part of YouTube's document scroller. Never let Chrome select the
  // injected panel (or a moving transcript row inside it) as the page's scroll
  // anchor, or transcript auto-follow can drag the whole watch page with it.
  setHostStyle(host, 'overflow-anchor', 'none');
  const isShortsDock =
    parseYouTubeVideoUrl(url)?.kind === 'shorts' && target === documentRef.body;

  if (isShortsDock) {
    host.dataset.watchbetterShortsDock = 'true';
    setHostStyle(host, 'display', 'block');
    setHostStyle(host, 'position', 'fixed');
    setHostStyle(host, 'top', 'clamp(12px, 9dvh, 96px)');
    setHostStyle(host, 'right', '16px');
    setHostStyle(host, 'width', 'min(420px, calc(100vw - 32px))');
    setHostStyle(
      host,
      '--watchbetter-player-height',
      'calc(100dvh - clamp(12px, 9dvh, 96px) - 16px)',
    );
    setHostStyle(host, 'max-height', 'calc(100dvh - clamp(12px, 9dvh, 96px) - 16px)');
    setHostStyle(host, 'margin-bottom', '0');
    setHostStyle(host, 'z-index', '2147483000');
    return;
  }

  delete host.dataset.watchbetterShortsDock;
  host.style.removeProperty('position');
  host.style.removeProperty('display');
  host.style.removeProperty('top');
  host.style.removeProperty('right');
  host.style.removeProperty('--watchbetter-player-height');
  host.style.removeProperty('max-height');
  host.style.width = '100%';
  host.style.marginBottom = '12px';
  host.style.removeProperty('z-index');
};
