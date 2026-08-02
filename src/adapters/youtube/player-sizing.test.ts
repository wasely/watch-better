import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createYouTubePlayerSizeSync,
  PLAYER_HEIGHT_PROPERTY,
  PLAYER_TOP_OVERLAP_PROPERTY,
} from './player-sizing';

describe('YouTube player size sync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('keeps the panel height mapped to live player resizes', () => {
    let onResize: () => void = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();

    class ResizeObserverMock {
      constructor(callback: () => void) {
        onResize = callback;
      }

      observe = observe;
      disconnect = disconnect;
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const player = document.createElement('div');
    player.id = 'movie_player';
    const masthead = document.createElement('div');
    masthead.id = 'masthead-container';
    document.body.append(masthead);
    document.body.append(player);
    const host = document.createElement('div');
    let playerHeight = 720;
    vi.spyOn(player, 'getBoundingClientRect').mockImplementation(
      () => ({ height: playerHeight, top: 20 }) as DOMRect,
    );
    vi.spyOn(masthead, 'getBoundingClientRect').mockImplementation(
      () => ({ bottom: 56 }) as DOMRect,
    );

    const sizeSync = createYouTubePlayerSizeSync(document, host);
    sizeSync.sync();

    expect(observe).toHaveBeenCalledWith(player);
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('720px');
    expect(host.style.getPropertyValue(PLAYER_TOP_OVERLAP_PROPERTY)).toBe('36px');

    playerHeight = 405.5;
    onResize();
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('720px');

    window.dispatchEvent(new Event('resize'));
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('405.5px');

    sizeSync.dispose();
    expect(disconnect).toHaveBeenCalled();
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('');
    expect(host.style.getPropertyValue(PLAYER_TOP_OVERLAP_PROPERTY)).toBe('');
  });
});
