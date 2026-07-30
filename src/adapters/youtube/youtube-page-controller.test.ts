import { describe, expect, it, vi } from 'vitest';

import { BrowserYouTubePageController } from './youtube-page-controller';

describe('BrowserYouTubePageController', () => {
  it('emits enter, video change, and leave exactly once per URL', async () => {
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

    history.pushState({}, '', '/results?search_query=test');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await Promise.resolve();
    expect(controller.snapshot).toMatchObject({
      kind: 'unsupported',
      videoId: null,
      generation: 3,
    });
    expect(listener).toHaveBeenCalledTimes(4);
    controller.dispose();
  });
});
