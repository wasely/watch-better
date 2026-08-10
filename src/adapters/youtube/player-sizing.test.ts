import { afterEach, describe, expect, it, vi } from 'vitest';

import { createYouTubePlayerSizeSync, PLAYER_HEIGHT_PROPERTY } from './player-sizing';

describe('YouTube player size sync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('keeps panel height stable without shifting content as the player scrolls', () => {
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
    document.body.append(player);
    const host = document.createElement('div');
    let playerHeight = 720;
    let playerTop = 20;
    vi.spyOn(player, 'getBoundingClientRect').mockImplementation(
      () => ({ height: playerHeight, top: playerTop }) as DOMRect,
    );

    const sizeSync = createYouTubePlayerSizeSync(document, host);
    sizeSync.sync();

    expect(observe).toHaveBeenCalledWith(player);
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('720px');
    const styleBeforeScroll = host.style.cssText;

    playerTop = -500;
    sizeSync.sync();
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('720px');
    expect(host.style.cssText).toBe(styleBeforeScroll);

    playerHeight = 405.5;
    onResize();
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('720px');

    window.dispatchEvent(new Event('resize'));
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('405.5px');

    sizeSync.dispose();
    expect(disconnect).toHaveBeenCalled();
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('');
  });

  it('uses the active Short player for its panel height', () => {
    const observe = vi.fn();
    class ResizeObserverMock {
      observe = observe;
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const short = document.createElement('ytd-reel-video-renderer');
    short.setAttribute('is-active', '');
    const player = document.createElement('div');
    player.className = 'html5-video-player';
    short.append(player);
    document.body.append(short);
    vi.spyOn(player, 'getBoundingClientRect').mockReturnValue({
      height: 640,
    } as DOMRect);
    const host = document.createElement('div');

    const sizeSync = createYouTubePlayerSizeSync(document, host);
    sizeSync.sync();

    expect(observe).toHaveBeenCalledWith(player);
    expect(host.style.getPropertyValue(PLAYER_HEIGHT_PROPERTY)).toBe('640px');
    sizeSync.dispose();
  });
});
