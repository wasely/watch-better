export const PLAYER_HEIGHT_PROPERTY = '--watchbetter-player-height';

interface PlayerSizeSync {
  readonly sync: () => void;
  readonly dispose: () => void;
}

export const createYouTubePlayerSizeSync = (
  document: Document,
  host: HTMLElement,
): PlayerSizeSync => {
  let observedPlayer: Element | null = null;
  let lockedHeight = 0;

  const syncHeight = (allowShrink = false) => {
    const player =
      document.querySelector(
        'ytd-reel-video-renderer[is-active] .html5-video-player',
      ) ??
      document.querySelector('#movie_player') ??
      document.querySelector('ytd-player');
    if (player !== observedPlayer) {
      observer.disconnect();
      observedPlayer = player;
      if (player) observer.observe(player);
    }

    const playerRect = player?.getBoundingClientRect();
    const height = playerRect?.height ?? 0;
    const shouldUpdateHeight =
      height > 0 && (lockedHeight === 0 || allowShrink || height >= lockedHeight);
    if (!shouldUpdateHeight) return;
    lockedHeight = height;
    host.style.setProperty(PLAYER_HEIGHT_PROPERTY, `${height}px`);
  };

  const observer = new ResizeObserver(() => syncHeight(false));
  const onViewportResize = () => syncHeight(true);
  document.defaultView?.addEventListener('resize', onViewportResize);

  return {
    sync: syncHeight,
    dispose: () => {
      observer.disconnect();
      document.defaultView?.removeEventListener('resize', onViewportResize);
      host.style.removeProperty(PLAYER_HEIGHT_PROPERTY);
      observedPlayer = null;
      lockedHeight = 0;
    },
  };
};
