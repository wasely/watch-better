export const PLAYER_HEIGHT_PROPERTY = '--watchbetter-player-height';
export const PLAYER_TOP_OVERLAP_PROPERTY = '--watchbetter-player-top-overlap';

interface PlayerSizeSync {
  readonly sync: () => void;
  readonly dispose: () => void;
}

export const createYouTubePlayerSizeSync = (
  document: Document,
  host: HTMLElement,
): PlayerSizeSync => {
  let observedPlayer: Element | null = null;

  const syncHeight = () => {
    const player =
      document.querySelector('#movie_player') ?? document.querySelector('ytd-player');
    if (player !== observedPlayer) {
      observer.disconnect();
      observedPlayer = player;
      if (player) observer.observe(player);
    }

    const playerRect = player?.getBoundingClientRect();
    const height = playerRect?.height ?? 0;
    if (height > 0) host.style.setProperty(PLAYER_HEIGHT_PROPERTY, `${height}px`);
    else host.style.removeProperty(PLAYER_HEIGHT_PROPERTY);

    const masthead = document.querySelector('#masthead-container');
    const mastheadBottom = masthead?.getBoundingClientRect().bottom ?? 0;
    const overlap = Math.max(0, mastheadBottom - (playerRect?.top ?? mastheadBottom));
    if (overlap > 0)
      host.style.setProperty(PLAYER_TOP_OVERLAP_PROPERTY, `${overlap}px`);
    else host.style.removeProperty(PLAYER_TOP_OVERLAP_PROPERTY);
  };

  const observer = new ResizeObserver(syncHeight);

  return {
    sync: syncHeight,
    dispose: () => {
      observer.disconnect();
      host.style.removeProperty(PLAYER_HEIGHT_PROPERTY);
      host.style.removeProperty(PLAYER_TOP_OVERLAP_PROPERTY);
      observedPlayer = null;
    },
  };
};
