import { describe, expect, it, vi } from 'vitest';

import { BrowserYouTubePageController } from './youtube-page-controller';

describe('BrowserYouTubePageController', () => {
  it('emits watch, Shorts, and leave transitions exactly once per URL', async () => {
    history.replaceState({}, '', '/');
    const controller = new BrowserYouTubePageController(window);
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.start();

    history.pushState({}, '', '/watch?v=alpha');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await Promise.resolve();
    expect(controller.snapshot).toMatchObject({
      kind: 'watch',
      videoId: 'alpha',
      generation: 1,
    });

    document.dispatchEvent(new Event('yt-page-data-updated'));
    await Promise.resolve();
    expect(controller.snapshot.generation).toBe(1);

    history.pushState({}, '', '/watch?v=beta');
    dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();
    expect(controller.snapshot).toMatchObject({ videoId: 'beta', generation: 2 });

    history.pushState({}, '', '/shorts/gamma');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await Promise.resolve();
    expect(controller.snapshot).toMatchObject({
      kind: 'shorts',
      videoId: 'gamma',
      generation: 3,
    });

    history.pushState({}, '', '/results?search_query=test');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await Promise.resolve();
    expect(controller.snapshot).toMatchObject({
      kind: 'unsupported',
      videoId: null,
      generation: 4,
    });
    expect(listener).toHaveBeenCalledTimes(5);
    controller.dispose();
  });

  it('updates same-video URLs without resetting page generation', async () => {
    history.replaceState({}, '', '/watch?v=alpha');
    const controller = new BrowserYouTubePageController(window);
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.start();

    history.pushState({}, '', '/watch?v=alpha&t=42');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await Promise.resolve();

    expect(controller.snapshot).toMatchObject({
      kind: 'watch',
      videoId: 'alpha',
      generation: 0,
    });
    expect(controller.snapshot.url).toContain('t=42');
    expect(listener).toHaveBeenCalledTimes(2);
    controller.dispose();
  });
});
