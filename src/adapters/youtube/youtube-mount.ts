import { isSupportedYouTubeVideoUrl, parseYouTubeVideoUrl } from './youtube-url';

export const isYouTubeWatchUrl = isSupportedYouTubeVideoUrl;

export const isYouTubeTheaterMode = (documentRef: Document): boolean =>
  Boolean(documentRef.querySelector('ytd-watch-flexy[theater]'));

const resolveYouTubeShortsMountTarget = (documentRef: Document): Element =>
  documentRef.body;

/** Returns a normal-flow mount target and never replaces existing content. */
export const resolveYouTubeMountTarget = (
  documentRef: Document,
  url: string,
): Element | null => {
  const page = parseYouTubeVideoUrl(url);
  if (!page) return null;
  if (page.kind === 'shorts') return resolveYouTubeShortsMountTarget(documentRef);
  if (isYouTubeTheaterMode(documentRef))
    return (
      documentRef.querySelector('ytd-watch-flexy #below') ??
      documentRef.querySelector('#primary-inner #below')
    );
  return (
    documentRef.querySelector('ytd-watch-flexy #secondary') ??
    documentRef.querySelector('#secondary') ??
    documentRef.querySelector('ytd-watch-flexy #secondary-inner') ??
    documentRef.querySelector('#secondary-inner') ??
    documentRef.querySelector('ytd-watch-flexy #below') ??
    documentRef.querySelector('#primary-inner #below')
  );
};

/** Keeps Watch Better first even when another extension inserts into the rail later. */
export const placeYouTubePanelFirst = (target: Element, host: Element): void => {
  if (host.parentElement !== target || host.previousElementSibling !== null)
    target.prepend(host);
};
