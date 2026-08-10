import { parseYouTubeVideoUrl } from './youtube-url';

const setHostStyle = (host: HTMLElement, name: string, value: string): void =>
  host.style.setProperty(name, value, 'important');

export const applyYouTubePanelHostLayout = (
  host: HTMLElement,
  target: Element,
  url: string,
  documentRef: Document,
): void => {
  const isShortsDock =
    parseYouTubeVideoUrl(url)?.kind === 'shorts' && target === documentRef.body;

  if (isShortsDock) {
    host.dataset.watchbetterShortsDock = 'true';
    setHostStyle(host, 'display', 'block');
    setHostStyle(host, 'position', 'fixed');
    setHostStyle(host, 'top', '96px');
    setHostStyle(host, 'right', '16px');
    setHostStyle(host, 'width', 'min(420px, calc(100vw - 32px))');
    setHostStyle(host, 'margin-bottom', '0');
    setHostStyle(host, 'z-index', '2147483000');
    return;
  }

  delete host.dataset.watchbetterShortsDock;
  host.style.removeProperty('position');
  host.style.removeProperty('display');
  host.style.removeProperty('top');
  host.style.removeProperty('right');
  host.style.width = '100%';
  host.style.marginBottom = '12px';
  host.style.removeProperty('z-index');
};
