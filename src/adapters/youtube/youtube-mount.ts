export const isYouTubeWatchUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/watch' && Boolean(parsed.searchParams.get('v'));
  } catch {
    return false;
  }
};

export const isYouTubeTheaterMode = (documentRef: Document): boolean =>
  Boolean(documentRef.querySelector('ytd-watch-flexy[theater]'));

/** Returns a normal-flow mount target and never replaces existing content. */
export const resolveYouTubeMountTarget = (
  documentRef: Document,
  url: string,
): Element | null => {
  if (!isYouTubeWatchUrl(url)) return null;
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

/** Keeps WatchBetter first even when another extension inserts into the rail later. */
export const placeYouTubePanelFirst = (target: Element, host: Element): void => {
  if (host.parentElement !== target || host.previousElementSibling !== null)
    target.prepend(host);
};
